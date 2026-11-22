"""
JPEG/PNG Compression Analysis module for ClaimGuard AI.

Inspects JPEG discrete cosine transform (DCT) quantization tables, chroma subsampling,
and bitstream encoding properties natively using Pillow.
Inspects PNG binary structure, IHDR properties, IDAT chunk compression metrics,
and scanline adaptive filtering (None, Sub, Up, Average, Paeth) using Python's
built-in struct and zlib modules with strict memory safety boundaries.
Missing compression properties or ordinary compression characteristics are never
interpreted as suspicious or as proof of image manipulation.
"""

import math
import struct
import zlib
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, UnidentifiedImageError

# ---------------------------------------------------------------------------
# PNG CONSTANTS AND SECURITY THRESHOLDS
# ---------------------------------------------------------------------------

PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"

# Memory and dimension guards to prevent decompression bombs in AWS Lambda
PNG_MAX_WIDTH = 50_000
PNG_MAX_HEIGHT = 50_000
PNG_MAX_PIXELS = 50_000_000  # 50 megapixels
PNG_MAX_DECOMPRESSED_BYTES = 100 * 1024 * 1024  # 100 MiB hard limit

# PNG specification ISO/IEC 15948:2004 color types
PNG_COLOR_TYPES = {
    0: {"name": "Grayscale", "channels": 1, "allowed_depths": (1, 2, 4, 8, 16)},
    2: {"name": "Truecolor (RGB)", "channels": 3, "allowed_depths": (8, 16)},
    3: {"name": "Indexed-color (Palette)", "channels": 1, "allowed_depths": (1, 2, 4, 8)},
    4: {"name": "Grayscale with alpha", "channels": 2, "allowed_depths": (8, 16)},
    6: {"name": "Truecolor with alpha (RGBA)", "channels": 4, "allowed_depths": (8, 16)},
}

PNG_FILTER_NAMES = {
    0: "None",
    1: "Sub",
    2: "Up",
    3: "Average",
    4: "Paeth",
}

# Standard Adam7 progressive interlace pass definitions: (start_x, start_y, step_x, step_y)
ADAM7_PASSES = [
    (0, 0, 8, 8),  # Pass 1
    (4, 0, 8, 8),  # Pass 2
    (0, 4, 4, 8),  # Pass 3
    (2, 0, 4, 4),  # Pass 4
    (0, 2, 2, 4),  # Pass 5
    (1, 0, 2, 2),  # Pass 6
    (0, 1, 1, 2),  # Pass 7
]


# ---------------------------------------------------------------------------
# JPEG HELPERS (PRESERVED)
# ---------------------------------------------------------------------------

def _extract_quantization_tables(image):
    """Extract and parse JPEG quantization tables from Pillow."""
    if getattr(image, "format", "") != "JPEG":
        return None

    raw_tables = getattr(image, "quantization", None)
    if not raw_tables or not isinstance(raw_tables, dict):
        return None

    tables = {}
    for table_id, values in raw_tables.items():
        if not values:
            continue
        vals = list(values)
        tables[str(table_id)] = {
            "coefficient_count": len(vals),
            "minimum": min(vals),
            "maximum": max(vals),
            "mean": round(sum(vals) / len(vals), 2),
            "values": vals,
        }
    return tables if tables else None


def _extract_chroma_subsampling(image):
    """
    Extract YCbCr chroma subsampling string from Pillow JPEG layer metadata.
    Returns None for non-JPEG formats (PNG uses RGB/RGBA/Grayscale/Palette without chroma subsampling).
    """
    if getattr(image, "format", "") != "JPEG":
        return None

    layer = getattr(image, "layer", None)
    if not layer or not isinstance(layer, (list, tuple)) or len(layer) < 1:
        return None

    if len(layer) == 1:
        return "Grayscale (1 component)"

    # layer items are 4-tuples: (component_id, h_samp, v_samp, qtable)
    try:
        y_comp = layer[0]
        h_samp = y_comp[1]
        v_samp = y_comp[2]

        if h_samp == 2 and v_samp == 2:
            return "YCbCr4:2:0 (2 2)"
        elif h_samp == 2 and v_samp == 1:
            return "YCbCr4:2:2 (2 1)"
        elif h_samp == 1 and v_samp == 1:
            return "YCbCr4:4:4 (1 1)"
        elif h_samp == 1 and v_samp == 2:
            return "YCbCr4:4:0 (1 2)"
        else:
            return f"YCbCr ({h_samp} {v_samp})"
    except (IndexError, TypeError):
        return None


