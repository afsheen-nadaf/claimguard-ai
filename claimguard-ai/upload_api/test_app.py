"""
Unit tests for the Presigned Upload Lambda (upload_api/app.py).

Verifies:
1. A claim ID is included in the generated S3 key (incoming/{claimId}/{uniqueFilename}).
2. Image uploads use the correct prefix and extension (.jpg, .png).
3. PDF uploads use the correct prefix and extension (.pdf).
4. The key returned by the presign endpoint is exactly the key used for s3.generate_presigned_url.
5. Unique filenames are preserved across multiple uploads for the same claim.
6. Invalid claimId formats (path traversal, special characters) are rejected with 400.
7. Validation for filename, contentType, and fileSize remains intact.
8. Backward compatibility when claimId is omitted.
"""

import json
import os
import unittest
from unittest.mock import patch

# Configure bucket before importing app
os.environ["CLAIM_PACKETS_BUCKET"] = "test-claim-packets-bucket"

import app


class TestUploadApi(unittest.TestCase):
    def setUp(self):
        self.claim_id = "CG-1793727402258-20387251"
        self.bucket = "test-claim-packets-bucket"

    @patch.object(app, "s3")
    def test_01_claim_id_included_in_image_s3_key(self, mock_s3):
        """Test 1: S3 key for image contains incoming/{claimId}/{uuid}.jpg."""
        mock_s3.generate_presigned_url.return_value = "https://s3.example.com/presigned-url"

        event = {
            "body": json.dumps({
                "claimId": self.claim_id,
                "filename": "damage.jpg",
                "contentType": "image/jpeg",
                "fileSize": 1024 * 500,
            })
        }

        res = app.lambda_handler(event, None)
        self.assertEqual(res["statusCode"], 200)

        body = json.loads(res["body"])
        key = body["key"]

        # Expected format: incoming/{claimId}/{uuid}.jpg
        expected_prefix = f"incoming/{self.claim_id}/"
        self.assertTrue(key.startswith(expected_prefix), f"Key {key!r} must start with {expected_prefix!r}")
        self.assertTrue(key.endswith(".jpg"))

        # Verify key used in generate_presigned_url matches returned key exactly
        mock_s3.generate_presigned_url.assert_called_once()
        call_params = mock_s3.generate_presigned_url.call_args[1]["Params"]
        self.assertEqual(call_params["Key"], key)
        self.assertEqual(call_params["Bucket"], self.bucket)
        self.assertEqual(call_params["ContentType"], "image/jpeg")

    @patch.object(app, "s3")
    def test_02_pdf_upload_uses_correct_prefix_and_extension(self, mock_s3):
        """Test 2: S3 key for PDF contains incoming/{claimId}/{uuid}.pdf."""
        mock_s3.generate_presigned_url.return_value = "https://s3.example.com/presigned-pdf-url"

        event = {
            "body": json.dumps({
                "claimId": self.claim_id,
                "filename": "police_report.pdf",
                "contentType": "application/pdf",
                "fileSize": 1024 * 1024 * 2,
            })
        }

        res = app.lambda_handler(event, None)
        self.assertEqual(res["statusCode"], 200)

        body = json.loads(res["body"])
        key = body["key"]

        expected_prefix = f"incoming/{self.claim_id}/"
        self.assertTrue(key.startswith(expected_prefix))
        self.assertTrue(key.endswith(".pdf"))

        call_params = mock_s3.generate_presigned_url.call_args[1]["Params"]
        self.assertEqual(call_params["Key"], key)
        self.assertEqual(call_params["ContentType"], "application/pdf")

    @patch.object(app, "s3")
    def test_03_png_upload_uses_correct_prefix_and_extension(self, mock_s3):
        """Test 3: S3 key for PNG contains incoming/{claimId}/{uuid}.png."""
        mock_s3.generate_presigned_url.return_value = "https://s3.example.com/presigned-png-url"

        event = {
            "body": json.dumps({
                "claimId": self.claim_id,
                "filename": "screenshot.png",
                "contentType": "image/png",
                "fileSize": 204800,
            })
        }

        res = app.lambda_handler(event, None)
        self.assertEqual(res["statusCode"], 200)

        body = json.loads(res["body"])
        key = body["key"]

        expected_prefix = f"incoming/{self.claim_id}/"
        self.assertTrue(key.startswith(expected_prefix))
        self.assertTrue(key.endswith(".png"))

    @patch.object(app, "s3")
    def test_04_preserves_unique_filenames_for_same_claim(self, mock_s3):
        """Test 4: Multiple uploads for the same claimId generate distinct unique keys."""
        mock_s3.generate_presigned_url.return_value = "https://s3.example.com/test"

        keys = set()
        for i in range(5):
            event = {
                "body": json.dumps({
                    "claimId": self.claim_id,
                    "filename": f"file_{i}.jpg",
                    "contentType": "image/jpeg",
                    "fileSize": 50000,
                })
            }
            res = app.lambda_handler(event, None)
            body = json.loads(res["body"])
            keys.add(body["key"])

        self.assertEqual(len(keys), 5, "Every upload must have a unique object key")

    @patch.object(app, "s3")
    def test_05_invalid_claim_id_rejected(self, mock_s3):
        """Test 5: Path traversal sequences or invalid characters in claimId are rejected with 400."""
        invalid_ids = [
            "../traversal",
            "CG/123",
            "CG$123",
            "CG 123",
            "../../etc/passwd",
        ]

        for bad_id in invalid_ids:
            event = {
                "body": json.dumps({
                    "claimId": bad_id,
                    "filename": "photo.jpg",
                    "contentType": "image/jpeg",
                    "fileSize": 50000,
                })
            }
            res = app.lambda_handler(event, None)
            self.assertEqual(res["statusCode"], 400, f"Expected 400 for bad claimId: {bad_id}")

    @patch.object(app, "s3")
    def test_06_validation_security_rules_preserved(self, mock_s3):
        """Test 6: Validates missing filename, unsupported types, and invalid sizes."""
        # Missing filename
        res1 = app.lambda_handler({
            "body": json.dumps({"contentType": "image/jpeg", "fileSize": 100})
        }, None)
        self.assertEqual(res1["statusCode"], 400)

        # Unsupported type
        res2 = app.lambda_handler({
            "body": json.dumps({"filename": "a.zip", "contentType": "application/zip", "fileSize": 100})
        }, None)
        self.assertEqual(res2["statusCode"], 400)

        # File size 0
        res3 = app.lambda_handler({
            "body": json.dumps({"filename": "a.jpg", "contentType": "image/jpeg", "fileSize": 0})
        }, None)
        self.assertEqual(res3["statusCode"], 400)

        # File size > 10 MB
        res4 = app.lambda_handler({
            "body": json.dumps({"filename": "a.jpg", "contentType": "image/jpeg", "fileSize": 11 * 1024 * 1024})
        }, None)
        self.assertEqual(res4["statusCode"], 400)

    @patch.object(app, "s3")
    def test_07_omitted_claim_id_fallback(self, mock_s3):
        """Test 7: When claimId is omitted, falls back to flat incoming/{uuid}.ext for backward compatibility."""
        mock_s3.generate_presigned_url.return_value = "https://s3.example.com/legacy"

        event = {
            "body": json.dumps({
                "filename": "legacy.jpg",
                "contentType": "image/jpeg",
                "fileSize": 50000,
            })
        }

        res = app.lambda_handler(event, None)
        self.assertEqual(res["statusCode"], 200)

        body = json.loads(res["body"])
        key = body["key"]
        self.assertTrue(key.startswith("incoming/"))
        # Should not have double slashes
        parts = key.split("/")
        self.assertEqual(len(parts), 2)  # ["incoming", "{uuid}.jpg"]


if __name__ == "__main__":
    unittest.main()
