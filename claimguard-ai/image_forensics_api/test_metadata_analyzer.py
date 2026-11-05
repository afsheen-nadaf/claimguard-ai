"""
Unit tests for the simplified metadata_analyzer module.

Verifies:
1. JPEG containing EXIF metadata.
2. JPEG without EXIF metadata.
3. PNG without EXIF metadata.
4. Image with missing GPS metadata.
5. Image with missing capture timestamp.
6. Invalid image file.
7. Missing image file.
8. Verify SHA-256 generation.
9. Verify that missing metadata does not generate fraud/review flags.
10. Verify that the response remains compatible with the existing application.
"""

import hashlib
import tempfile
import unittest
from pathlib import Path

from PIL import Image, UnidentifiedImageError

from metadata_analyzer import calculate_sha256, extract_metadata
from review_engine import generate_review


class TestMetadataAnalyzer(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp_dir = Path(tempfile.mkdtemp(prefix="claimguard_meta_test_"))

        # 1. JPEG with rich EXIF metadata
        cls.jpeg_with_exif = cls.temp_dir / "sample_with_exif.jpg"
        im = Image.new("RGB", (320, 240), color=(200, 50, 50))
        exif = im.getexif()
        exif[271] = "Sony"  # Make
        exif[272] = "ILCE-7M4"  # Model
        exif[305] = "Capture One 22"  # Software
        exif[306] = "2026:10:20 14:00:00"  # DateTime
        exif_ifd = exif.get_ifd(0x8769)
        exif_ifd[36867] = "2026:10:20 12:34:56"  # DateTimeOriginal
        gps_ifd = exif.get_ifd(0x8825)
        gps_ifd[1] = "N"  # GPSLatitudeRef
        im.save(cls.jpeg_with_exif, exif=exif)

        # 2. JPEG without EXIF metadata
        cls.jpeg_no_exif = cls.temp_dir / "sample_no_exif.jpg"
        im_no_exif = Image.new("RGB", (100, 100), color=(50, 200, 50))
        im_no_exif.save(cls.jpeg_no_exif)

        # 3. PNG without EXIF metadata
        cls.png_no_exif = cls.temp_dir / "sample_no_exif.png"
        im_png = Image.new("RGBA", (150, 80), color=(50, 50, 200, 255))
        im_png.save(cls.png_no_exif)

        # 4. JPEG with EXIF but missing GPS
        cls.jpeg_missing_gps = cls.temp_dir / "sample_missing_gps.jpg"
        im_no_gps = Image.new("RGB", (200, 150), color=(100, 100, 100))
        exif_no_gps = im_no_gps.getexif()
        exif_no_gps[271] = "Canon"
        exif_no_gps[272] = "EOS R5"
        exif_ifd_no_gps = exif_no_gps.get_ifd(0x8769)
        exif_ifd_no_gps[36867] = "2026:09:15 08:30:00"
        im_no_gps.save(cls.jpeg_missing_gps, exif=exif_no_gps)

        # 5. JPEG with EXIF but missing capture timestamp
        cls.jpeg_missing_timestamp = cls.temp_dir / "sample_missing_timestamp.jpg"
        im_no_ts = Image.new("RGB", (180, 120), color=(120, 80, 40))
        exif_no_ts = im_no_ts.getexif()
        exif_no_ts[271] = "Fujifilm"
        exif_no_ts[272] = "X-T4"
        im_no_ts.save(cls.jpeg_missing_timestamp, exif=exif_no_ts)

        # 6. Invalid image file (corrupted data)
        cls.invalid_file = cls.temp_dir / "corrupt_image.jpg"
        cls.invalid_file.write_text("This is not a valid JPEG bitstream.")

        # 7. Non-existent path
        cls.missing_file = cls.temp_dir / "non_existent_file.jpg"

    @classmethod
    def tearDownClass(cls):
        import shutil
        shutil.rmtree(cls.temp_dir, ignore_errors=True)

    def test_01_jpeg_with_exif_metadata(self):
        """Test 1: JPEG containing EXIF metadata extracts all fields accurately."""
        result = extract_metadata(self.jpeg_with_exif)

        self.assertEqual(result["image_properties"]["format"], "JPEG")
        self.assertEqual(result["image_properties"]["width"], 320)
        self.assertEqual(result["image_properties"]["height"], 240)
        self.assertGreater(result["file_size_bytes"], 0)
        self.assertEqual(result["camera_make"], "Sony")
        self.assertEqual(result["camera_model"], "ILCE-7M4")
        self.assertEqual(result["capture_timestamp"], "2026:10:20 12:34:56")
        self.assertEqual(result["software"], "Capture One 22")
        self.assertTrue(result["gps_metadata_present"])
        self.assertTrue(result["metadata_indicators"]["gps_metadata_present"])
        self.assertTrue(result["metadata_indicators"]["exif_present"])
        self.assertEqual(result["findings"], [])

    def test_02_jpeg_without_exif_metadata(self):
        """Test 2: JPEG without EXIF metadata reports unavailable, not suspicious."""
        result = extract_metadata(self.jpeg_no_exif)

        self.assertEqual(result["image_properties"]["format"], "JPEG")
        self.assertEqual(result["camera_make"], None)
        self.assertEqual(result["camera_model"], None)
        self.assertEqual(result["capture_timestamp"], None)
        self.assertEqual(result["software"], None)
        self.assertFalse(result["gps_metadata_present"])
        self.assertFalse(result["metadata_indicators"]["exif_present"])
        # Crucial: no suspicious findings generated
        self.assertEqual(result["findings"], [])

    def test_03_png_without_exif_metadata(self):
        """Test 3: PNG without EXIF metadata reports dimensions, format, and size."""
        result = extract_metadata(self.png_no_exif)

        self.assertEqual(result["image_properties"]["format"], "PNG")
        self.assertEqual(result["image_properties"]["width"], 150)
        self.assertEqual(result["image_properties"]["height"], 80)
        self.assertEqual(result["camera_make"], None)
        self.assertEqual(result["capture_timestamp"], None)
        self.assertFalse(result["gps_metadata_present"])
        self.assertEqual(result["findings"], [])

    def test_04_image_with_missing_gps_metadata(self):
        """Test 4: Missing GPS metadata is reported as not detected, not suspicious."""
        result = extract_metadata(self.jpeg_missing_gps)

        self.assertEqual(result["camera_make"], "Canon")
        self.assertEqual(result["camera_model"], "EOS R5")
        self.assertEqual(result["capture_timestamp"], "2026:09:15 08:30:00")
        self.assertFalse(result["gps_metadata_present"])
        self.assertFalse(result["metadata_indicators"]["gps_metadata_present"])
        self.assertEqual(result["findings"], [])

    def test_05_image_with_missing_capture_timestamp(self):
        """Test 5: Missing capture timestamp is reported as unavailable, not suspicious."""
        result = extract_metadata(self.jpeg_missing_timestamp)

        self.assertEqual(result["camera_make"], "Fujifilm")
        self.assertEqual(result["camera_model"], "X-T4")
        self.assertIsNone(result["capture_timestamp"])
        self.assertFalse(result["metadata_indicators"]["datetime_present"])
        self.assertEqual(result["findings"], [])

    def test_06_invalid_image_file(self):
        """Test 6: Invalid or corrupt image file raises UnidentifiedImageError or verification error."""
        with self.assertRaises((UnidentifiedImageError, ValueError, OSError)):
            extract_metadata(self.invalid_file)

    def test_07_missing_image_file(self):
        """Test 7: Missing image file raises FileNotFoundError."""
        with self.assertRaises(FileNotFoundError):
            extract_metadata(self.missing_file)

    def test_08_sha256_generation(self):
        """Test 8: Verify SHA-256 fingerprint matches cryptographic digest."""
        sha = calculate_sha256(self.jpeg_with_exif)
        self.assertEqual(len(sha), 64)

        # Independent calculation check
        expected = hashlib.sha256(self.jpeg_with_exif.read_bytes()).hexdigest()
        self.assertEqual(sha, expected)

        meta = extract_metadata(self.jpeg_with_exif)
        self.assertEqual(meta["sha256"], expected)

    def test_09_missing_metadata_does_not_generate_fraud_review_flags(self):
        """Test 9: Verify missing metadata does not trigger human review in review_engine."""
        meta_no_exif = extract_metadata(self.jpeg_no_exif)
        self.assertEqual(meta_no_exif["findings"], [])

        analyses = {
            "metadata": {"status": "COMPLETED", "result": meta_no_exif}
        }
        review = generate_review(analyses)

        self.assertFalse(review["required"])
        self.assertEqual(review["priority"], "NONE")
        self.assertEqual(review["reasons"], [])

    def test_10_response_compatibility_with_existing_application(self):
        """Test 10: Verify contract keys expected by consumers and frontend remain present."""
        result = extract_metadata(self.jpeg_with_exif)

        # Expected top-level keys
        expected_keys = {
            "file_name",
            "file_size_bytes",
            "file_extension",
            "sha256",
            "image_properties",
            "camera_make",
            "camera_model",
            "capture_timestamp",
            "software",
            "gps_metadata_present",
            "pillow_exif_metadata",
            "exiftool_metadata",
            "exiftool_status",
            "exiftool_warning",
            "file_timestamps",
            "metadata_indicators",
            "findings",
            "analysis_timestamp",
        }
        for k in expected_keys:
            self.assertIn(k, result, f"Missing contract key: {k}")

        # Image properties contract
        props = result["image_properties"]
        for pk in ("format", "width", "height", "mode", "megapixels"):
            self.assertIn(pk, props, f"Missing image_properties key: {pk}")

        # Metadata indicators contract
        indicators = result["metadata_indicators"]
        for ik in (
            "exif_present",
            "camera_make_present",
            "camera_model_present",
            "datetime_present",
            "software_field_present",
            "gps_metadata_present",
        ):
            self.assertIn(ik, indicators, f"Missing metadata_indicators key: {ik}")

        # Ensure ExifTool is safely reported as unavailable without errors
        self.assertEqual(result["exiftool_status"], "UNAVAILABLE")
        self.assertIsNone(result["exiftool_warning"])
        self.assertEqual(result["exiftool_metadata"], {})


if __name__ == "__main__":
    unittest.main()
