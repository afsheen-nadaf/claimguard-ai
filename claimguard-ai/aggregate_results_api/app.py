import json
import os
import time
from datetime import datetime, timezone
from decimal import Decimal

import boto3

table = boto3.resource("dynamodb").Table(os.environ["OPERATIONAL_CLAIMS_TABLE"])
CHECK_ORDER = ["policy", "outlier", "forensics", "evidence"]  # same order as the Parallel branches
MAX_RESULT_BYTES = 100_000

SKIPPED = {
    "forensics": {
        "skipped": True, "reason": "NO_IMAGES", "analysisStatus": "SKIPPED",
        "imagesSubmitted": 0, "analysesCompleted": 0, "analysesWithErrors": 0,
        "images": [],
        "message": "No JPG, JPEG or PNG images were uploaded for this claim.",
    },
    "evidence": {
        "skipped": True, "reason": "NO_EVIDENCE", "overallStatus": "SKIPPED",
        "overallVerdict": "UNCERTAIN", "requiresReview": False,
        "evidenceResults": [],
        "message": "No uploaded evidence was available for relevance validation.",
    },
}
UNAVAILABLE = {
    "duplicate": "Duplicate check unavailable. Manual review needed.",
    "policy": "Policy validation unavailable. Manual review needed.",
    "outlier": "Outlier check unavailable. Manual review needed.",
    "forensics": "Image forensics unavailable. Manual review needed.",
    "evidence": "Evidence validation unavailable. Manual review needed.",
}


def parse(payload):
    try:
        # parse_float=Decimal because boto3 rejects Python floats
        return json.loads(payload.get("body") or "{}", parse_float=Decimal)
    except (TypeError, ValueError):
        return {}


def build(check, claim_id, payload):
    finished = int(time.time() * 1000)
    if payload.get("skipped"):
        return {"status": "done", "raw": {**SKIPPED[check], "claimId": claim_id},
                "error": None, "finishedAt": finished}
    body = parse(payload)
    if payload.get("statusCode") == 200:
        if len(json.dumps(body, default=str).encode()) > MAX_RESULT_BYTES:
            return {"status": "error", "raw": None,
                    "error": "Result too large to store.", "finishedAt": finished}
        return {"status": "done", "raw": body, "error": None, "finishedAt": finished}
    message = body.get("error") if isinstance(body, dict) else None
    return {"status": "error", "raw": body or None,
            "error": message or UNAVAILABLE[check], "finishedAt": finished}


def lambda_handler(event, context):
    claim_id, user_id = event["claimId"], event["userId"]
    now = datetime.now(timezone.utc).isoformat()

    built = {"duplicate": build("duplicate", claim_id, event["duplicate"])}
    for check, payload in zip(CHECK_ORDER, event["checks"]):
        built[check] = build(check, claim_id, payload)
    results = {k: {"source": "system-pipeline", "submittedAt": now, "check": v}
               for k, v in built.items()}

    key = {"claimId": claim_id}
    condition = "attribute_exists(claimId) AND userId = :userId"
    table.update_item(
        Key=key,
        UpdateExpression="SET screeningResults = if_not_exists(screeningResults, :empty)",
        ConditionExpression=condition,
        ExpressionAttributeValues={":empty": {}, ":userId": user_id},
    )
    sets = [f"screeningResults.#{k} = :{k}" for k in results]
    sets += ["screeningStatus = :status", "screeningUpdatedAt = :now"]
    values = {f":{k}": v for k, v in results.items()}
    values.update({":status": "COMPLETE", ":now": now, ":userId": user_id})
    table.update_item(
        Key=key,
        UpdateExpression="SET " + ", ".join(sets),
        ConditionExpression=condition,
        ExpressionAttributeNames={f"#{k}": k for k in results},
        ExpressionAttributeValues=values,
    )
    return {"claimId": claim_id, "stored": sorted(results)}