def _extract_encoding_process(image):
    """Extract bitstream encoding process description."""
    fmt = getattr(image, "format", "")
    if fmt == "JPEG":
        info = getattr(image, "info", {})
        if info.get("progressive"):
            return "Progressive DCT, Huffman coding"
        return "Baseline DCT, Huffman coding"
    elif fmt == "PNG":
        info = getattr(image, "info", {})
        if info.get("interlace"):
            return "Deflate / zlib compression, Adam7 interlacing"
        return "Deflate / zlib compression, Adaptive filtering"
    return None


def _extract_file_type(image):
    """Extract descriptive file type."""
    fmt = getattr(image, "format", "")
    if fmt == "JPEG":
        if "jfif" in getattr(image, "info", {}):
            return "JPEG / JFIF"
        return "JPEG"
    elif fmt == "PNG":
        return "PNG"
    return fmt or "Unknown"


def _extract_bits_per_sample(image):
    """Extract bits per sample channel."""
    if getattr(image, "format", "") == "JPEG":
        return getattr(image, "bits", 8) or 8
    mode = getattr(image, "mode", "")
    if mode in ("RGB", "YCbCr", "L", "RGBA", "CMYK"):
        return 8
    elif mode in ("I;16", "I;16L", "I;16B"):
        return 16
    elif mode == "1":
        return 1
    return None


# ---------------------------------------------------------------------------
# PNG PARSING, EXTRACTION, METRICS AND SCANLINE ANALYSIS
# ---------------------------------------------------------------------------

def _parse_png_chunks(file_path):
    """
    Parse PNG binary structure sequentially.

    Validates:
    - 8-byte PNG file signature
    - Chunk boundary integrity
    - CRC-32 checksums for each parsed chunk
    - Detection of missing IEND chunk

    Returns:
        tuple: (ihdr_data, idat_chunks, chunk_summary, findings)
    """
    findings = []
    ihdr_data = None
    idat_chunks = []
    chunk_types = []

    path = Path(file_path)
    file_size = path.stat().st_size

    with open(path, "rb") as f:
        signature = f.read(8)
        if signature != PNG_SIGNATURE:
            raise ValueError("File is not a valid PNG image (invalid signature header).")

        offset = 8
        while offset < file_size:
            header = f.read(8)
            if not header:
                break
            if len(header) < 8:
                findings.append({
                    "code": "PNG_TRUNCATED_CHUNK_HEADER",
                    "severity": "informational",
                    "message": "Encountered unexpected end of file while reading chunk header.",
                })
                break

            length, = struct.unpack(">I", header[:4])
            chunk_type_bytes = header[4:8]
            chunk_type_name = chunk_type_bytes.decode("latin1", errors="replace")
            chunk_types.append(chunk_type_name)

            chunk_data = f.read(length)
            if len(chunk_data) < length:
                findings.append({
                    "code": "PNG_TRUNCATED_CHUNK_DATA",
                    "severity": "informational",
                    "message": f"Truncated chunk payload in '{chunk_type_name}' ({len(chunk_data)} of {length} bytes).",
                })
                break

            crc_bytes = f.read(4)
            if len(crc_bytes) < 4:
                findings.append({
                    "code": "PNG_TRUNCATED_CHUNK_CRC",
                    "severity": "informational",
                    "message": f"Truncated CRC bytes in chunk '{chunk_type_name}'.",
                })
                break

            crc, = struct.unpack(">I", crc_bytes)
            expected_crc = zlib.crc32(chunk_type_bytes + chunk_data) & 0xFFFFFFFF
            if crc != expected_crc:
                findings.append({
                    "code": "PNG_CRC_MISMATCH",
                    "severity": "informational",
                    "message": f"CRC-32 checksum mismatch in chunk '{chunk_type_name}' (expected {hex(expected_crc)}, got {hex(crc)}).",
                })

            if chunk_type_name == "IHDR" and ihdr_data is None:
                ihdr_data = chunk_data
            elif chunk_type_name == "IDAT":
                idat_chunks.append(chunk_data)
            elif chunk_type_name == "IEND":
                break

            offset += 12 + length

    if "IEND" not in chunk_types:
        findings.append({
            "code": "PNG_MISSING_IEND",
            "severity": "informational",
            "message": "PNG bitstream is missing required IEND termination chunk.",
        })

    chunk_summary = {
        "chunk_count": len(chunk_types),
        "chunk_types": chunk_types,
    }
    return ihdr_data, idat_chunks, chunk_summary, findings


