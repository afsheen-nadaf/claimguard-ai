
import json
import os
import re
import tempfile
from pathlib import Path

import boto3
from botocore.exceptions import ClientError

# Smaug is now loaded locally (no external gradio_client / HuggingFace Space).
from smaug_local import analyze_image as smaug_analyze

from metadata_analyzer import extract_metadata
from compression_analyzer import analyze_compression
from quality_analyzer import analyze_image_quality
from review_engine import generate_review


# --------------------------------------------------
# AWS CONFIGURATION
# --------------------------------------------------

s3 = boto3.client("s3")

BUCKET = os.environ["CLAIM_PACKETS_BUCKET"]

MAX_IMAGES = int(
    os.environ.get("MAX_IMAGES_PER_CLAIM", "2")
)

MAX_IMAGE_BYTES = int(
    os.environ.get(
        "MAX_IMAGE_BYTES",
        str(10 * 1024 * 1024)
    )
)

ALLOWED_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png"
}

KEY_PATTERN = re.compile(
    r"^incoming/[A-Za-z0-9._/-]+$"
)

# Minimum remaining Lambda execution time (ms) required to start Smaug.
# If time is below this, Smaug is skipped to avoid a timeout.
SMAUG_MIN_REMAINING_TIME_MS = int(
    os.environ.get("SMAUG_MIN_REMAINING_TIME_MS", "20000")
)


# --------------------------------------------------
# API RESPONSE
# --------------------------------------------------

def response(status_code, body):

    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
        },
        "body": json.dumps(body, default=str),
    }


# --------------------------------------------------
# INPUT VALIDATION
# --------------------------------------------------

def validate_keys(image_keys):

    if not isinstance(image_keys, list) or not image_keys:
        raise ValueError(
            "imageKeys must be a non-empty list."
        )

    if len(image_keys) > MAX_IMAGES:
        raise ValueError(
            f"A maximum of {MAX_IMAGES} images "
            "can be analyzed per request."
        )

    cleaned = []
    seen = set()

    for key in image_keys:

        if (
            not isinstance(key, str)
            or not KEY_PATTERN.fullmatch(key)
        ):
            raise ValueError(
                "Each image key must be a valid incoming/ S3 object key."
            )

        if ".." in Path(key).parts:
            raise ValueError(
                "Invalid S3 object key."
            )

        if Path(key).suffix.lower() not in ALLOWED_EXTENSIONS:
            raise ValueError(
                "Only JPG, JPEG and PNG images are supported."
            )

        if key in seen:
            raise ValueError(
                "Duplicate image keys were supplied."
            )

        seen.add(key)
        cleaned.append(key)

    return cleaned


# --------------------------------------------------
# IMAGE ANALYSIS PIPELINE
# --------------------------------------------------

def analyze_s3_image(key, context=None):

    filename = Path(key).name
    suffix = Path(filename).suffix.lower()

    with tempfile.NamedTemporaryFile(
        suffix=suffix,
        delete=False
    ) as temp:

        local_path = Path(temp.name)

    try:

        # ------------------------------------------
        # DOWNLOAD IMAGE FROM PRIVATE S3 BUCKET
        # ------------------------------------------

        head = s3.head_object(
            Bucket=BUCKET,
            Key=key
        )

        size = int(
            head.get("ContentLength", 0)
        )

        if size <= 0 or size > MAX_IMAGE_BYTES:
            raise ValueError(
                f"Image must be between 1 byte and "
                f"{MAX_IMAGE_BYTES} bytes."
            )

        s3.download_file(
            BUCKET,
            key,
            str(local_path)
        )

        if local_path.stat().st_size > MAX_IMAGE_BYTES:
            raise ValueError(
                f"Image exceeds the {MAX_IMAGE_BYTES}-byte limit."
            )

        results = {}

        # ------------------------------------------
        # 1. METADATA ANALYSIS
        # ------------------------------------------

        try:

            results["metadata"] = {
                "status": "COMPLETED",
                "result": extract_metadata(local_path)
            }

        except Exception as exc:

            results["metadata"] = {
                "status": "ERROR",
                "error": str(exc)[:500]
            }

        # ------------------------------------------
        # 2. COMPRESSION ANALYSIS
        # ------------------------------------------

        try:

            results["compression"] = {
                "status": "COMPLETED",
                "result": analyze_compression(local_path)
            }

        except Exception as exc:

            results["compression"] = {
                "status": "ERROR",
                "error": str(exc)[:500]
            }

        # ------------------------------------------
        # 3. IMAGE QUALITY ANALYSIS
        # ------------------------------------------

        try:

            results["imageQuality"] = {
                "status": "COMPLETED",
                "result": analyze_image_quality(local_path)
            }

        except Exception as exc:

            results["imageQuality"] = {
                "status": "ERROR",
                "error": str(exc)[:500]
            }

        # ------------------------------------------
        # 4. SMAUG AI-GENERATION DETECTION (LOCAL)
        # ------------------------------------------

        remaining_ms = None
        if context is not None and hasattr(context, "get_remaining_time_in_millis"):
            try:
                remaining_ms = context.get_remaining_time_in_millis()
            except Exception:
                remaining_ms = None

        if remaining_ms is not None and remaining_ms < SMAUG_MIN_REMAINING_TIME_MS:
            results["aiGeneration"] = {
                "status": "SKIPPED",
                "reason": "INSUFFICIENT_TIME_BUDGET",
                "message": (
                    f"AI-generation screening skipped: remaining Lambda execution time "
                    f"({round(remaining_ms / 1000, 1)}s) is below safety threshold "
                    f"({round(SMAUG_MIN_REMAINING_TIME_MS / 1000, 1)}s)."
                ),
            }
        else:
            try:
                smaug_result = smaug_analyze(local_path)

                results["aiGeneration"] = {
                    "status": "COMPLETED",
                    "result": smaug_result
                }

            except Exception as exc:
                results["aiGeneration"] = {
                    "status": "ERROR",
                    "error": str(exc)[:500]
                }

        # ------------------------------------------
        # 5. ANALYST REVIEW RECOMMENDATION
        # ------------------------------------------

        review = generate_review(results)

        # ------------------------------------------
        # FINAL IMAGE RESULT
        # ------------------------------------------

        return {
            "fileName": filename,
            "s3Key": key,
            "fileSizeBytes": size,
            "analyses": results,
            "review": review
        }

    finally:

        try:
            local_path.unlink(missing_ok=True)

        except OSError:
            pass


