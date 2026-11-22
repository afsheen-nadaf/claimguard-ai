import os
import re

import boto3
from claimguard_auth import identity_from_event, response, unauthorized_response

STATE_MACHINE_ARN = os.environ["STATE_MACHINE_ARN"]
EXECUTION_PREFIX = STATE_MACHINE_ARN.replace(":stateMachine:", ":execution:")
sfn = boto3.client("stepfunctions")
CLAIM_ID = re.compile(r"^[A-Za-z0-9_-]{1,128}$")


def execution_name(user_id, claim_id):
    import hashlib
    return hashlib.sha256(f"{user_id}:{claim_id}".encode()).hexdigest()[:40]


def lambda_handler(event, context):
    identity = identity_from_event(event)
    if identity is None:
        return unauthorized_response()

    claim_id = ((event.get("queryStringParameters") or {}).get("claimId") or "").strip()
    if not CLAIM_ID.fullmatch(claim_id):
        return response(400, {"error": "A valid claimId is required."})

    arn = f"{EXECUTION_PREFIX}:{execution_name(identity['userId'], claim_id)}"
    try:
        run = sfn.describe_execution(executionArn=arn)
    except sfn.exceptions.ExecutionDoesNotExist:
        return response(404, {"error": "No screening run found for this claim."})

    state = run["status"]
    if state == "RUNNING":
        return response(200, {"claimId": claim_id, "status": "RUNNING"})
    if state == "SUCCEEDED":
        return response(200, {"claimId": claim_id, "status": "COMPLETE"})
    return response(200, {
        "claimId": claim_id,
        "status": "FAILED",
        "error": run.get("error"),
        "cause": (run.get("cause") or "")[:500],
    })