import base64
import json
import os
import re
from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Key
from botocore.config import Config
from botocore.exceptions import ClientError
from claimguard_auth import (
    forbidden_response,
    identity_from_event,
    is_adjuster,
    response,
    unauthorized_response,
)

REGION = os.environ.get("AWS_REGION", "ap-southeast-2")
TABLE_NAME = os.environ["OPERATIONAL_CLAIMS_TABLE"]
BUCKET_NAME = os.environ.get("CLAIM_PACKETS_BUCKET", "")
MAX_LIMIT = 100
PREVIEW_EXPIRY_SECONDS = 900  # 15 minutes
CLAIM_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,128}$")
ALLOWED_PREVIEW_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
}
CLAIM_FIELDS = {
    "claimId",
    "claimantName",
    "policyNumber",
    "claimType",
    "incidentDate",
    "claimAmountINR",
    "createdAt",
    "duplicateStatus",
    "matchType",
    "screeningResults",
    "screeningStatus",
    "screeningUpdatedAt",
    "aiAssessment",
    "documents",
    "duplicateMatches",
    "duplicateMatchCount",
    "duplicateImageMatches",
    "duplicateImageMatchCount",
}

dynamodb = boto3.resource("dynamodb", region_name=REGION)
claims_table = dynamodb.Table(TABLE_NAME)
s3 = boto3.client("s3", region_name=REGION, config=Config(signature_version="s3v4"))


def _cursor_decode(value, user_id, adjuster):
    if not value:
        return None
    if not isinstance(value, str) or len(value) > 2048:
        raise ValueError("Invalid pagination cursor.")
    try:
        padded = value + "=" * (-len(value) % 4)
        key = json.loads(base64.urlsafe_b64decode(padded.encode("ascii")))
    except (ValueError, UnicodeError, json.JSONDecodeError):
        raise ValueError("Invalid pagination cursor.") from None
    if not isinstance(key, dict) or not key:
        raise ValueError("Invalid pagination cursor.")
    if not adjuster and key.get("userId") != user_id:
        raise ValueError("Invalid pagination cursor.")
    return key


def _cursor_encode(key):
    if not key:
        return None
    raw = json.dumps(key, separators=(",", ":"), default=str).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _plain(value):
    if isinstance(value, Decimal):
        return int(value) if value == value.to_integral_value() else float(value)
    if isinstance(value, dict):
        return {k: _plain(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_plain(v) for v in value]
    return value


def _serialize(items, adjuster):
    claims = []
    for item in items:
        claim = {
            key: _plain(value)
            for key, value in item.items()
            if key in CLAIM_FIELDS
        }
        if not adjuster:
            for key in (
                "aiAssessment",
                "duplicateMatches",
                "duplicateMatchCount",
                "duplicateImageMatches",
                "duplicateImageMatchCount",
            ):
                claim.pop(key, None)
        claims.append(claim)
    return claims


def _handle_document_url(query, identity, adjuster):
    if not BUCKET_NAME:
        return response(500, {"error": "Document storage is not configured."})

    claim_id = query.get("claimId")
    object_key = (query.get("key") or "").strip()

    if not isinstance(claim_id, str) or not CLAIM_ID_PATTERN.fullmatch(claim_id):
        return response(400, {"error": "Invalid claimId."})
    if not object_key or not object_key.startswith(f"incoming/{claim_id}/") or ".." in object_key:
        return response(400, {"error": "Invalid document key."})

    result = claims_table.get_item(Key={"claimId": claim_id})
    item = result.get("Item")
    if item is None:
        return response(404, {"error": "Claim not found."})
    if not adjuster and item.get("userId") != identity["userId"]:
        return forbidden_response()

    docs = item.get("documents") or []
    matched_doc = next(
        (d for d in docs if isinstance(d, dict) and (d.get("key") or d.get("s3Key")) == object_key),
        None,
    )
    if matched_doc is None:
        return response(404, {"error": "Document not found on this claim."})

    content_type = matched_doc.get("contentType") or matched_doc.get("type") or "application/octet-stream"
    params = {
        "Bucket": BUCKET_NAME,
        "Key": object_key,
        "ResponseContentDisposition": "inline",
    }
    if content_type in ALLOWED_PREVIEW_TYPES:
        params["ResponseContentType"] = content_type

    url = s3.generate_presigned_url(
        "get_object",
        Params=params,
        ExpiresIn=PREVIEW_EXPIRY_SECONDS,
    )
    return response(200, {
        "url": url,
        "key": object_key,
        "name": matched_doc.get("name") or object_key.split("/")[-1],
        "contentType": content_type,
        "expiresIn": PREVIEW_EXPIRY_SECONDS,
    })


def lambda_handler(event, context):
    if event.get("httpMethod") == "OPTIONS":
        return response(200, {"message": "CORS preflight"})

    identity = identity_from_event(event)
    if identity is None:
        return unauthorized_response()
    adjuster = is_adjuster(identity)

    query = event.get("queryStringParameters") or {}
    path = event.get("path") or event.get("resource") or ""

    try:
        if path.endswith("/document-url"):
            return _handle_document_url(query, identity, adjuster)

        limit = int(query.get("limit", 50))
        if not 1 <= limit <= MAX_LIMIT:
            return response(400, {"error": f"limit must be between 1 and {MAX_LIMIT}."})

        claim_id = query.get("claimId")
        if claim_id is not None and (
            not isinstance(claim_id, str)
            or not CLAIM_ID_PATTERN.fullmatch(claim_id)
        ):
            return response(400, {"error": "Invalid claimId."})

        if claim_id:
            result = claims_table.get_item(Key={"claimId": claim_id})
            item = result.get("Item")
            if item is None:
                return response(404, {"error": "Claim not found."})
            if not adjuster and item.get("userId") != identity["userId"]:
                return forbidden_response()
            return response(200, {
                "claims": _serialize([item], adjuster),
                "count": 1,
                "nextCursor": None,
            })

        cursor = _cursor_decode(query.get("cursor"), identity["userId"], adjuster)
        if adjuster:
            scan_args = {"Limit": limit}
            if cursor:
                scan_args["ExclusiveStartKey"] = cursor
            result = claims_table.scan(**scan_args)
        else:
            query_args = {
                "IndexName": "UserIdIndex",
                "KeyConditionExpression": Key("userId").eq(identity["userId"]),
                "Limit": limit,
                "ScanIndexForward": False,
            }
            if cursor:
                query_args["ExclusiveStartKey"] = cursor
            result = claims_table.query(**query_args)

        claims = _serialize(result.get("Items", []), adjuster)
        next_cursor = _cursor_encode(result.get("LastEvaluatedKey"))
        return response(200, {
            "claims": claims,
            "count": len(claims),
            "nextCursor": next_cursor,
        })
    except ValueError as error:
        return response(400, {"error": str(error)})
    except ClientError as error:
        print(f"Claim history / document request failed: {error.response.get('Error', {}).get('Code')}")
        return response(500, {"error": "Request failed."})