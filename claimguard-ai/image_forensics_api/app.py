
import json
import os
import re
import tempfile
import math
from pathlib import Path

import boto3
from botocore.exceptions import ClientError
from gradio_client import Client, handle_file

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
    os.environ.get("MAX_IMAGES_PER_CLAIM", "3")
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


# --------------------------------------------------
# HUGGING FACE SMAUG CONFIGURATION
# --------------------------------------------------

SMAUG_SPACE_ID = os.environ.get(
    "SMAUG_SPACE_ID",
    "afsheenadaf/claimguard-smaug"
)

# Reuse the client across warm Lambda invocations.
smaug_client = None


def get_smaug_client():
    """
    Initialize the Hugging Face Gradio client
    only when Smaug analysis is required.
    """

    global smaug_client

    if smaug_client is None:
        smaug_client = Client(SMAUG_SPACE_ID)

    return smaug_client


def analyze_smaug_image(local_path):
    """
    Send an image to the Hugging Face Smaug Space.

    Returns an AI-generation screening score.
    This does not establish image manipulation or fraud.
    """

    client = get_smaug_client()

    result = client.predict(
        image_path=handle_file(str(local_path)),
        api_name="/analyze"
    )

    if not isinstance(result, dict):
        raise ValueError(
            "Smaug returned an unexpected response."
        )

    score = result.get("aiGeneratedScore")

    if (
        not isinstance(score, (int, float))
        or isinstance(score, bool)
        or not math.isfinite(score)
        or not 0 <= score <= 1
    ):
        raise ValueError(
            "Smaug returned an invalid AI-generation score."
        )

    return {
        "model": result.get(
            "model",
            "abacusai/Smaug-AI-Image-Detector"
        ),
        "aiGeneratedScore": round(
            float(score), 6
        ),
        "aiGeneratedPercentage": round(
            float(score) * 100, 2
        ),
        "interpretation": result.get(
            "interpretation",
            "AI-generation screening completed."
        ),
        "disclaimer": (
            "This is an AI-generation screening score, "
            "not proof of image authenticity, manipulation, "
            "or fraud. Localized AI edits in otherwise "
            "genuine photographs may not be detected."
        )
    }


# --------------------------------------------------
# API RESPONSE
# --------------------------------------------------

def response(status_code, body):

    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": os.environ.get(
                "CORS_ORIGIN",
                "http://localhost:5173"
            ),
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "OPTIONS,POST",
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

def analyze_s3_image(key):

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
        # 4. SMAUG AI-GENERATION DETECTION
        # ------------------------------------------

        try:

            smaug_result = analyze_smaug_image(
                local_path
            )

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
            analyze_s3_image(key)
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