def _extract_png_ihdr(ihdr_data):
    """
    Extract and strictly validate IHDR chunk properties per ISO/IEC 15948:2004.

    IHDR structure (13 bytes):
    - Width: 4 bytes (uint32)
    - Height: 4 bytes (uint32)
    - Bit depth: 1 byte (uint8)
    - Color type: 1 byte (uint8)
    - Compression method: 1 byte (uint8)
    - Filter method: 1 byte (uint8)
    - Interlace method: 1 byte (uint8)
    """
    if not ihdr_data or len(ihdr_data) != 13:
        raise ValueError(f"Invalid PNG IHDR chunk length: expected 13 bytes, got {len(ihdr_data) if ihdr_data else 0}.")

    width, height, bit_depth, color_type, comp_m, filter_m, interlace_m = struct.unpack(">IIBBBBB", ihdr_data)

    if width <= 0 or height <= 0:
        raise ValueError(f"Invalid PNG dimensions in IHDR: {width}x{height}.")

    if color_type not in PNG_COLOR_TYPES:
        raise ValueError(f"Invalid PNG color type in IHDR: {color_type}.")

    allowed_depths = PNG_COLOR_TYPES[color_type]["allowed_depths"]
    if bit_depth not in allowed_depths:
        raise ValueError(f"Invalid bit depth {bit_depth} for PNG color type {color_type} (allowed: {allowed_depths}).")

    if comp_m != 0:
        raise ValueError(f"Unsupported PNG compression method in IHDR: {comp_m} (expected 0 for DEFLATE).")

    if filter_m != 0:
        raise ValueError(f"Unsupported PNG filter method in IHDR: {filter_m} (expected 0 for adaptive).")

    if interlace_m not in (0, 1):
        raise ValueError(f"Unsupported PNG interlace method in IHDR: {interlace_m} (expected 0 or 1).")

    color_meta = PNG_COLOR_TYPES[color_type]
    channels = color_meta["channels"]
    bits_per_pixel = channels * bit_depth

    return {
        "width": width,
        "height": height,
        "bit_depth": bit_depth,
        "color_type": color_type,
        "color_type_label": color_meta["name"],
        "channels": channels,
        "bits_per_pixel": bits_per_pixel,
        "compression_method": comp_m,
        "compression_method_label": "DEFLATE (32K sliding window)",
        "filter_method": filter_m,
        "filter_method_label": "Adaptive (Standard 5 filter types)",
        "interlace_method": interlace_m,
        "interlace_method_label": "Adam7 interlaced" if interlace_m == 1 else "Non-interlaced",
    }


def _calculate_png_metrics(ihdr, total_compressed_bytes):
    """
    Calculate uncompressed image byte sizes, compression ratio, and space savings.

    Formulas:
    - bits_per_pixel = channels * bit_depth
    - scanline_stride = ceil((width * bits_per_pixel) / 8)
    - uncompressed_pixel_bytes = height * scanline_stride
    - Non-interlaced uncompressed_scanline_bytes = height * (1 + scanline_stride)
    - Adam7 uncompressed_scanline_bytes = sum over 7 passes of hp * (1 + ceil((wp * bpp) / 8))
    - compression_ratio = uncompressed_pixel_bytes / total_compressed_bytes
    - space_savings_percent = (1 - (total_compressed_bytes / uncompressed_pixel_bytes)) * 100
    """
    width = ihdr["width"]
    height = ihdr["height"]
    bpp = ihdr["bits_per_pixel"]
    interlace_m = ihdr["interlace_method"]

    stride = math.ceil((width * bpp) / 8)
    uncompressed_pixel_bytes = height * stride

    if interlace_m == 0:
        uncompressed_scanline_bytes = height * (1 + stride)
    else:
        # Adam7 progressive passes
        uncompressed_scanline_bytes = 0
        for sx, sy, stx, sty in ADAM7_PASSES:
            pw = (width - sx + stx - 1) // stx if width > sx else 0
            ph = (height - sy + sty - 1) // sty if height > sy else 0
            if pw > 0 and ph > 0:
                p_stride = math.ceil((pw * bpp) / 8)
                uncompressed_scanline_bytes += ph * (1 + p_stride)

    if total_compressed_bytes > 0:
        compression_ratio = round(uncompressed_pixel_bytes / total_compressed_bytes, 2)
    else:
        compression_ratio = None

    if uncompressed_pixel_bytes > 0 and total_compressed_bytes > 0:
        savings = (1.0 - (total_compressed_bytes / uncompressed_pixel_bytes)) * 100
        space_savings_percent = round(savings, 2)
    else:
        space_savings_percent = 0.0

    return {
        "uncompressed_pixel_bytes": uncompressed_pixel_bytes,
        "uncompressed_scanline_bytes": uncompressed_scanline_bytes,
        "compressed_bytes": total_compressed_bytes,
        "compression_ratio": compression_ratio,
        "compression_ratio_label": f"{compression_ratio}:1" if compression_ratio is not None else "—",
        "space_savings_percent": space_savings_percent,
    }


