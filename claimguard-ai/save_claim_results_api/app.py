import json
import os
import re
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError
from claimguard_auth import (
    forbidden_response,
    identity_from_event,
    response,
    unauthorized_response,
)

REGION = os.environ.get("AWS_REGION", "ap-southeast-2")
TABLE_NAME = os.environ["OPERATIONAL_CLAIMS_TABLE"]
MAX_RESULT_BYTES = 48_000
ALLOWED_CHECKS = {
    "policy",
    "duplicate",
    "outlier",
    "forensics",
    "evidence",
    "consistency",
}
CLAIM_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,128}$")

dynamodb = boto3.resource("dynamodb", region_name=REGION)
claims_table = dynamodb.Table(TABLE_NAME)


def lambda_handler(event, context):
    identity = identity_from_event(event)
    if identity is None:
        return unauthorized_response()

    try:
        payload = json.loads(event.get("body") or "{}")
    except (json.JSONDecodeError, TypeError):
        return response(400, {"error": "Request body must be valid JSON."})

    claim_id = payload.get("claimId")
    check_key = payload.get("checkKey")
    check_result = payload.get("checkResult")
    if not isinstance(claim_id, str) or not CLAIM_ID_PATTERN.fullmatch(claim_id.strip()):
        return response(400, {"error": "claimId is required."})
    if not isinstance(check_key, str) or check_key not in ALLOWED_CHECKS:
        return response(400, {"error": "Unsupported screening check."})
    if not isinstance(check_result, dict):
        return response(400, {"error": "checkResult must be an object."})

    try:
        serialized = json.dumps(
            check_result,
            separators=(",", ":"),
            default=str,
            allow_nan=False,
        )
    except (TypeError, ValueError):
        return response(400, {"error": "checkResult must contain valid JSON values."})
    if len(serialized.encode("utf-8")) > MAX_RESULT_BYTES:
        return response(413, {"error": "Screening result is too large to store."})

    stored_result = {
        "source": "authenticated-client",
        "submittedAt": datetime.now(timezone.utc).isoformat(),
        "check": check_result,
    }
    try:
        claims_table.update_item(
            Key={"claimId": claim_id.strip()},
            UpdateExpression="SET screeningResults = if_not_exists(screeningResults, :empty)",
            ConditionExpression="attribute_exists(claimId) AND userId = :userId",
            ExpressionAttributeValues={
                ":empty": {},
                ":userId": identity["userId"],
            },
        )
        claims_table.update_item(
            Key={"claimId": claim_id.strip()},
            UpdateExpression=(
                "SET screeningResults.#checkKey = :result, "
                "screeningUpdatedAt = :updatedAt"
            ),
            ConditionExpression="attribute_exists(claimId) AND userId = :userId",
            ExpressionAttributeNames={"#checkKey": check_key},
            ExpressionAttributeValues={
                ":result": stored_result,
                ":updatedAt": stored_result["submittedAt"],
                ":userId": identity["userId"],
            },
        )
    except ClientError as error:
        code = error.response.get("Error", {}).get("Code")
        if code == "ConditionalCheckFailedException":
            return forbidden_response()
        print(f"Could not persist screening result: {code or type(error).__name__}")
        return response(500, {"error": "Could not persist screening result."})

    return response(200, {
        "claimId": claim_id.strip(),
        "checkKey": check_key,
        "persisted": True,
    })
