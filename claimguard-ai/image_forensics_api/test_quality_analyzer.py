"""
Unit tests for the improved quality_analyzer module.

Verifies:
1. Sharp image.
2. Blurry image.
3. Dark/underexposed image.
4. Bright/overexposed image.
5. Low-contrast image.
6. High-contrast image.
7. Low-resolution image.
8. Different image formats (JPEG, PNG).
9. Invalid/corrupt image.
10. Missing image file.
11. Confirm descriptive quality warnings do not incorrectly imply fraud.
12. Verify response contract compatibility.
13. Portrait 480 × 640 image is classified as sufficient resolution.
14. Landscape 640 × 480 image is classified as sufficient resolution.
15. Portrait and landscape images below minimum resolution are classified as low resolution.
16. Zero and negative minimum dimensions are rejected.
17. Negative metric thresholds are rejected.
18. Non-numeric and infinite threshold values are rejected.
19. Brightness thresholds in the wrong order are rejected.
20. Contrast thresholds in the wrong order are rejected.
21. Default configuration works when environment variables are absent.
"""

import tempfile
import unittest
from pathlib import Path

import numpy as np
from PIL import Image

from quality_analyzer import (
    analyze_image_quality,
    get_quality_thresholds,
    BLUR_THRESHOLD,
    DARK_THRESHOLD,
    BRIGHT_THRESHOLD,
    LOW_CONTRAST_THRESHOLD,
    HIGH_CONTRAST_THRESHOLD,
    MIN_RECOMMENDED_WIDTH,
    MIN_RECOMMENDED_HEIGHT,
)
from review_engine import generate_review


