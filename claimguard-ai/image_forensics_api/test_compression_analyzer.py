"""
Unit tests for the compression_analyzer module (JPEG & PNG).

Verifies:
1. JPEG with standard compression information.
2. JPEG with missing or unavailable compression information.
3. PNG image basic format handling.
4. JPEG with different chroma subsampling configurations (4:4:4, 4:2:2, 4:2:0).
5. Invalid or corrupt image.
6. Missing image file.
7. Unsupported image format (BMP, etc.).
8. Ensure PNG does not produce JPEG-specific suspicious findings.
9. Ensure unavailable compression information does not trigger a review flag.
10. Verify response contract compatibility with existing consumers.
11. RGB PNG (24-bit Truecolor) compression metrics and scanline filtering.
12. RGBA PNG (32-bit Truecolor with alpha) compression metrics and scanline filtering.
13. Grayscale PNG (8-bit) compression metrics and scanline filtering.
14. Indexed / Palette PNG (8-bit palette) compression metrics and scanline filtering.
15. 1-bit and 4-bit sub-byte PNG bit depths with byte-aligned strides.
16. 16-bit high dynamic range PNG bit depth.
17. Odd image widths requiring byte-aligned scanline stride calculations.
18. Multiple IDAT chunks reassembly and verification.
19. Adam7 interlaced PNG pass calculations and safe filter skipping.
20. PNG with invalid chunk CRC checksum.
21. Truncated PNG chunk headers and payloads.
22. Missing IEND termination chunk detection.
23. Invalid IHDR container values.
24. Excessive dimensions memory guard (>50 Megapixels).
25. Decompression bomb memory limit guard (>100 MiB limit).
26. Verification that ExifTool status and chroma subsampling labels are not misleading.
"""

import math
import struct
import tempfile
import unittest
import zlib
from pathlib import Path

from PIL import Image, UnidentifiedImageError

from compression_analyzer import (
    _calculate_png_metrics,
    _extract_png_ihdr,
    analyze_compression,
)
from review_engine import generate_review


def _make_chunk(chunk_type: bytes, data: bytes, bad_crc: bool = False) -> bytes:
    """Helper to pack a standard PNG chunk with length, type, data, and CRC."""
    crc = zlib.crc32(chunk_type + data) & 0xFFFFFFFF
    if bad_crc:
        crc ^= 0xFFFFFFFF
    return struct.pack(">I", len(data)) + chunk_type + data + struct.pack(">I", crc)


def _make_synthetic_png(
    width: int,
    height: int,
    bit_depth: int,
    color_type: int,
    scanlines: bytes = b"",
    interlace: int = 0,
    idat_chunks_data: list[bytes] | None = None,
    bad_crc_chunk: str | None = None,
    omit_iend: bool = False,
    override_ihdr: bytes | None = None,
) -> bytes:
    """Helper to construct a valid or intentionally malformed synthetic PNG binary."""
    sig = b"\x89PNG\r\n\x1a\n"

    if override_ihdr is not None:
        ihdr_chunk = _make_chunk(b"IHDR", override_ihdr, bad_crc=(bad_crc_chunk == "IHDR"))
    else:
        ihdr_data = struct.pack(">IIBBBBB", width, height, bit_depth, color_type, 0, 0, interlace)
        ihdr_chunk = _make_chunk(b"IHDR", ihdr_data, bad_crc=(bad_crc_chunk == "IHDR"))

    if idat_chunks_data is not None:
        idat_chunks = b"".join(
            _make_chunk(b"IDAT", chunk_bytes, bad_crc=(bad_crc_chunk == f"IDAT_{i}" or bad_crc_chunk == "IDAT"))
            for i, chunk_bytes in enumerate(idat_chunks_data)
        )
    else:
        compressed = zlib.compress(scanlines)
        idat_chunks = _make_chunk(b"IDAT", compressed, bad_crc=(bad_crc_chunk == "IDAT"))

    iend_chunk = b"" if omit_iend else _make_chunk(b"IEND", b"", bad_crc=(bad_crc_chunk == "IEND"))
    return sig + ihdr_chunk + idat_chunks + iend_chunk


