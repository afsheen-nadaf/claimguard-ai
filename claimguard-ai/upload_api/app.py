
import json
import os
import re
import uuid

import boto3
from botocore.config import Config
from claimguard_auth import (
    forbidden_response,
    identity_from_event,
    is_adjuster,
    response,
    unauthorized_response,
)

s3 = boto3.client(
    "s3",
    config=Config(signature_version="s3v4"),
)
BUCKET_NAME = os.environ["CLAIM_PACKETS_BUCKET"]
CORS_ORIGIN = os.environ.get("CORS_ORIGIN")
ALLOWED_TYPES = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/png": ".png",
}
MAX_FILE_SIZE = 10 * 1024 * 1024
URL_EXPIRY_SECONDS = 300
CLAIM_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]+$")


def lambda_handler(event, context):
    identity = identity_from_event(event)
    if identity is None:
        return unauthorized_response()
    if is_adjuster(identity):
        return forbidden_response()

    try:
        body = json.loads(event.get("body") or "{}")
    except (json.JSONDecodeError, TypeError):
        return response(400, {"error": "Request body must be valid JSON."})

    filename = body.get("filename")
    content_type = body.get("contentType")
    file_size = body.get("fileSize")

    if not isinstance(filename, str) or not filename.strip():
        return response(400, {"error": "filename is required."})

    if content_type not in ALLOWED_TYPES:
        return response(400, {"error": "Unsupported file type."})

    # bool is a subclass of int in Python, so reject it explicitly.
    if isinstance(file_size, bool) or not isinstance(file_size, int):
        return response(400, {"error": "fileSize must be an integer."})

    if not 0 < file_size <= MAX_FILE_SIZE:
        return response(400, {"error": "File must be between 1 byte and 10 MB."})

    claim_id = body.get("claimId")
    if not isinstance(claim_id, str) or not CLAIM_ID_PATTERN.fullmatch(claim_id.strip()):
        return response(400, {"error": "A valid claimId is required."}, CORS_ORIGIN)
    claim_id = claim_id.strip()

    # Never use a client-supplied filename as the S3 key.
    unique_filename = f"{uuid.uuid4().hex}{ALLOWED_TYPES[content_type]}"
    object_key = f"incoming/{claim_id}/{unique_filename}"
    metadata_header = f"x-amz-meta-userid"

    try:
        upload_url = s3.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": BUCKET_NAME,
                "Key": object_key,
                "ContentType": content_type,
                "Metadata": {"userid": identity["userId"]},
            },
            ExpiresIn=URL_EXPIRY_SECONDS,
            HttpMethod="PUT",
        )
    except Exception as error:
        print(f"Could not create upload URL: {type(error).__name__}")
        return response(500, {"error": "Could not prepare upload."}, CORS_ORIGIN)

    return response(
        200,
        {
            "uploadUrl": upload_url,
            "key": object_key,
            "expiresIn": URL_EXPIRY_SECONDS,
            "requiredHeaders": {
                "Content-Type": content_type,
                metadata_header: identity["userId"],
            },
        },
        CORS_ORIGIN,
    )
