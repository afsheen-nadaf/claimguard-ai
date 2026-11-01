
import json
import os
from datetime import date
from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Key

REGION = os.environ.get("AWS_REGION", "ap-southeast-2")
TABLE_NAME = os.environ["POLICIES_TABLE"]

dynamodb = boto3.resource("dynamodb", region_name=REGION)
policies_table = dynamodb.Table(TABLE_NAME)

ALLOWED_ORIGIN = "http://localhost:5173"


def response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
            "Access-Control-Allow-Methods": "OPTIONS,POST",
            "Access-Control-Allow-Headers": "Content-Type",
        },
        "body": json.dumps(body, default=str),
    }


def parse_date(value):
    return date.fromisoformat(value)


def lambda_handler(event, context):
    if event.get("httpMethod") == "OPTIONS":
        return response(200, {"message": "CORS preflight successful"})

    try:
        body = json.loads(event.get("body") or "{}")

        required = [
            "policyNumber",
            "claimType",
            "incidentDate",
            "claimAmountINR",
        ]
        missing = [
            field for field in required
            if field not in body or body[field] in (None, "")
        ]

        if missing:
            return response(400, {
                "error": "Missing required fields",
                "fields": missing,
            })

        policy_number = str(body["policyNumber"]).strip()
        claim_type = str(body["claimType"]).strip()
        incident_date = parse_date(str(body["incidentDate"]))
        claim_amount = Decimal(str(body["claimAmountINR"]))

        if claim_amount < 0:
            return response(400, {
                "error": "claimAmountINR cannot be negative"
            })

        # Retrieve the existing policy. This does not create a claim.
        result = policies_table.get_item(
            Key={"policyNumber": policy_number}
        )
        policy = result.get("Item")

        if not policy:
            return response(200, {
                "policyNumber": policy_number,
                "validationStatus": "REVIEW",
                "flags": [{
                    "code": "POLICY_NOT_FOUND",
                    "message": "The policy could not be verified in the reference database."
                }],
                "checks": {
                    "policyExists": False,
                    "policyStatus": "NOT_CHECKED",
                    "coverageDates": "NOT_CHECKED",
                    "claimType": "NOT_CHECKED",
                    "coverageLimit": "NOT_CHECKED",
                },
                "note": "A missing reference record does not prove fraud."
            })

        flags = []
        checks = {
            "policyExists": True,
            "policyStatus": "NOT_CHECKED",
            "coverageDates": "NOT_CHECKED",
            "claimType": "NOT_CHECKED",
            "coverageLimit": "NOT_CHECKED",
        }

        # 1. Policy status
        status = str(policy.get("policyStatus", "")).upper()
        if status == "ACTIVE":
            checks["policyStatus"] = "PASS"
        else:
            checks["policyStatus"] = "FLAG"
            flags.append({
                "code": "POLICY_NOT_ACTIVE",
                "message": f"Recorded policy status is '{status or 'UNKNOWN'}'."
            })

        # 2. Coverage dates
        try:
            start = parse_date(str(policy["coverageStart"]))
            end = parse_date(str(policy["coverageEnd"]))

            if start <= incident_date <= end:
                checks["coverageDates"] = "PASS"
            else:
                checks["coverageDates"] = "FLAG"
                flags.append({
                    "code": "INCIDENT_OUTSIDE_COVERAGE",
                    "message": "The incident date is outside the recorded coverage period."
                })
        except (KeyError, ValueError, TypeError):
            checks["coverageDates"] = "UNVERIFIABLE"
            flags.append({
                "code": "COVERAGE_DATES_UNAVAILABLE",
                "message": "Coverage dates are missing or invalid."
            })

        # 3. Claim type
        recorded_type = str(policy.get("claimType", "")).strip().casefold()
        submitted_type = claim_type.casefold()

        if recorded_type and recorded_type == submitted_type:
            checks["claimType"] = "PASS"
        else:
            checks["claimType"] = "FLAG"
            flags.append({
                "code": "CLAIM_TYPE_MISMATCH",
                "message": "The submitted claim type does not match the recorded policy type."
            })

        # 4. Recorded coverage limit
        try:
            limit = Decimal(str(policy["coverageLimitINR"]))
            if claim_amount <= limit:
                checks["coverageLimit"] = "PASS"
            else:
                checks["coverageLimit"] = "FLAG"
                flags.append({
                    "code": "CLAIM_EXCEEDS_COVERAGE_LIMIT",
                    "message": "The claim amount exceeds the recorded coverage limit."
                })
        except (KeyError, ValueError, TypeError):
            checks["coverageLimit"] = "UNVERIFIABLE"
            flags.append({
                "code": "COVERAGE_LIMIT_UNAVAILABLE",
                "message": "The coverage limit is missing or invalid."
            })

        # Missing or invalid policy information should never count as a pass.
        needs_review = bool(flags)

        return response(200, {
            "policyNumber": policy_number,
            "validationStatus": "REVIEW" if needs_review else "PASS",
            "checks": checks,
            "flags": flags,
            "note": (
                "These are screening findings, not a determination of fraud "
                "or a final coverage decision."
            ),
        })

    except (json.JSONDecodeError, ValueError, ArithmeticError):
        return response(400, {
            "error": "Invalid request. Check the JSON, date, and claim amount."
        })
    except Exception:
        print("Policy validation failed.")
        return response(500, {
            "error": "Policy validation could not be completed."
        })