class TestCompressionAnalyzer(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp_dir = Path(tempfile.mkdtemp(prefix="claimguard_comp_test_"))

        # 1. Standard JPEG (4:2:0 default subsampling, baseline DCT)
        cls.jpeg_standard = cls.temp_dir / "standard.jpg"
        im1 = Image.new("RGB", (200, 150), color=(120, 160, 200))
        im1.save(cls.jpeg_standard, quality=80, subsampling=2)

        # 2. PNG image (RGBA)
        cls.png_image = cls.temp_dir / "sample.png"
        im_png = Image.new("RGBA", (100, 100), color=(255, 128, 0, 255))
        im_png.save(cls.png_image)

        # 3. JPEG with 4:4:4 subsampling
        cls.jpeg_444 = cls.temp_dir / "subsample_444.jpg"
        im_444 = Image.new("RGB", (160, 120), color=(50, 100, 150))
        im_444.save(cls.jpeg_444, quality=95, subsampling=0)

        # 4. JPEG with 4:2:2 subsampling
        cls.jpeg_422 = cls.temp_dir / "subsample_422.jpg"
        im_422 = Image.new("RGB", (160, 120), color=(60, 110, 160))
        im_422.save(cls.jpeg_422, quality=90, subsampling=1)

        # 5. JPEG with Progressive DCT encoding
        cls.jpeg_progressive = cls.temp_dir / "progressive.jpg"
        im_prog = Image.new("RGB", (180, 140), color=(80, 90, 100))
        im_prog.save(cls.jpeg_progressive, quality=85, progressive=True)

        # 6. Grayscale JPEG (1 layer component)
        cls.jpeg_gray = cls.temp_dir / "grayscale.jpg"
        im_gray = Image.new("L", (100, 100), color=128)
        im_gray.save(cls.jpeg_gray, quality=80)

        # 7. Unsupported image format (BMP)
        cls.bmp_image = cls.temp_dir / "sample.bmp"
        im_bmp = Image.new("RGB", (60, 60), color=(200, 200, 200))
        im_bmp.save(cls.bmp_image)

        # 8. Corrupt image file (non-image bitstream)
        cls.corrupt_file = cls.temp_dir / "corrupt.jpg"
        cls.corrupt_file.write_text("Corrupt bitstream data not an image.")

        # 9. Non-existent path
        cls.missing_file = cls.temp_dir / "non_existent.jpg"

    @classmethod
    def tearDownClass(cls):
        import shutil
        shutil.rmtree(cls.temp_dir, ignore_errors=True)

    # -----------------------------------------------------------------------
    # EXISTING TESTS (1-10) PRESERVED
    # -----------------------------------------------------------------------

    def test_01_jpeg_standard_compression_information(self):
        """Test 1: Standard JPEG extracts format, quantization tables, subsampling, and encoding."""
        result = analyze_compression(self.jpeg_standard)

        self.assertEqual(result["image_format"], "JPEG")
        self.assertEqual(result["file_name"], "standard.jpg")

        comp = result["compression_analysis"]
        self.assertIn("quantization_table_count", comp)
        self.assertGreaterEqual(comp["quantization_table_count"], 1)

        tables = comp["quantization_tables"]
        self.assertIsInstance(tables, dict)
        self.assertIn("0", tables)

        lum_table = tables["0"]
        self.assertEqual(lum_table["coefficient_count"], 64)
        self.assertGreater(lum_table["minimum"], 0)
        self.assertGreater(lum_table["maximum"], lum_table["minimum"])
        self.assertIsInstance(lum_table["mean"], float)
        self.assertEqual(len(lum_table["values"]), 64)

        self.assertEqual(result["ycbcr_subsampling"], "YCbCr4:2:0 (2 2)")
        self.assertEqual(result["encoding_process"], "Baseline DCT, Huffman coding")
        self.assertEqual(result["file_type"], "JPEG / JFIF")
        self.assertEqual(result["bits_per_sample"], 8)
        self.assertEqual(result["findings"], [])

    def test_02_jpeg_missing_or_unavailable_quantization_tables(self):
        """Test 2: JPEG with simulated missing quantization tables reports unavailable, not suspicious."""
        result = analyze_compression(self.jpeg_standard)
        self.assertIsInstance(result["compression_analysis"], dict)
        self.assertEqual(result["findings"], [])

    def test_03_png_image_handling(self):
        """Test 3: PNG format is correctly identified with format-specific explanation."""
        result = analyze_compression(self.png_image)

        self.assertEqual(result["image_format"], "PNG")
        self.assertEqual(result["file_name"], "sample.png")

        comp = result["compression_analysis"]
        self.assertIn("format_note", comp)
        self.assertIn("DEFLATE", comp["format_note"])
        self.assertNotIn("quantization_tables", comp)
        self.assertEqual(result["findings"], [])

    def test_04_chroma_subsampling_configurations(self):
        """Test 4: Verify different chroma subsampling configurations (4:4:4, 4:2:2, 4:2:0, Grayscale)."""
        res_444 = analyze_compression(self.jpeg_444)
        self.assertEqual(res_444["ycbcr_subsampling"], "YCbCr4:4:4 (1 1)")

        res_422 = analyze_compression(self.jpeg_422)
        self.assertEqual(res_422["ycbcr_subsampling"], "YCbCr4:2:2 (2 1)")

        res_420 = analyze_compression(self.jpeg_standard)
        self.assertEqual(res_420["ycbcr_subsampling"], "YCbCr4:2:0 (2 2)")

        res_gray = analyze_compression(self.jpeg_gray)
        self.assertEqual(res_gray["ycbcr_subsampling"], "Grayscale (1 component)")

    def test_05_invalid_or_corrupt_image(self):
        """Test 5: Corrupt non-image file raises UnidentifiedImageError or verification error."""
        with self.assertRaises((UnidentifiedImageError, ValueError, OSError)):
            analyze_compression(self.corrupt_file)

    def test_06_missing_image_file(self):
        """Test 6: Missing image file raises FileNotFoundError."""
        with self.assertRaises(FileNotFoundError):
            analyze_compression(self.missing_file)

    def test_07_unsupported_image_format(self):
        """Test 7: Unsupported image format returns format note and no suspicious findings."""
        result = analyze_compression(self.bmp_image)

        self.assertEqual(result["image_format"], "BMP")
        self.assertIn("format_note", result["compression_analysis"])
        self.assertEqual(result["findings"], [])

    def test_08_png_does_not_produce_jpeg_suspicious_findings(self):
        """Test 8: PNG does not produce JPEG-specific suspicious findings."""
        result = analyze_compression(self.png_image)

        for finding in result["findings"]:
            code = finding.get("code", "")
            self.assertFalse("JPEG" in code, f"Unexpected JPEG finding on PNG: {code}")
            self.assertNotEqual(finding.get("severity"), "warning")
            self.assertNotEqual(finding.get("severity"), "error")

        self.assertEqual(result["findings"], [])

    def test_09_unavailable_compression_does_not_trigger_review_flag(self):
        """Test 9: Verify unavailable compression properties do not trigger review_engine flags."""
        result_png = analyze_compression(self.png_image)
        result_std = analyze_compression(self.jpeg_standard)

        rev_png = generate_review({
            "compression": {"status": "COMPLETED", "result": result_png}
        })
        self.assertFalse(rev_png["required"])
        self.assertEqual(rev_png["priority"], "NONE")
        self.assertEqual(rev_png["reasons"], [])

        rev_std = generate_review({
            "compression": {"status": "COMPLETED", "result": result_std}
        })
        self.assertFalse(rev_std["required"])
        self.assertEqual(rev_std["priority"], "NONE")
        self.assertEqual(rev_std["reasons"], [])

    def test_10_response_contract_compatibility(self):
        """Test 10: Verify contract keys expected by app.py, review_engine.py, and frontend remain present."""
        result = analyze_compression(self.jpeg_standard)

        expected_keys = {
            "file_name",
            "image_format",
            "compression_analysis",
            "encoding_process",
            "ycbcr_subsampling",
            "bits_per_sample",
            "file_type",
            "exiftool_compression_metadata",
            "exiftool_status",
            "findings",
            "analysis_timestamp",
        }
        for k in expected_keys:
            self.assertIn(k, result, f"Missing contract key: {k}")

        compat = result["exiftool_compression_metadata"]
        self.assertEqual(compat.get("EncodingProcess"), result["encoding_process"])
        self.assertEqual(compat.get("YCbCrSubSampling"), result["ycbcr_subsampling"])
        self.assertEqual(compat.get("BitsPerSample"), result["bits_per_sample"])
        self.assertEqual(compat.get("FileType"), result["file_type"])
        self.assertEqual(result["exiftool_status"], "AVAILABLE")

    # -----------------------------------------------------------------------
    # NEW STAGE 1.5 PNG TESTS (11-26)
    # -----------------------------------------------------------------------

    def test_11_png_rgb_truecolor_analysis(self):
        """Test 11: 24-bit RGB Truecolor PNG extracts complete telemetry and filter distribution."""
        rgb_path = self.temp_dir / "test_rgb.png"
        im = Image.new("RGB", (60, 40), color=(100, 150, 200))
        im.save(rgb_path)

        result = analyze_compression(rgb_path)
        self.assertEqual(result["image_format"], "PNG")
        self.assertEqual(result["bits_per_sample"], 8)
        self.assertIsNone(result["ycbcr_subsampling"])
        self.assertEqual(result["exiftool_status"], "UNAVAILABLE")

        comp = result["compression_analysis"]
        ihdr = comp["ihdr"]
        self.assertEqual(ihdr["width"], 60)
        self.assertEqual(ihdr["height"], 40)
        self.assertEqual(ihdr["bit_depth"], 8)
        self.assertEqual(ihdr["color_type"], 2)
        self.assertEqual(ihdr["channels"], 3)
        self.assertEqual(ihdr["bits_per_pixel"], 24)

        metrics = comp["metrics"]
        expected_stride = 60 * 3  # 180 bytes
        expected_pixels = 40 * expected_stride  # 7200 bytes
        expected_scanlines = 40 * (1 + expected_stride)  # 7240 bytes
        self.assertEqual(metrics["uncompressed_pixel_bytes"], expected_pixels)
        self.assertEqual(metrics["uncompressed_scanline_bytes"], expected_scanlines)
        self.assertGreater(metrics["compressed_bytes"], 0)
        self.assertGreater(metrics["compression_ratio"], 1.0)

        fdist = comp["filter_distribution"]
        self.assertEqual(fdist["total_scanlines"], 40)
        self.assertIn(fdist["dominant_filter"], ("None", "Sub", "Up", "Average", "Paeth"))
        pct_sum = sum(f["percent"] for f in fdist["filters"].values())
        self.assertAlmostEqual(pct_sum, 100.0, delta=0.5)

    def test_12_png_rgba_telemetry(self):
        """Test 12: 32-bit RGBA Truecolor PNG with alpha channel calculates 4-channel metrics."""
        result = analyze_compression(self.png_image)
        comp = result["compression_analysis"]
        ihdr = comp["ihdr"]

        self.assertEqual(ihdr["width"], 100)
        self.assertEqual(ihdr["height"], 100)
        self.assertEqual(ihdr["color_type"], 6)
        self.assertEqual(ihdr["channels"], 4)
        self.assertEqual(ihdr["bits_per_pixel"], 32)

        metrics = comp["metrics"]
        expected_stride = 100 * 4  # 400 bytes
        self.assertEqual(metrics["uncompressed_pixel_bytes"], 100 * expected_stride)
        self.assertEqual(metrics["uncompressed_scanline_bytes"], 100 * (1 + expected_stride))

    def test_13_png_grayscale_telemetry(self):
        """Test 13: 8-bit Grayscale PNG calculates single channel scanlines."""
        gray_path = self.temp_dir / "test_gray.png"
        im = Image.new("L", (80, 50), color=128)
        im.save(gray_path)

        result = analyze_compression(gray_path)
        comp = result["compression_analysis"]
        ihdr = comp["ihdr"]

        self.assertEqual(ihdr["color_type"], 0)
        self.assertEqual(ihdr["channels"], 1)
        self.assertEqual(ihdr["bits_per_pixel"], 8)
        self.assertEqual(comp["metrics"]["uncompressed_pixel_bytes"], 80 * 50)
        self.assertEqual(comp["metrics"]["uncompressed_scanline_bytes"], 50 * (1 + 80))

    def test_14_png_indexed_palette_telemetry(self):
        """Test 14: 8-bit Indexed Palette PNG calculates single channel palette index scanlines."""
        pal_path = self.temp_dir / "test_palette.png"
        im = Image.new("P", (70, 45), color=0)
        im.putpalette([255, 0, 0, 0, 255, 0, 0, 0, 255] + [0] * 759)
        im.save(pal_path)

        result = analyze_compression(pal_path)
        comp = result["compression_analysis"]
        ihdr = comp["ihdr"]

        self.assertEqual(ihdr["color_type"], 3)
        self.assertEqual(ihdr["channels"], 1)
        self.assertEqual(ihdr["bits_per_pixel"], 8)
        self.assertEqual(ihdr["color_type_label"], "Indexed-color (Palette)")
        self.assertEqual(comp["metrics"]["uncompressed_pixel_bytes"], 70 * 45)

    def test_15_png_sub_byte_1bit_and_4bit_depths(self):
        """Test 15: Sub-byte bit depths (1-bit and 4-bit) calculate exact byte-aligned strides."""
        # A. 1-bit Grayscale PNG: width=13, height=5
        # Stride: ceil((13 * 1) / 8) = 2 bytes per scanline.
        p1_path = self.temp_dir / "test_1bit.png"
        im1 = Image.new("1", (13, 5), color=1)
        im1.save(p1_path)

        res1 = analyze_compression(p1_path)
        comp1 = res1["compression_analysis"]
        self.assertEqual(comp1["ihdr"]["bit_depth"], 1)
        self.assertEqual(comp1["ihdr"]["bits_per_pixel"], 1)
        self.assertEqual(comp1["metrics"]["uncompressed_pixel_bytes"], 5 * 2)  # 10 bytes
        self.assertEqual(comp1["metrics"]["uncompressed_scanline_bytes"], 5 * (1 + 2))  # 15 bytes

        # B. Synthetic 4-bit Grayscale PNG: width=5, height=3
        # Stride: ceil((5 * 4) / 8) = ceil(20 / 8) = 3 bytes per scanline.
        p4_path = self.temp_dir / "test_4bit.png"
        scanlines_4bit = b"\x00\x12\x34\x50" * 3  # filter 0 (None) + 3 bytes
        p4_bytes = _make_synthetic_png(width=5, height=3, bit_depth=4, color_type=0, scanlines=scanlines_4bit)
        p4_path.write_bytes(p4_bytes)

        res4 = analyze_compression(p4_path)
        comp4 = res4["compression_analysis"]
        self.assertEqual(comp4["ihdr"]["bit_depth"], 4)
        self.assertEqual(comp4["ihdr"]["bits_per_pixel"], 4)
        self.assertEqual(comp4["metrics"]["uncompressed_pixel_bytes"], 3 * 3)  # 9 bytes
        self.assertEqual(comp4["metrics"]["uncompressed_scanline_bytes"], 3 * (1 + 3))  # 12 bytes
        self.assertEqual(comp4["filter_distribution"]["filters"]["none"]["count"], 3)

    def test_16_png_16bit_depth_telemetry(self):
        """Test 16: 16-bit Grayscale PNG calculates 2-byte channel strides."""
        p16_path = self.temp_dir / "test_16bit.png"
        im16 = Image.new("I;16", (25, 12), color=5000)
        im16.save(p16_path)

        res16 = analyze_compression(p16_path)
        comp16 = res16["compression_analysis"]
        self.assertEqual(comp16["ihdr"]["bit_depth"], 16)
        self.assertEqual(comp16["ihdr"]["bits_per_pixel"], 16)
        self.assertEqual(res16["bits_per_sample"], 16)
        self.assertEqual(comp16["metrics"]["uncompressed_pixel_bytes"], 12 * (25 * 2))  # 600 bytes

    def test_17_png_odd_image_widths_stride_alignment(self):
        """Test 17: Odd image widths maintain exact scanline stride alignment without offset drift."""
        # RGB width=17 (bpp=24): stride = ceil(17 * 3) = 51 bytes; line size = 52 bytes.
        odd_rgb = self.temp_dir / "test_odd_rgb.png"
        Image.new("RGB", (17, 7), color=(10, 20, 30)).save(odd_rgb)

        res_rgb = analyze_compression(odd_rgb)
        comp_rgb = res_rgb["compression_analysis"]
        self.assertEqual(comp_rgb["metrics"]["uncompressed_pixel_bytes"], 7 * 51)
        self.assertEqual(comp_rgb["metrics"]["uncompressed_scanline_bytes"], 7 * 52)
        self.assertEqual(comp_rgb["filter_distribution"]["total_scanlines"], 7)

        # RGBA width=11 (bpp=32): stride = 44 bytes; line size = 45 bytes.
        odd_rgba = self.temp_dir / "test_odd_rgba.png"
        Image.new("RGBA", (11, 9), color=(1, 2, 3, 4)).save(odd_rgba)

        res_rgba = analyze_compression(odd_rgba)
        comp_rgba = res_rgba["compression_analysis"]
        self.assertEqual(comp_rgba["metrics"]["uncompressed_pixel_bytes"], 9 * 44)
        self.assertEqual(comp_rgba["metrics"]["uncompressed_scanline_bytes"], 9 * 45)
        self.assertEqual(comp_rgba["filter_distribution"]["total_scanlines"], 9)

    def test_18_png_multiple_idat_chunks(self):
        """Test 18: Multiple IDAT chunks are properly aggregated, measured, and decompressed."""
        multi_path = self.temp_dir / "test_multi_idat.png"
        raw_scanlines = b"".join(b"\x02" + b"\x10" * 30 for _ in range(5))  # 5 lines of filter 2 (Up)
        compressed = zlib.compress(raw_scanlines)

        # Partition compressed stream into 3 distinct IDAT chunks
        chunk1 = compressed[:10]
        chunk2 = compressed[10:20]
        chunk3 = compressed[20:]
        multi_bytes = _make_synthetic_png(
            width=10,
            height=5,
            bit_depth=8,
            color_type=2,
            idat_chunks_data=[chunk1, chunk2, chunk3],
        )
        multi_path.write_bytes(multi_bytes)

        res = analyze_compression(multi_path)
        comp = res["compression_analysis"]
        idat = comp["idat"]

        self.assertEqual(idat["chunk_count"], 3)
        self.assertEqual(idat["chunk_sizes"], [len(chunk1), len(chunk2), len(chunk3)])
        self.assertEqual(idat["total_compressed_bytes"], len(compressed))
        self.assertEqual(comp["filter_distribution"]["dominant_filter"], "Up")
        self.assertEqual(comp["filter_distribution"]["filters"]["up"]["count"], 5)

    def test_19_png_adam7_interlaced_handling(self):
        """Test 19: Adam7 interlacing calculates 7-pass byte bounds and safely omits linear filter distribution."""
        # For a 10x10 RGB image (bpp=24):
        # Pass 1: 2x2 -> stride=6, line=7 -> 14 bytes
        # Pass 2: 1x2 -> stride=3, line=4 -> 8 bytes
        # Pass 3: 3x1 -> stride=9, line=10 -> 10 bytes
        # Pass 4: 2x3 -> stride=6, line=7 -> 21 bytes
        # Pass 5: 5x2 -> stride=15, line=16 -> 32 bytes
        # Pass 6: 5x5 -> stride=15, line=16 -> 80 bytes
        # Pass 7: 10x5 -> stride=30, line=31 -> 155 bytes
        # Total uncompressed scanline bytes = 320 bytes (vs 310 for non-interlaced)
        adam7_path = self.temp_dir / "test_adam7.png"
        raw_bytes = bytearray(self.png_image.read_bytes())
        # Set interlace_method byte in IHDR (offset 28) to 1
        raw_bytes[28] = 1
        ihdr_crc = zlib.crc32(raw_bytes[12:29]) & 0xFFFFFFFF
        raw_bytes[29:33] = struct.pack(">I", ihdr_crc)
        adam7_path.write_bytes(raw_bytes)

        res = analyze_compression(adam7_path)
        comp = res["compression_analysis"]

        self.assertEqual(comp["ihdr"]["interlace_method"], 1)
        self.assertEqual(comp["ihdr"]["interlace_method_label"], "Adam7 interlaced")
        self.assertIsNone(comp["filter_distribution"])
        self.assertIn("filter_distribution_note", comp)
        self.assertIn("Adam7", comp["filter_distribution_note"])

        # Validate formula accounts for all passes
        adam7_calc = _calculate_png_metrics({"width": 10, "height": 10, "bits_per_pixel": 24, "interlace_method": 1}, 100)
        self.assertEqual(adam7_calc["uncompressed_pixel_bytes"], 300)
        self.assertEqual(adam7_calc["uncompressed_scanline_bytes"], 320)

    def test_20_png_invalid_crc_handling(self):
        """Test 20: Chunk with invalid CRC produces informational finding without crashing."""
        bad_crc_path = self.temp_dir / "test_bad_crc.png"
        raw_scanlines = b"".join(b"\x00" + b"\x10" * 30 for _ in range(5))
        bad_png = _make_synthetic_png(
            width=10,
            height=5,
            bit_depth=8,
            color_type=2,
            scanlines=raw_scanlines,
            bad_crc_chunk="IDAT",
        )
        bad_crc_path.write_bytes(bad_png)

        res = analyze_compression(bad_crc_path)
        codes = [f["code"] for f in res["findings"]]
        self.assertIn("PNG_CRC_MISMATCH", codes)
        self.assertEqual(res["image_format"], "PNG")

        # Verify all findings remain strictly informational
        for f in res["findings"]:
            self.assertEqual(f["severity"], "informational")

    def test_21_png_truncated_chunks(self):
        """Test 21: Truncated chunk payload produces informational finding gracefully."""
        trunc_path = self.temp_dir / "test_trunc.png"
        ihdr_data = struct.pack(">IIBBBBB", 10, 10, 8, 2, 0, 0, 0)
        ihdr_chunk = _make_chunk(b"IHDR", ihdr_data)
        # Declares 50 bytes payload, but only 10 bytes present
        truncated_chunk = struct.pack(">I", 50) + b"tEXt" + b"1234567890"
        trunc_bytes = b"\x89PNG\r\n\x1a\n" + ihdr_chunk + truncated_chunk
        trunc_path.write_bytes(trunc_bytes)

        res = analyze_compression(trunc_path)
        codes = [f["code"] for f in res["findings"]]
        self.assertIn("PNG_TRUNCATED_CHUNK_DATA", codes)
        self.assertEqual(res["image_format"], "PNG")

    def test_22_png_missing_iend(self):
        """Test 22: Bitstream terminating without IEND chunk is detected gracefully."""
        no_iend_path = self.temp_dir / "test_no_iend.png"
        raw_scanlines = b"".join(b"\x00" + b"\x10" * 30 for _ in range(5))
        no_iend_bytes = _make_synthetic_png(
            width=10,
            height=5,
            bit_depth=8,
            color_type=2,
            scanlines=raw_scanlines,
            omit_iend=True,
        )
        no_iend_path.write_bytes(no_iend_bytes)

        res = analyze_compression(no_iend_path)
        codes = [f["code"] for f in res["findings"]]
        self.assertIn("PNG_MISSING_IEND", codes)

    def test_23_png_invalid_ihdr_values(self):
        """Test 23: Invalid IHDR fields (illegal color type, bit depth) are rejected safely."""
        # Direct extraction test on invalid color type 5
        bad_ihdr_data = struct.pack(">IIBBBBB", 10, 10, 8, 5, 0, 0, 0)
        with self.assertRaises(ValueError):
            _extract_png_ihdr(bad_ihdr_data)

        # Full analyze_compression pipeline on synthetic PNG with invalid color type
        bad_ihdr_path = self.temp_dir / "test_bad_ihdr.png"
        bad_ihdr_bytes = _make_synthetic_png(
            width=10,
            height=10,
            bit_depth=8,
            color_type=2,
            override_ihdr=bad_ihdr_data,
        )
        bad_ihdr_path.write_bytes(bad_ihdr_bytes)

        res = analyze_compression(bad_ihdr_path)
        codes = [f["code"] for f in res["findings"]]
        self.assertIn("PNG_ANALYSIS_ERROR", codes)
        self.assertIsNone(res["compression_analysis"]["ihdr"])

    def test_24_png_excessive_dimensions_guard(self):
        """Test 24: Images with excessive dimensions (>50 MP) safely skip in-memory decompression."""
        large_path = self.temp_dir / "test_large.png"
        # 10,000 x 6,000 = 60 Megapixels (>50 MP limit)
        large_bytes = _make_synthetic_png(
            width=10000,
            height=6000,
            bit_depth=8,
            color_type=2,
            scanlines=b"dummy",
        )
        large_path.write_bytes(large_bytes)

        res = analyze_compression(large_path)
        codes = [f["code"] for f in res["findings"]]
        self.assertIn("PNG_DIMENSION_LIMIT_EXCEEDED", codes)
        self.assertIsNone(res["compression_analysis"]["filter_distribution"])

    def test_25_png_decompression_bomb_guard(self):
        """Test 25: Bounded zlib decompression halts stream exceeding 100 MiB safety limit."""
        bomb_path = self.temp_dir / "test_bomb.png"
        # 100 MiB + 1024 bytes of compressed zeros (~100 KiB compressed)
        bomb_raw = b"\x00" * (100 * 1024 * 1024 + 1024)
        bomb_compressed = zlib.compress(bomb_raw)

        bomb_bytes = _make_synthetic_png(
            width=10,
            height=10,
            bit_depth=8,
            color_type=2,
            idat_chunks_data=[bomb_compressed],
        )
        bomb_path.write_bytes(bomb_bytes)

        res = analyze_compression(bomb_path)
        codes = [f["code"] for f in res["findings"]]
        self.assertIn("PNG_DECOMPRESSION_BOMB_PREVENTED", codes)
        self.assertIsNone(res["compression_analysis"]["filter_distribution"])

    def test_26_png_metadata_labels_and_chroma_not_misleading(self):
        """Test 26: ExifTool status is UNAVAILABLE and chroma subsampling is None for PNG."""
        result = analyze_compression(self.png_image)

        # Verify ExifTool is not misleadingly reported as available when not installed/invoked
        self.assertEqual(result["exiftool_status"], "UNAVAILABLE")
        self.assertEqual(result["exiftool_compression_metadata"], {})

        # Verify PNG color information is not presented as JPEG chroma subsampling
        self.assertIsNone(result["ycbcr_subsampling"])

        # Verify color details are properly located in IHDR
        ihdr = result["compression_analysis"]["ihdr"]
        self.assertEqual(ihdr["color_type_label"], "Truecolor with alpha (RGBA)")
        self.assertEqual(ihdr["channels"], 4)
        self.assertEqual(ihdr["bits_per_pixel"], 32)


if __name__ == "__main__":
    unittest.main()
