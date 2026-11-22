import hashlib
import json
import os
import re

import boto3
from claimguard_auth import (
    forbidden_response,
    identity_from_event,
    is_adjuster,
    response,
    unauthorized_response,
)

STATE_MACHINE_ARN = os.environ["STATE_MACHINE_ARN"]
sfn = boto3.client("stepfunctions")

CLAIM_ID = re.compile(r"^[A-Za-z0-9_-]{1,128}$")
IMAGE_EXT = (".jpg", ".jpeg", ".png")
REQUIRED = ("policyNumber", "claimType", "incidentDate", "claimAmountINR")


def execution_name(user_id, claim_id):
    return hashlib.sha256(f"{user_id}:{claim_id}".encode()).hexdigest()[:40]


def lambda_event(identity, payload):
    return {
        "httpMethod": "POST",
        "requestContext": {"authorizer": {"claims": {
            "sub": identity["userId"],
            "email": identity.get("email"),
            "cognito:groups": sorted(identity["groups"]),
        }}},
        "body": json.dumps(payload),
    }


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
    if not isinstance(body, dict):
        return response(400, {"error": "Request body must be a JSON object."})

    claim_id = str(body.get("claimId") or "").strip()
    if not CLAIM_ID.fullmatch(claim_id):
        return response(400, {"error": "A valid claimId is required."})
    missing = [f for f in REQUIRED if body.get(f) in (None, "")]
    if missing:
        return response(400, {"error": "Missing required fields", "fields": missing})

    docs = body.get("documents") or []
    if not isinstance(docs, list) or len(docs) > 10:
        return response(400, {"error": "documents must be a list of at most 10 items."})

    prefix = f"incoming/{claim_id}/"
    image_keys, evidence, stored_documents = [], [], []
    for doc in docs:
        key = doc.get("key") if isinstance(doc, dict) else None
        if not isinstance(key, str) or not key.startswith(prefix) or ".." in key:
            return response(400, {"error": "Each document must belong to this claim."})
        content_type = str(doc.get("contentType") or "application/octet-stream")
        doc_name = str(doc.get("name") or key.split("/")[-1]).strip()[:255]
        stored_documents.append({
            "key": key,
            "contentType": content_type,
            "name": doc_name,
        })
        evidence.append({
            "key": key,
            "contentType": content_type,
        })
        if key.lower().endswith(IMAGE_EXT):
            image_keys.append(key)
    evidence = evidence[:3]

    claim = {f: body[f] for f in REQUIRED}
    claimant_name = str(body.get("claimantName") or "").strip()[:120]
    description = str(body.get("description") or "")[:5000]

    pipeline_input = {
        "claimId": claim_id,
        "userId": identity["userId"],
        "documents": stored_documents,
        "skip": {"forensics": not image_keys, "evidence": not evidence},
        "events": {
            "duplicate": lambda_event(identity, {
                "claimId": claim_id,
                **claim,
                "claimantName": claimant_name,
                "imageKeys": image_keys[:3],
            }),
            "policy": lambda_event(identity, {
                **claim,
                "claimantName": claimant_name,
            }),
            "outlier": lambda_event(identity, {
                "claimType": claim["claimType"],
                "claimAmountINR": claim["claimAmountINR"]}),
            "forensics": lambda_event(identity, {
                "claimId": claim_id, "imageKeys": image_keys[:2]}),
            "evidence": lambda_event(identity, {
                "claimId": claim_id,
                "claimType": claim["claimType"],
                "incidentDescription": description,
                "evidence": evidence}),
        },
    }

    try:
        sfn.start_execution(
            stateMachineArn=STATE_MACHINE_ARN,
            name=execution_name(identity["userId"], claim_id),
            input=json.dumps(pipeline_input),
        )
    except sfn.exceptions.ExecutionAlreadyExists:
        return response(200, {"claimId": claim_id, "status": "ALREADY_SUBMITTED"})
    except Exception as error:
        print(f"start_execution failed: {type(error).__name__}")
        return response(500, {"error": "Could not start claim screening."})

    return response(202, {"claimId": claim_id, "status": "RUNNING"})