class TestQualityAnalyzer(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp_dir = Path(tempfile.mkdtemp(prefix="claimguard_quality_test_"))

        # Width=800, Height=600 is >= 640x480 (sufficient resolution)
        # 1. Sharp image (high-frequency checkerboard pattern)
        arr_sharp = np.zeros((600, 800), dtype=np.uint8)
        arr_sharp[::4, :] = 255
        arr_sharp[:, ::4] = 255
        cls.sharp_image = cls.temp_dir / "sharp.jpg"
        Image.fromarray(arr_sharp).save(cls.sharp_image, quality=95)

        # 2. Blurry image (solid gray, variance = 0)
        arr_blur = np.full((600, 800), 128, dtype=np.uint8)
        cls.blurry_image = cls.temp_dir / "blurry.jpg"
        Image.fromarray(arr_blur).save(cls.blurry_image, quality=85)

        # 3. Dark/underexposed image (mean ~ 20)
        arr_dark = np.full((600, 800), 20, dtype=np.uint8)
        cls.dark_image = cls.temp_dir / "dark.jpg"
        Image.fromarray(arr_dark).save(cls.dark_image, quality=85)

        # 4. Bright/overexposed image (mean ~ 240)
        arr_bright = np.full((600, 800), 240, dtype=np.uint8)
        cls.bright_image = cls.temp_dir / "bright.jpg"
        Image.fromarray(arr_bright).save(cls.bright_image, quality=85)

        # 5. Low-contrast image (narrow variance around 128)
        arr_low_c = np.full((600, 800), 128, dtype=np.uint8)
        arr_low_c[::2, ::2] = 132
        cls.low_contrast_image = cls.temp_dir / "low_contrast.jpg"
        Image.fromarray(arr_low_c).save(cls.low_contrast_image, quality=85)

        # 6. High-contrast image (half black, half white, std dev > 75)
        arr_high_c = np.zeros((600, 800), dtype=np.uint8)
        arr_high_c[:, :400] = 255
        cls.high_contrast_image = cls.temp_dir / "high_contrast.jpg"
        Image.fromarray(arr_high_c).save(cls.high_contrast_image, quality=85)

        # 7. Low-resolution image (width=300, height=200 < 640x480)
        arr_low_res = np.full((200, 300), 128, dtype=np.uint8)
        cls.low_res_image = cls.temp_dir / "low_res.jpg"
        Image.fromarray(arr_low_res).save(cls.low_res_image, quality=85)

        # 8. PNG format image
        cls.png_image = cls.temp_dir / "sample.png"
        Image.fromarray(arr_sharp).save(cls.png_image)

        # 9. Portrait 480 × 640 image
        arr_portrait_vga = np.zeros((640, 480), dtype=np.uint8)
        arr_portrait_vga[::4, :] = 255
        cls.portrait_vga = cls.temp_dir / "portrait_480x640.jpg"
        Image.fromarray(arr_portrait_vga).save(cls.portrait_vga, quality=90)

        # 10. Landscape 640 × 480 image
        arr_landscape_vga = np.zeros((480, 640), dtype=np.uint8)
        arr_landscape_vga[::4, :] = 255
        cls.landscape_vga = cls.temp_dir / "landscape_640x480.jpg"
        Image.fromarray(arr_landscape_vga).save(cls.landscape_vga, quality=90)

        # 11. Portrait below minimum: 240 × 320
        arr_portrait_sub = np.full((320, 240), 128, dtype=np.uint8)
        cls.portrait_sub = cls.temp_dir / "portrait_240x320.jpg"
        Image.fromarray(arr_portrait_sub).save(cls.portrait_sub, quality=85)

        # 12. Landscape below minimum: 320 × 240
        arr_landscape_sub = np.full((240, 320), 128, dtype=np.uint8)
        cls.landscape_sub = cls.temp_dir / "landscape_320x240.jpg"
        Image.fromarray(arr_landscape_sub).save(cls.landscape_sub, quality=85)

        # 13. Corrupt/invalid image
        cls.corrupt_image = cls.temp_dir / "corrupt.jpg"
        cls.corrupt_image.write_text("Not an image data stream.")

        # 14. Non-existent path
        cls.missing_image = cls.temp_dir / "non_existent.jpg"

    @classmethod
    def tearDownClass(cls):
        import shutil
        shutil.rmtree(cls.temp_dir, ignore_errors=True)

    def test_01_sharp_image(self):
        """Test 1: Sharp image has Laplacian variance >= threshold and Sharp label."""
        result = analyze_image_quality(self.sharp_image)
        q = result["image_quality"]
        assessment = result["quality_assessment"]

        self.assertGreaterEqual(q["blur_score"], BLUR_THRESHOLD)
        self.assertEqual(q["sharpness_label"], "Sharp")
        self.assertEqual(assessment["sharpness"], "Sharp")

    def test_02_blurry_image(self):
        """Test 2: Blurry image has low Laplacian variance, Blurry label, and POSSIBLY_BLURRY finding."""
        result = analyze_image_quality(self.blurry_image)
        q = result["image_quality"]
        assessment = result["quality_assessment"]

        self.assertLess(q["blur_score"], BLUR_THRESHOLD)
        self.assertEqual(q["sharpness_label"], "Blurry")
        self.assertEqual(assessment["sharpness"], "Blurry")

        codes = [f["code"] for f in result["findings"]]
        self.assertIn("POSSIBLY_BLURRY", codes)

        blur_finding = next(f for f in result["findings"] if f["code"] == "POSSIBLY_BLURRY")
        self.assertEqual(blur_finding["severity"], "informational")
        self.assertEqual(blur_finding["category"], "evidence_quality")
        self.assertIn("motion blur", blur_finding["message"].lower())

    def test_03_dark_underexposed_image(self):
        """Test 3: Dark image has brightness < DARK_THRESHOLD, Underexposed label, and LOW_BRIGHTNESS finding."""
        result = analyze_image_quality(self.dark_image)
        q = result["image_quality"]

        self.assertLess(q["brightness_score"], DARK_THRESHOLD)
        self.assertEqual(q["exposure_label"], "Underexposed")

        codes = [f["code"] for f in result["findings"]]
        self.assertIn("LOW_BRIGHTNESS", codes)

        dark_finding = next(f for f in result["findings"] if f["code"] == "LOW_BRIGHTNESS")
        self.assertEqual(dark_finding["severity"], "informational")
        self.assertIn("underexposure", dark_finding["message"].lower())

    def test_04_bright_overexposed_image(self):
        """Test 4: Bright image has brightness > BRIGHT_THRESHOLD, Overexposed label, and HIGH_BRIGHTNESS finding."""
        result = analyze_image_quality(self.bright_image)
        q = result["image_quality"]

        self.assertGreater(q["brightness_score"], BRIGHT_THRESHOLD)
        self.assertEqual(q["exposure_label"], "Overexposed")

        codes = [f["code"] for f in result["findings"]]
        self.assertIn("HIGH_BRIGHTNESS", codes)

        bright_finding = next(f for f in result["findings"] if f["code"] == "HIGH_BRIGHTNESS")
        self.assertEqual(bright_finding["severity"], "informational")
        self.assertIn("overexposure", bright_finding["message"].lower())

    def test_05_low_contrast_image(self):
        """Test 5: Low-contrast image has contrast < LOW_CONTRAST_THRESHOLD and LOW_CONTRAST finding."""
        result = analyze_image_quality(self.low_contrast_image)
        q = result["image_quality"]

        self.assertLess(q["contrast_score"], LOW_CONTRAST_THRESHOLD)
        self.assertEqual(q["contrast_label"], "Low contrast")

        codes = [f["code"] for f in result["findings"]]
        self.assertIn("LOW_CONTRAST", codes)

    def test_06_high_contrast_image(self):
        """Test 6: High-contrast image has contrast > HIGH_CONTRAST_THRESHOLD and High contrast label."""
        result = analyze_image_quality(self.high_contrast_image)
        q = result["image_quality"]

        self.assertGreater(q["contrast_score"], HIGH_CONTRAST_THRESHOLD)
        self.assertEqual(q["contrast_label"], "High contrast")

    def test_07_low_resolution_image(self):
        """Test 7: Low-resolution image produces LOW_RESOLUTION finding describing evidence usability."""
        result = analyze_image_quality(self.low_res_image)
        q = result["image_quality"]

        self.assertLess(q["width"], MIN_RECOMMENDED_WIDTH)
        self.assertEqual(q["resolution_label"], "Low resolution")

        codes = [f["code"] for f in result["findings"]]
        self.assertIn("LOW_RESOLUTION", codes)

        res_finding = next(f for f in result["findings"] if f["code"] == "LOW_RESOLUTION")
        self.assertEqual(res_finding["severity"], "informational")
        self.assertIn("inspect", res_finding["message"].lower())

    def test_08_supported_formats_png_and_jpeg(self):
        """Test 8: Quality analysis works consistently across PNG and JPEG formats."""
        res_jpg = analyze_image_quality(self.sharp_image)
        res_png = analyze_image_quality(self.png_image)

        self.assertIsInstance(res_jpg["image_quality"]["blur_score"], float)
        self.assertIsInstance(res_png["image_quality"]["blur_score"], float)
        self.assertEqual(res_jpg["image_quality"]["width"], res_png["image_quality"]["width"])
        self.assertEqual(res_jpg["image_quality"]["height"], res_png["image_quality"]["height"])

    def test_09_invalid_or_corrupt_image(self):
        """Test 9: Invalid or corrupt image file raises ValueError."""
        with self.assertRaises(ValueError):
            analyze_image_quality(self.corrupt_image)

    def test_10_missing_image_file(self):
        """Test 10: Missing image file raises FileNotFoundError."""
        with self.assertRaises(FileNotFoundError):
            analyze_image_quality(self.missing_image)

    def test_11_quality_warnings_do_not_incorrectly_imply_fraud(self):
        """Test 11: Descriptive quality warnings do not trigger human review or fraud warnings in review_engine."""
        res_blurry = analyze_image_quality(self.blurry_image)
        res_dark = analyze_image_quality(self.dark_image)
        res_low_res = analyze_image_quality(self.low_res_image)

        for res, name in [
            (res_blurry, "blurry"),
            (res_dark, "dark"),
            (res_low_res, "low resolution"),
        ]:
            for finding in res["findings"]:
                msg = finding["message"].lower()
                self.assertNotIn("fraud", msg)
                self.assertNotIn("tampered", msg)
                self.assertNotIn("manipulat", msg)
                self.assertNotIn("synthetic", msg)
                self.assertNotIn("fake", msg)
                self.assertEqual(finding["severity"], "informational")

            review = generate_review({
                "imageQuality": {"status": "COMPLETED", "result": res}
            })
            self.assertFalse(
                review["required"],
                f"Quality warnings on {name} image should not trigger fraud review flag."
            )
            self.assertEqual(review["reasons"], [])

    def test_12_response_contract_compatibility(self):
        """Test 12: Verify all expected dictionary keys are present for frontend and app.py."""
        result = analyze_image_quality(self.sharp_image)

        expected_keys = {
            "file_name",
            "image_quality",
            "quality_assessment",
            "findings",
            "analysis_timestamp",
            "disclaimer",
            "implementation",
        }
        for k in expected_keys:
            self.assertIn(k, result, f"Missing contract key: {k}")

        q_keys = {
            "width",
            "height",
            "megapixels",
            "blur_score",
            "brightness_score",
            "contrast_score",
            "noise_estimate",
            "sharpness_label",
            "exposure_label",
            "contrast_label",
            "resolution_label",
        }
        for qk in q_keys:
            self.assertIn(qk, result["image_quality"], f"Missing image_quality key: {qk}")

        self.assertIn("usable_for_inspection", result["quality_assessment"])

    # -------------------------------------------------------------
    # Orientation-independent resolution tests
    # -------------------------------------------------------------

    def test_13_portrait_480x640_classified_as_sufficient_resolution(self):
        """Test 13: Portrait 480 × 640 image is classified as sufficient resolution."""
        result = analyze_image_quality(self.portrait_vga)
        q = result["image_quality"]
        assessment = result["quality_assessment"]

        self.assertEqual(q["width"], 480)
        self.assertEqual(q["height"], 640)
        self.assertEqual(q["resolution_label"], "Sufficient")
        self.assertEqual(assessment["resolution"], "Sufficient")

        codes = [f["code"] for f in result["findings"]]
        self.assertNotIn("LOW_RESOLUTION", codes)

    def test_14_landscape_640x480_classified_as_sufficient_resolution(self):
        """Test 14: Landscape 640 × 480 image is classified as sufficient resolution."""
        result = analyze_image_quality(self.landscape_vga)
        q = result["image_quality"]
        assessment = result["quality_assessment"]

        self.assertEqual(q["width"], 640)
        self.assertEqual(q["height"], 480)
        self.assertEqual(q["resolution_label"], "Sufficient")
        self.assertEqual(assessment["resolution"], "Sufficient")

        codes = [f["code"] for f in result["findings"]]
        self.assertNotIn("LOW_RESOLUTION", codes)

    def test_15_portrait_and_landscape_below_minimum_are_low_resolution(self):
        """Test 15: Portrait (240x320) and landscape (320x240) below minimum are classified as Low resolution."""
        res_portrait = analyze_image_quality(self.portrait_sub)
        self.assertEqual(res_portrait["image_quality"]["resolution_label"], "Low resolution")
        codes_portrait = [f["code"] for f in res_portrait["findings"]]
        self.assertIn("LOW_RESOLUTION", codes_portrait)

        res_landscape = analyze_image_quality(self.landscape_sub)
        self.assertEqual(res_landscape["image_quality"]["resolution_label"], "Low resolution")
        codes_landscape = [f["code"] for f in res_landscape["findings"]]
        self.assertIn("LOW_RESOLUTION", codes_landscape)

    # -------------------------------------------------------------
    # Environment variable validation tests
    # -------------------------------------------------------------

    def test_16_zero_and_negative_minimum_dimensions_rejected(self):
        """Test 16: Zero and negative minimum dimensions produce configuration ValueError."""
        with self.assertRaises(ValueError) as ctx_zero_w:
            get_quality_thresholds({"QUALITY_MIN_WIDTH": "0"})
        self.assertIn("positive integer", str(ctx_zero_w.exception))

        with self.assertRaises(ValueError) as ctx_neg_w:
            get_quality_thresholds({"QUALITY_MIN_WIDTH": "-10"})
        self.assertIn("positive integer", str(ctx_neg_w.exception))

        with self.assertRaises(ValueError) as ctx_zero_h:
            get_quality_thresholds({"QUALITY_MIN_HEIGHT": "0"})
        self.assertIn("positive integer", str(ctx_zero_h.exception))

        with self.assertRaises(ValueError) as ctx_neg_h:
            get_quality_thresholds({"QUALITY_MIN_HEIGHT": "-480"})
        self.assertIn("positive integer", str(ctx_neg_h.exception))

    def test_17_negative_metric_thresholds_rejected(self):
        """Test 17: Negative metric thresholds produce configuration ValueError."""
        with self.assertRaises(ValueError) as ctx_blur:
            get_quality_thresholds({"QUALITY_BLUR_THRESHOLD": "-1.0"})
        self.assertIn("non-negative", str(ctx_blur.exception))

        with self.assertRaises(ValueError) as ctx_dark:
            get_quality_thresholds({"QUALITY_DARK_THRESHOLD": "-5.0"})
        self.assertIn("non-negative", str(ctx_dark.exception))

        with self.assertRaises(ValueError) as ctx_bright:
            get_quality_thresholds({"QUALITY_BRIGHT_THRESHOLD": "-10.0"})
        self.assertIn("non-negative", str(ctx_bright.exception))

        with self.assertRaises(ValueError) as ctx_low_c:
            get_quality_thresholds({"QUALITY_LOW_CONTRAST_THRESHOLD": "-0.5"})
        self.assertIn("non-negative", str(ctx_low_c.exception))

        with self.assertRaises(ValueError) as ctx_high_c:
            get_quality_thresholds({"QUALITY_HIGH_CONTRAST_THRESHOLD": "-1.0"})
        self.assertIn("non-negative", str(ctx_high_c.exception))

    def test_18_non_numeric_and_infinite_thresholds_rejected(self):
        """Test 18: Non-numeric and infinite/NaN threshold values produce configuration ValueError."""
        with self.assertRaises(ValueError) as ctx_alpha:
            get_quality_thresholds({"QUALITY_BLUR_THRESHOLD": "not_a_number"})
        self.assertIn("valid number", str(ctx_alpha.exception))

        with self.assertRaises(ValueError) as ctx_inf:
            get_quality_thresholds({"QUALITY_BLUR_THRESHOLD": "inf"})
        self.assertIn("finite number", str(ctx_inf.exception))

        with self.assertRaises(ValueError) as ctx_nan:
            get_quality_thresholds({"QUALITY_DARK_THRESHOLD": "nan"})
        self.assertIn("finite number", str(ctx_nan.exception))

        with self.assertRaises(ValueError) as ctx_bad_w:
            get_quality_thresholds({"QUALITY_MIN_WIDTH": "invalid"})
        self.assertIn("valid integer", str(ctx_bad_w.exception))

    def test_19_brightness_thresholds_wrong_order_rejected(self):
        """Test 19: QUALITY_BRIGHT_THRESHOLD <= QUALITY_DARK_THRESHOLD produces configuration ValueError."""
        # Brightness equal to dark threshold
        with self.assertRaises(ValueError) as ctx_eq:
            get_quality_thresholds({"QUALITY_DARK_THRESHOLD": "100.0", "QUALITY_BRIGHT_THRESHOLD": "100.0"})
        self.assertIn("greater than QUALITY_DARK_THRESHOLD", str(ctx_eq.exception))

        # Brightness less than dark threshold
        with self.assertRaises(ValueError) as ctx_lt:
            get_quality_thresholds({"QUALITY_DARK_THRESHOLD": "150.0", "QUALITY_BRIGHT_THRESHOLD": "50.0"})
        self.assertIn("greater than QUALITY_DARK_THRESHOLD", str(ctx_lt.exception))

    def test_20_contrast_thresholds_wrong_order_rejected(self):
        """Test 20: QUALITY_HIGH_CONTRAST_THRESHOLD <= QUALITY_LOW_CONTRAST_THRESHOLD produces configuration ValueError."""
        # High contrast equal to low contrast threshold
        with self.assertRaises(ValueError) as ctx_eq:
            get_quality_thresholds({"QUALITY_LOW_CONTRAST_THRESHOLD": "50.0", "QUALITY_HIGH_CONTRAST_THRESHOLD": "50.0"})
        self.assertIn("greater than QUALITY_LOW_CONTRAST_THRESHOLD", str(ctx_eq.exception))

        # High contrast less than low contrast threshold
        with self.assertRaises(ValueError) as ctx_lt:
            get_quality_thresholds({"QUALITY_LOW_CONTRAST_THRESHOLD": "60.0", "QUALITY_HIGH_CONTRAST_THRESHOLD": "20.0"})
        self.assertIn("greater than QUALITY_LOW_CONTRAST_THRESHOLD", str(ctx_lt.exception))

    def test_21_default_configuration_works_when_env_vars_absent(self):
        """Test 21: Default configuration loads and validates accurately when environment variables are absent."""
        defaults = get_quality_thresholds({})

        self.assertEqual(defaults["min_width"], 640)
        self.assertEqual(defaults["min_height"], 480)
        self.assertEqual(defaults["blur_threshold"], 50.0)
        self.assertEqual(defaults["dark_threshold"], 40.0)
        self.assertEqual(defaults["bright_threshold"], 215.0)
        self.assertEqual(defaults["low_contrast_threshold"], 25.0)
        self.assertEqual(defaults["high_contrast_threshold"], 75.0)

        # Test analysis with clean empty env dictionary
        res = analyze_image_quality(self.sharp_image, thresholds=defaults)
        self.assertEqual(res["image_quality"]["sharpness_label"], "Sharp")
        self.assertEqual(res["quality_assessment"]["resolution"], "Sufficient")

    def test_22_large_png_downscaled_proxy_preserves_original_dimensions(self):
        """Test 22: Large PNG (>2048 px) is proxy-downscaled for NumPy analysis while preserving original dimensions."""
        large_png = self.temp_dir / "large_photo.png"
        Image.new("RGB", (3000, 2400), color=(100, 150, 200)).save(large_png)

        res = analyze_image_quality(large_png)
        q = res["image_quality"]

        # Original dimensions must be preserved
        self.assertEqual(q["width"], 3000)
        self.assertEqual(q["height"], 2400)
        self.assertEqual(q["megapixels"], 7.2)

        # Proxy downscaling metrics
        self.assertTrue(q["analysis_downscaled"])
        self.assertEqual(q["analyzed_width"], 2048)
        self.assertEqual(q["analyzed_height"], 1638)

        # Metrics are still computed and valid
        self.assertIsInstance(q["blur_score"], float)
        self.assertIsInstance(q["brightness_score"], float)
        self.assertIsInstance(q["contrast_score"], float)
        self.assertIsInstance(q["noise_estimate"], float)

        # Informational finding is attached
        codes = [f["code"] for f in res["findings"]]
        self.assertIn("ANALYSIS_RESOLUTION_DOWNSCALED", codes)
        downscale_finding = next(f for f in res["findings"] if f["code"] == "ANALYSIS_RESOLUTION_DOWNSCALED")
        self.assertEqual(downscale_finding["severity"], "informational")

    def test_23_large_jpeg_downscaled_proxy_preserves_original_dimensions(self):
        """Test 23: Large JPEG (>2048 px) is proxy-downscaled for NumPy analysis while preserving original dimensions."""
        large_jpg = self.temp_dir / "large_photo.jpg"
        Image.new("RGB", (4000, 3000), color=(120, 140, 160)).save(large_jpg, quality=85)

        res = analyze_image_quality(large_jpg)
        q = res["image_quality"]

        self.assertEqual(q["width"], 4000)
        self.assertEqual(q["height"], 3000)
        self.assertEqual(q["megapixels"], 12.0)
        self.assertTrue(q["analysis_downscaled"])
        self.assertEqual(q["analyzed_width"], 2048)
        self.assertEqual(q["analyzed_height"], 1536)

    def test_24_small_images_remain_undownscaled(self):
        """Test 24: Images <= 2048 px are not downscaled and retain identical analyzed dimensions."""
        res = analyze_image_quality(self.sharp_image)
        q = res["image_quality"]

        self.assertFalse(q["analysis_downscaled"])
        self.assertEqual(q["analyzed_width"], q["width"])
        self.assertEqual(q["analyzed_height"], q["height"])
        codes = [f["code"] for f in res["findings"]]
        self.assertNotIn("ANALYSIS_RESOLUTION_DOWNSCALED", codes)


class TestImageForensicsLambdaReliability(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import os
        import sys
        from unittest.mock import MagicMock

        os.environ.setdefault("CLAIM_PACKETS_BUCKET", "test-claim-packets")

        # Mock gradio_client in sys.modules if not installed locally
        if "gradio_client" not in sys.modules:
            mock_gc = MagicMock()
            mock_gc.Client = MagicMock
            mock_gc.handle_file = lambda p: p
            sys.modules["gradio_client"] = mock_gc

        cls.temp_dir = Path(tempfile.mkdtemp(prefix="claimguard_lambda_rel_"))

        # Create dummy JPEG and PNG files
        cls.test_jpg = cls.temp_dir / "test.jpg"
        Image.new("RGB", (640, 480), color=(120, 160, 200)).save(cls.test_jpg, quality=80)

        cls.test_png = cls.temp_dir / "test.png"
        Image.new("RGBA", (800, 600), color=(255, 128, 0, 255)).save(cls.test_png)

    @classmethod
    def tearDownClass(cls):
        import shutil
        shutil.rmtree(cls.temp_dir, ignore_errors=True)

    def _mock_s3_for_file(self, file_path):
        from unittest.mock import patch
        import app

        head_patch = patch.object(
            app.s3, "head_object", return_value={"ContentLength": file_path.stat().st_size}
        )
        down_patch = patch.object(
            app.s3, "download_file", side_effect=lambda b, k, dest: Path(dest).write_bytes(file_path.read_bytes())
        )
        return head_patch, down_patch

    def test_25_smaug_skipped_when_insufficient_lambda_execution_time(self):
        """Test 25: Smaug is skipped with status SKIPPED when remaining Lambda time < 25s."""
        from unittest.mock import MagicMock
        import app

        ctx = MagicMock()
        ctx.get_remaining_time_in_millis.return_value = 15000  # 15s < 25s threshold

        head_p, down_p = self._mock_s3_for_file(self.test_jpg)
        with head_p, down_p:
            res = app.analyze_s3_image("incoming/claim123/damage.jpg", context=ctx)

        smaug = res["analyses"]["aiGeneration"]
        self.assertEqual(smaug["status"], "SKIPPED")
        self.assertEqual(smaug["reason"], "INSUFFICIENT_TIME_BUDGET")
        self.assertIn("remaining Lambda execution time", smaug["message"])

    def test_26_smaug_runs_when_sufficient_lambda_execution_time(self):
        """Test 26: Smaug executes normally when remaining Lambda time >= 25s."""
        from unittest.mock import MagicMock, patch
        import app

        ctx = MagicMock()
        ctx.get_remaining_time_in_millis.return_value = 90000  # 90s > 25s threshold

        head_p, down_p = self._mock_s3_for_file(self.test_jpg)
        mock_smaug_return = {
            "model": "abacusai/Smaug-AI-Image-Detector",
            "aiGeneratedScore": 0.045123,
            "aiGeneratedPercentage": 4.51,
            "interpretation": "Human capture probable.",
            "disclaimer": "Screening indicator.",
        }

        with head_p, down_p:
            with patch("app.analyze_smaug_image", return_value=mock_smaug_return):
                res = app.analyze_s3_image("incoming/claim123/damage.jpg", context=ctx)

        smaug = res["analyses"]["aiGeneration"]
        self.assertEqual(smaug["status"], "COMPLETED")
        self.assertEqual(smaug["result"]["aiGeneratedScore"], 0.045123)

    def test_27_previously_completed_analyses_preserved_when_smaug_skipped(self):
        """Test 27: Metadata, compression, and quality results remain COMPLETED when Smaug is skipped."""
        from unittest.mock import MagicMock
        import app

        ctx = MagicMock()
        ctx.get_remaining_time_in_millis.return_value = 10000  # 10s < 25s threshold

        head_p, down_p = self._mock_s3_for_file(self.test_png)
        with head_p, down_p:
            res = app.analyze_s3_image("incoming/claim123/photo.png", context=ctx)

        analyses = res["analyses"]
        self.assertEqual(analyses["metadata"]["status"], "COMPLETED")
        self.assertEqual(analyses["compression"]["status"], "COMPLETED")
        self.assertEqual(analyses["imageQuality"]["status"], "COMPLETED")
        self.assertEqual(analyses["aiGeneration"]["status"], "SKIPPED")

    def test_28_skipping_smaug_does_not_create_suspicious_verdict(self):
        """Test 28: Skipping Smaug due to time budget does not trigger review required or fraud verdict."""
        from unittest.mock import MagicMock
        import app

        ctx = MagicMock()
        ctx.get_remaining_time_in_millis.return_value = 8000

        head_p, down_p = self._mock_s3_for_file(self.test_jpg)
        with head_p, down_p:
            res = app.analyze_s3_image("incoming/claim123/damage.jpg", context=ctx)

        review = res["review"]
        self.assertFalse(review["required"])
        self.assertEqual(review["priority"], "NONE")
        self.assertEqual(review["reasons"], [])

    def test_29_smaug_timeout_handling_cancels_job(self):
        """Test 29: Smaug TimeoutError is captured cleanly and job.cancel() is invoked."""
        from unittest.mock import MagicMock, patch
        import app

        mock_client = MagicMock()
        mock_job = MagicMock()
        mock_job.result.side_effect = TimeoutError("Gradio request timed out")
        mock_client.submit.return_value = mock_job

        with patch("app.get_smaug_client", return_value=mock_client):
            with self.assertRaises(TimeoutError):
                app.analyze_smaug_image(self.test_jpg, timeout=1.0)

        # Verify job.cancel() was called upon timeout
        mock_job.cancel.assert_called_once()

    def test_30_three_image_sequential_processing_pipeline(self):
        """Test 30: Lambda handler processes 3 images sequentially and returns COMPLETED status."""
        from unittest.mock import MagicMock, patch
        import json
        import app

        ctx = MagicMock()
        ctx.get_remaining_time_in_millis.return_value = 120000

        mock_smaug = {
            "model": "Smaug",
            "aiGeneratedScore": 0.02,
            "aiGeneratedPercentage": 2.0,
            "interpretation": "Natural photo",
            "disclaimer": "Disclaimer",
        }

        event = {
            "httpMethod": "POST",
            "body": json.dumps({
                "claimId": "claim_772",
                "imageKeys": [
                    "incoming/claim_772/img1.jpg",
                    "incoming/claim_772/img2.jpg",
                    "incoming/claim_772/img3.png",
                ]
            })
        }

        head_patch = patch.object(
            app.s3, "head_object", return_value={"ContentLength": self.test_jpg.stat().st_size}
        )
        down_patch = patch.object(
            app.s3, "download_file", side_effect=lambda b, k, dest: Path(dest).write_bytes(
                self.test_png.read_bytes() if k.endswith(".png") else self.test_jpg.read_bytes()
            )
        )

        with head_patch, down_patch, patch("app.analyze_smaug_image", return_value=mock_smaug):
            response = app.lambda_handler(event, ctx)

        self.assertEqual(response["statusCode"], 200)
        body = json.loads(response["body"])
        self.assertEqual(body["claimId"], "claim_772")
        self.assertEqual(body["imagesSubmitted"], 3)
        self.assertEqual(body["analysisStatus"], "COMPLETED")
        self.assertEqual(len(body["images"]), 3)

    def test_31_existing_jpeg_and_png_response_compatibility_under_guard(self):
        """Test 31: Response contract keys remain 100% compatible when images are processed under time guard."""
        from unittest.mock import MagicMock, patch
        import json
        import app

        # Simulate low time so Smaug skips on the 2nd/3rd image
        ctx = MagicMock()
        ctx.get_remaining_time_in_millis.side_effect = [30000, 15000]

        event = {
            "httpMethod": "POST",
            "body": json.dumps({
                "claimId": "claim_883",
                "imageKeys": [
                    "incoming/claim_883/car.jpg",
                    "incoming/claim_883/detail.png",
                ]
            })
        }

        head_patch = patch.object(
            app.s3, "head_object", return_value={"ContentLength": self.test_jpg.stat().st_size}
        )
        down_patch = patch.object(
            app.s3, "download_file", side_effect=lambda b, k, dest: Path(dest).write_bytes(
                self.test_png.read_bytes() if k.endswith(".png") else self.test_jpg.read_bytes()
            )
        )

        with head_patch, down_patch, patch("app.analyze_smaug_image", return_value={"aiGeneratedScore": 0.01}):
            response = app.lambda_handler(event, ctx)

        self.assertEqual(response["statusCode"], 200)
        body = json.loads(response["body"])
        self.assertEqual(body["analysisStatus"], "COMPLETED")
        self.assertEqual(body["imagesSubmitted"], 2)

        # Image 1 had enough time (COMPLETED)
        self.assertEqual(body["images"][0]["analyses"]["aiGeneration"]["status"], "COMPLETED")
        # Image 2 hit the deadline guard (SKIPPED)
        self.assertEqual(body["images"][1]["analyses"]["aiGeneration"]["status"], "SKIPPED")

        # Top-level contract keys
        for key in ("claimId", "analysisStatus", "imagesSubmitted", "analysesCompleted", "analysesWithErrors", "images", "disclaimer"):
            self.assertIn(key, body)

    def test_32_dynamic_timeout_24s_remaining_skipped(self):
        """Test 32: 24 seconds remaining (< 25s threshold) skips Smaug analysis."""
        from unittest.mock import MagicMock
        import app

        ctx = MagicMock()
        ctx.get_remaining_time_in_millis.return_value = 24000  # 24s

        head_p, down_p = self._mock_s3_for_file(self.test_jpg)
        with head_p, down_p:
            res = app.analyze_s3_image("incoming/claim123/damage.jpg", context=ctx)

        smaug = res["analyses"]["aiGeneration"]
        self.assertEqual(smaug["status"], "SKIPPED")
        self.assertEqual(smaug["reason"], "INSUFFICIENT_TIME_BUDGET")

    def test_33_dynamic_timeout_25s_remaining_effective_20s(self):
        """Test 33: 25 seconds remaining allows Smaug with effective timeout of 20 seconds (25s - 5s buffer)."""
        from unittest.mock import MagicMock, patch
        import app

        ctx = MagicMock()
        ctx.get_remaining_time_in_millis.return_value = 25000  # 25s

        head_p, down_p = self._mock_s3_for_file(self.test_jpg)
        with head_p, down_p, patch("app.analyze_smaug_image", return_value={"aiGeneratedScore": 0.02}) as mock_smaug:
            res = app.analyze_s3_image("incoming/claim123/damage.jpg", context=ctx)
            mock_smaug.assert_called_once()
            self.assertEqual(mock_smaug.call_args[1].get("timeout"), 20.0)

        self.assertEqual(res["analyses"]["aiGeneration"]["status"], "COMPLETED")

    def test_34_dynamic_timeout_26s_remaining_effective_21s(self):
        """Test 34: 26 seconds remaining allows Smaug with effective timeout of 21 seconds (26s - 5s buffer)."""
        from unittest.mock import MagicMock, patch
        import app

        ctx = MagicMock()
        ctx.get_remaining_time_in_millis.return_value = 26000  # 26s

        head_p, down_p = self._mock_s3_for_file(self.test_jpg)
        with head_p, down_p, patch("app.analyze_smaug_image", return_value={"aiGeneratedScore": 0.02}) as mock_smaug:
            res = app.analyze_s3_image("incoming/claim123/damage.jpg", context=ctx)
            mock_smaug.assert_called_once()
            self.assertEqual(mock_smaug.call_args[1].get("timeout"), 21.0)

        self.assertEqual(res["analyses"]["aiGeneration"]["status"], "COMPLETED")

    def test_35_dynamic_timeout_29s_remaining_effective_24s(self):
        """Test 35: 29 seconds remaining allows Smaug with effective timeout of 24 seconds (29s - 5s buffer)."""
        from unittest.mock import MagicMock, patch
        import app

        ctx = MagicMock()
        ctx.get_remaining_time_in_millis.return_value = 29000  # 29s

        head_p, down_p = self._mock_s3_for_file(self.test_jpg)
        with head_p, down_p, patch("app.analyze_smaug_image", return_value={"aiGeneratedScore": 0.02}) as mock_smaug:
            res = app.analyze_s3_image("incoming/claim123/damage.jpg", context=ctx)
            mock_smaug.assert_called_once()
            self.assertEqual(mock_smaug.call_args[1].get("timeout"), 24.0)

        self.assertEqual(res["analyses"]["aiGeneration"]["status"], "COMPLETED")

    def test_36_dynamic_timeout_30s_remaining_effective_25s(self):
        """Test 36: 30 seconds remaining allows Smaug with effective timeout of 25 seconds (30s - 5s buffer)."""
        from unittest.mock import MagicMock, patch
        import app

        ctx = MagicMock()
        ctx.get_remaining_time_in_millis.return_value = 30000  # 30s

        head_p, down_p = self._mock_s3_for_file(self.test_jpg)
        with head_p, down_p, patch("app.analyze_smaug_image", return_value={"aiGeneratedScore": 0.02}) as mock_smaug:
            res = app.analyze_s3_image("incoming/claim123/damage.jpg", context=ctx)
            mock_smaug.assert_called_once()
            self.assertEqual(mock_smaug.call_args[1].get("timeout"), 25.0)

        self.assertEqual(res["analyses"]["aiGeneration"]["status"], "COMPLETED")

    def test_37_dynamic_timeout_35s_remaining_capped_at_30s(self):
        """Test 37: 35 seconds remaining allows Smaug with effective timeout capped at 30 seconds (configured max)."""
        from unittest.mock import MagicMock, patch
        import app

        ctx = MagicMock()
        ctx.get_remaining_time_in_millis.return_value = 35000  # 35s - 5s = 30s cap

        head_p, down_p = self._mock_s3_for_file(self.test_jpg)
        with head_p, down_p, patch("app.analyze_smaug_image", return_value={"aiGeneratedScore": 0.02}) as mock_smaug:
            res = app.analyze_s3_image("incoming/claim123/damage.jpg", context=ctx)
            mock_smaug.assert_called_once()
            self.assertEqual(mock_smaug.call_args[1].get("timeout"), 30.0)

        self.assertEqual(res["analyses"]["aiGeneration"]["status"], "COMPLETED")

    def test_38_dynamic_timeout_context_unavailable_fallback(self):
        """Test 38: When context is None, fallback uses configured 30.0s timeout."""
        from unittest.mock import patch
        import app

        head_p, down_p = self._mock_s3_for_file(self.test_jpg)
        with head_p, down_p, patch("app.analyze_smaug_image", return_value={"aiGeneratedScore": 0.02}) as mock_smaug:
            res = app.analyze_s3_image("incoming/claim123/damage.jpg", context=None)
            mock_smaug.assert_called_once()
            self.assertEqual(mock_smaug.call_args[1].get("timeout"), 30.0)

        self.assertEqual(res["analyses"]["aiGeneration"]["status"], "COMPLETED")

    def test_39_dynamic_timeout_handled_timeout_preserves_local_analyses(self):
        """Test 39: Dynamic timeout expiration marks Smaug as ERROR while preserving all completed local analyses."""
        from unittest.mock import MagicMock, patch
        import app

        ctx = MagicMock()
        ctx.get_remaining_time_in_millis.return_value = 26000  # 26s -> 21s effective timeout

        head_p, down_p = self._mock_s3_for_file(self.test_png)
        with head_p, down_p, patch("app.analyze_smaug_image", side_effect=TimeoutError("Timed out after 21.0s")):
            res = app.analyze_s3_image("incoming/claim123/detail.png", context=ctx)

        analyses = res["analyses"]
        # Local analyses must remain COMPLETED and preserved
        self.assertEqual(analyses["metadata"]["status"], "COMPLETED")
        self.assertEqual(analyses["compression"]["status"], "COMPLETED")
        self.assertEqual(analyses["imageQuality"]["status"], "COMPLETED")

        # Smaug handled as ERROR with explanatory error message
        self.assertEqual(analyses["aiGeneration"]["status"], "ERROR")
        self.assertIn("Timed out after 21.0s", analyses["aiGeneration"]["error"])

        # Review engine does not fail
        self.assertIn("required", res["review"])


if __name__ == "__main__":
    unittest.main()

