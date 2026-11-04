"""
JPEG/PNG Compression Analysis module for ClaimGuard AI.

Inspects JPEG discrete cosine transform (DCT) quantization tables, chroma subsampling,
and bitstream encoding properties natively using Pillow.
Handles PNG images with format-specific explanations.
Missing compression properties or ordinary compression characteristics are never
interpreted as suspicious or as proof of image manipulation.
"""

from datetime import datetime, timezone
from pathlib import Path

from PIL import Image


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
    """Extract YCbCr chroma subsampling string from Pillow JPEG layer metadata."""
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
    """Extract JPEG encoding process description."""
    if getattr(image, "format", "") != "JPEG":
        return None
    info = getattr(image, "info", {})
    if info.get("progressive"):
        return "Progressive DCT, Huffman coding"
    return "Baseline DCT, Huffman coding"


def _extract_file_type(image):
    """Extract descriptive file type."""
    fmt = getattr(image, "format", "")
    if fmt == "JPEG":
        if "jfif" in getattr(image, "info", {}):
            return "JPEG / JFIF"
        return "JPEG"
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


def analyze_compression(image_path):
    """
    Analyze image compression characteristics natively using Pillow.

    For JPEG/JPG images:
    - Retains quantization tables, coefficient metrics, chroma subsampling, and encoding process.

    For PNG images:
    - Identifies PNG format correctly and provides format-specific explanation.
    - Does not report missing JPEG quantization tables as suspicious.

    Missing compression details or unsupported formats are reported as informational or
    unavailable states, never triggering human review flags.
    """
    path = Path(image_path)
    if not path.exists() or not path.is_file():
        raise FileNotFoundError(f"Image not found: {image_path}")

    # Verify image integrity
    with Image.open(path) as image:
        image.verify()

    with Image.open(path) as image:
        image_format = image.format or "UNKNOWN"
        findings = []
        compression_analysis = {}

        if image_format == "JPEG":
            quant_tables = _extract_quantization_tables(image)
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
            compression_analysis = {
                "format_note": (
                    "PNG images use lossless DEFLATE compression. "
                    "Discrete cosine transform (DCT) quantization tables are not applicable to this format."
                )
            }
        else:
            compression_analysis = {
                "format_note": f"Compression analysis is not applicable for {image_format} format."
            }

        encoding_process = _extract_encoding_process(image)
        ycbcr_subsampling = _extract_chroma_subsampling(image)
        bits_per_sample = _extract_bits_per_sample(image)
        file_type = _extract_file_type(image)

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

        return {
            "file_name": path.name,
            "image_format": image_format,
            "compression_analysis": compression_analysis,
            "encoding_process": encoding_process,
            "ycbcr_subsampling": ycbcr_subsampling,
            "bits_per_sample": bits_per_sample,
            "file_type": file_type,
            "exiftool_compression_metadata": exiftool_compat,
            "exiftool_status": "AVAILABLE" if exiftool_compat else "UNAVAILABLE",
            "findings": findings,
            "analysis_timestamp": datetime.now(timezone.utc).isoformat(),
        }