def _analyze_png_scanlines(ihdr, idat_chunks):
    """
    Analyze scanline adaptive filter distribution using bounded zlib decompression.

    Safety:
    - Bounded zlib decompression (max 100 MiB)
    - Dimension checks (max 50 MP)
    - Gracefully skips filter-distribution on Adam7 interlaced PNGs with explicit explanation
    - Gracefully handles truncated or anomalous filter bytes

    Returns:
        tuple: (filter_distribution, filter_distribution_note, findings)
    """
    findings = []
    width = ihdr["width"]
    height = ihdr["height"]
    bpp = ihdr["bits_per_pixel"]
    interlace_m = ihdr["interlace_method"]

    # Handle Adam7 interlacing safely without applying non-interlaced stride
    if interlace_m == 1:
        note = (
            "Scanline filter distribution is safely omitted for Adam7 interlaced PNGs. "
            "Pixel data is partitioned across 7 progressive reduced passes rather than linear sequential raster scanlines."
        )
        return None, note, findings

    # Check dimension limits
    if width > PNG_MAX_WIDTH or height > PNG_MAX_HEIGHT or (width * height) > PNG_MAX_PIXELS:
        findings.append({
            "code": "PNG_DIMENSION_LIMIT_EXCEEDED",
            "severity": "informational",
            "message": f"Image dimensions ({width}x{height}) exceed safe threshold for in-memory scanline decompression.",
        })
        note = "Scanline filter distribution skipped: image dimensions exceed safe memory limit."
        return None, note, findings

    stride = math.ceil((width * bpp) / 8)
    line_size = 1 + stride
    expected_bytes = height * line_size

    if expected_bytes > PNG_MAX_DECOMPRESSED_BYTES:
        findings.append({
            "code": "PNG_MEMORY_LIMIT_EXCEEDED",
            "severity": "informational",
            "message": f"Uncompressed scanline data ({expected_bytes} bytes) exceeds 100 MiB safety limit.",
        })
        note = "Scanline filter distribution skipped: decompressed stream size exceeds 100 MiB memory safety limit."
        return None, note, findings

    if not idat_chunks:
        note = "No IDAT chunk payload available for scanline filter analysis."
        return None, note, findings

    combined_idat = b"".join(idat_chunks)

    try:
        dobj = zlib.decompressobj()
        decompressed = dobj.decompress(combined_idat, PNG_MAX_DECOMPRESSED_BYTES)
        if dobj.unconsumed_tail or len(decompressed) >= PNG_MAX_DECOMPRESSED_BYTES:
            findings.append({
                "code": "PNG_DECOMPRESSION_BOMB_PREVENTED",
                "severity": "informational",
                "message": "IDAT stream decompression halted after reaching 100 MiB memory safety limit.",
            })
            note = "Scanline filter distribution skipped: stream exceeded memory safety limit."
            return None, note, findings
    except zlib.error as exc:
        findings.append({
            "code": "PNG_DECOMPRESSION_ERROR",
            "severity": "informational",
            "message": f"IDAT bitstream decompression failed: {str(exc)[:200]}",
        })
        note = "Scanline filter distribution unavailable due to zlib decompression error."
        return None, note, findings

    if len(decompressed) < expected_bytes:
        findings.append({
            "code": "PNG_TRUNCATED_SCANLINES",
            "severity": "informational",
            "message": f"Decompressed IDAT stream is truncated ({len(decompressed)} of {expected_bytes} expected bytes).",
        })
        # Process available complete scanlines
        available_lines = len(decompressed) // line_size
    else:
        available_lines = height

    if available_lines == 0:
        note = "No complete scanlines available in decompressed bitstream."
        return None, note, findings

    filter_counts = {0: 0, 1: 0, 2: 0, 3: 0, 4: 0}
    anomalous_count = 0

    for y in range(available_lines):
        ft = decompressed[y * line_size]
        if ft in filter_counts:
            filter_counts[ft] += 1
        else:
            anomalous_count += 1

    if anomalous_count > 0:
        findings.append({
            "code": "PNG_ANOMALOUS_FILTER_BYTE",
            "severity": "informational",
            "message": f"{anomalous_count} scanline(s) contained non-standard filter bytes (>4).",
        })

    dominant_filter_id = max(filter_counts, key=filter_counts.get)
    dominant_filter_name = PNG_FILTER_NAMES.get(dominant_filter_id, "None")

    filters_dict = {
        "none": {
            "count": filter_counts[0],
            "percent": round((filter_counts[0] / available_lines) * 100, 2),
        },
        "sub": {
            "count": filter_counts[1],
            "percent": round((filter_counts[1] / available_lines) * 100, 2),
        },
        "up": {
            "count": filter_counts[2],
            "percent": round((filter_counts[2] / available_lines) * 100, 2),
        },
        "average": {
            "count": filter_counts[3],
            "percent": round((filter_counts[3] / available_lines) * 100, 2),
        },
        "paeth": {
            "count": filter_counts[4],
            "percent": round((filter_counts[4] / available_lines) * 100, 2),
        },
    }

    if anomalous_count > 0:
        filters_dict["anomalous"] = {
            "count": anomalous_count,
            "percent": round((anomalous_count / available_lines) * 100, 2),
        }

    distribution = {
        "total_scanlines": available_lines,
        "filters": filters_dict,
        "dominant_filter": dominant_filter_name,
    }

    return distribution, None, findings