# --------------------------------------------------
# LAMBDA HANDLER
# --------------------------------------------------

def lambda_handler(event, context):

    # ----------------------------------------------
    # CORS PREFLIGHT
    # ----------------------------------------------

    if event.get("httpMethod") == "OPTIONS":

        return response(
            200,
            {
                "message": "CORS preflight successful."
            }
        )

    try:

        # ------------------------------------------
        # PARSE REQUEST BODY
        # ------------------------------------------

        body = event.get("body") or "{}"

        if event.get("isBase64Encoded"):

            import base64

            body = base64.b64decode(
                body
            ).decode("utf-8")

        payload = (
            json.loads(body)
            if isinstance(body, str)
            else body
        )

        # ------------------------------------------
        # VALIDATE CLAIM ID
        # ------------------------------------------

        claim_id = payload.get("claimId")

        if (
            not isinstance(claim_id, str)
            or not claim_id.strip()
        ):
            raise ValueError(
                "claimId is required."
            )

        # ------------------------------------------
        # VALIDATE IMAGE KEYS
        # ------------------------------------------

        keys = validate_keys(
            payload.get("imageKeys")
        )

        # ------------------------------------------
        # ANALYZE ALL CLAIM IMAGES
        # ------------------------------------------

        image_results = [
            analyze_s3_image(key, context=context)
            for key in keys
        ]

        # ------------------------------------------
        # CALCULATE ANALYSIS STATISTICS
        # ------------------------------------------

        completed = sum(
            1
            for image in image_results
            for item in image["analyses"].values()
            if item["status"] == "COMPLETED"
        )

        errors = sum(
            1
            for image in image_results
            for item in image["analyses"].values()
            if item["status"] == "ERROR"
        )

        # ------------------------------------------
        # DETERMINE OVERALL STATUS
        # ------------------------------------------

        if errors == 0:
            analysis_status = "COMPLETED"

        elif completed > 0:
            analysis_status = "PARTIAL"

        else:
            analysis_status = "FAILED"

        # ------------------------------------------
        # FINAL API RESPONSE
        # ------------------------------------------

        return response(
            200,
            {
                "claimId": claim_id,

                "analysisStatus": analysis_status,

                "imagesSubmitted": len(image_results),

                "analysesCompleted": completed,

                "analysesWithErrors": errors,

                "images": image_results,

                "disclaimer": (
                    "Metadata, compression, image-quality "
                    "and AI-generation observations are "
                    "screening indicators only. They do not "
                    "establish image manipulation or fraud. "
                    "Smaug may miss localized AI edits in "
                    "otherwise genuine photographs. All "
                    "flagged claims require human review."
                )
            }
        )

    # ----------------------------------------------
    # VALIDATION ERRORS
    # ----------------------------------------------

    except (ValueError, json.JSONDecodeError) as exc:

        return response(
            400,
            {
                "error": str(exc)
            }
        )

    # ----------------------------------------------
    # AWS S3 ERRORS
    # ----------------------------------------------

    except ClientError as exc:

        code = exc.response.get(
            "Error", {}
        ).get(
            "Code",
            "AWS_ERROR"
        )

        return response(
            502,
            {
                "error": (
                    "Unable to retrieve an uploaded image."
                ),
                "code": code
            }
        )

    # ----------------------------------------------
    # UNEXPECTED ERRORS
    # ----------------------------------------------

    except Exception:

        return response(
            500,
            {
                "error": (
                    "Image analysis could not be completed."
                )
            }
        )