def _analyze_png_compression(file_path):
    """
    Dedicated PNG compression analysis pipeline.
    Parses PNG chunks, extracts IHDR properties, computes compression metrics,
    and analyzes scanline filter distribution using bounded zlib decompression.
    """
    findings = []
    try:
        ihdr_data, idat_chunks, chunk_summary, parse_findings = _parse_png_chunks(file_path)
        findings.extend(parse_findings)

        if not ihdr_data:
            raise ValueError("PNG is missing required IHDR chunk.")

        ihdr = _extract_png_ihdr(ihdr_data)
        total_compressed_bytes = sum(len(c) for c in idat_chunks)
        chunk_sizes = [len(c) for c in idat_chunks]

        idat_info = {
            "chunk_count": len(idat_chunks),
            "total_compressed_bytes": total_compressed_bytes,
            "chunk_sizes": chunk_sizes,
        }

        metrics = _calculate_png_metrics(ihdr, total_compressed_bytes)

        filter_dist, filter_note, scanline_findings = _analyze_png_scanlines(ihdr, idat_chunks)
        findings.extend(scanline_findings)

        comp_analysis = {
            "format": "PNG",
            "format_note": (
                "PNG images use lossless DEFLATE compression with 5 adaptive scanline filter types. "
                "Discrete cosine transform (DCT) quantization tables are not applicable to this format."
            ),
            "ihdr": ihdr,
            "idat": idat_info,
            "metrics": metrics,
            "filter_distribution": filter_dist,
        }
        if filter_note:
            comp_analysis["filter_distribution_note"] = filter_note

        return comp_analysis, findings

    except Exception as exc:
        findings.append({
            "code": "PNG_ANALYSIS_ERROR",
            "severity": "informational",
            "message": f"PNG compression telemetry extraction failed: {str(exc)[:300]}",
        })
        fallback = {
            "format": "PNG",
            "format_note": (
                "PNG images use lossless DEFLATE compression. "
                "Discrete cosine transform (DCT) quantization tables are not applicable to this format."
            ),
            "ihdr": None,
            "idat": None,
            "metrics": None,
            "filter_distribution": None,
        }
        return fallback, findings


# ---------------------------------------------------------------------------
# MAIN ANALYSIS ENTRY POINT
# ---------------------------------------------------------------------------

def analyze_compression(image_path):
    """
    Analyze image compression characteristics natively using Pillow and standard libraries.

    For JPEG/JPG images:
    - Retains quantization tables, coefficient metrics, chroma subsampling, and encoding process.

    For PNG images:
    - Extracts binary IHDR container properties, IDAT chunk compression sizes,
      uncompressed pixel/scanline bytes, compression ratio, space savings percentage,
      and scanline adaptive filter distribution (None, Sub, Up, Average, Paeth).
    - Safely handles Adam7 interlacing without applying linear stride formulas.
    - Missing compression details or ordinary characteristics are reported as informational,
      never triggering human review flags.
    """
    path = Path(image_path)
    if not path.exists() or not path.is_file():
        raise FileNotFoundError(f"Image not found: {image_path}")

    # Inspect header signature to determine whether dedicated PNG chunk parser should handle file
    is_png = False
    try:
        with open(path, "rb") as f:
            header = f.read(8)
            is_png = header == PNG_SIGNATURE
    except OSError:
        pass

    # Verify image integrity via Pillow
    try:
        with Image.open(path) as image:
            image.verify()
    except (SyntaxError, OSError) as exc:
        # Non-PNG files that fail verification must raise as expected by test suite
        if not is_png:
            raise

    # Open image for analysis
    try:
        pil_image = Image.open(path)
        image_format = pil_image.format or ("PNG" if is_png else "UNKNOWN")
    except Exception:
        if is_png:
            pil_image = None
            image_format = "PNG"
        else:
            raise

    try:
        findings = []
        compression_analysis = {}

        if image_format == "JPEG" and pil_image is not None:
            quant_tables = _extract_quantization_tables(pil_image)
            if quant_tables:
                compression_analysis = {
                    "quantization_table_count": len(quant_tables),
                    "quantization_tables": quant_tables,
                }
            else:
                compression_analysis = {
                    "quantization_table_count": 0,
                    "quantization_tables": None,
                    "format_note": "Quantization tables are unavailable in this JPEG bitstream.",
                }
        elif image_format == "PNG":
            png_analysis, png_findings = _analyze_png_compression(path)
            compression_analysis = png_analysis
            findings.extend(png_findings)
        else:
            compression_analysis = {
                "format_note": f"Compression analysis is not applicable for {image_format} format."
            }

        encoding_process = _extract_encoding_process(pil_image) if pil_image is not None else "Deflate / zlib compression"
        ycbcr_subsampling = _extract_chroma_subsampling(pil_image) if pil_image is not None else None
        bits_per_sample = _extract_bits_per_sample(pil_image) if pil_image is not None else None
        file_type = _extract_file_type(pil_image) if pil_image is not None else ("PNG" if is_png else "Unknown")

        # Ensure bits_per_sample reflects IHDR bit_depth if available
        if image_format == "PNG" and compression_analysis.get("ihdr"):
            bits_per_sample = compression_analysis["ihdr"].get("bit_depth", bits_per_sample)

        # ExifTool-compatible metadata dictionary populated natively without ExifTool
        exiftool_compat = {}
        if image_format == "JPEG":
            if encoding_process:
                exiftool_compat["EncodingProcess"] = encoding_process
            if ycbcr_subsampling:
                exiftool_compat["YCbCrSubSampling"] = ycbcr_subsampling
            if bits_per_sample:
                exiftool_compat["BitsPerSample"] = bits_per_sample
            if file_type:
                exiftool_compat["FileType"] = file_type

        # For PNG, no actual ExifTool executable is invoked in the runtime environment;
        # report UNAVAILABLE to avoid misleadingly claiming ExifTool itself is installed/active.
        exiftool_status = "AVAILABLE" if (image_format == "JPEG" and exiftool_compat) else "UNAVAILABLE"

        return {
            "file_name": path.name,
            "image_format": image_format,
            "compression_analysis": compression_analysis,
            "encoding_process": encoding_process,
            "ycbcr_subsampling": ycbcr_subsampling,
            "bits_per_sample": bits_per_sample,
            "file_type": file_type,
            "exiftool_compression_metadata": exiftool_compat,
            "exiftool_status": exiftool_status,
            "findings": findings,
            "analysis_timestamp": datetime.now(timezone.utc).isoformat(),
        }
    finally:
        if pil_image is not None:
            pil_image.close()
