
import json
import os
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

REGION = os.environ.get("AWS_REGION", "ap-southeast-2")
REFERENCE_TABLE_NAME = os.environ["REFERENCE_CLAIMS_TABLE"]
OPERATIONAL_TABLE_NAME = os.environ["OPERATIONAL_CLAIMS_TABLE"]

dynamodb = boto3.resource("dynamodb", region_name=REGION)
reference_table = dynamodb.Table(REFERENCE_TABLE_NAME)
operational_table = dynamodb.Table(OPERATIONAL_TABLE_NAME)

ALLOWED_ORIGIN = "http://localhost:5173"
INDEX_NAME = "PolicyNumberIncidentDateIndex"


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


def find_amount_matches(table, policy_number, incident_date, claim_amount):
    """Find exact amount matches for one policy and incident date."""
    matches = []
    last_key = None

    while True:
        query_args = {
            "IndexName": INDEX_NAME,
            "KeyConditionExpression": (
                Key("policyNumber").eq(policy_number)
                & Key("incidentDate").eq(incident_date)
            ),
        }

        if last_key:
            query_args["ExclusiveStartKey"] = last_key

        result = table.query(**query_args)

        for item in result.get("Items", []):
            try:
                historical_amount = Decimal(str(item["claimAmountINR"]))
            except (KeyError, InvalidOperation, ValueError):
                continue

            AMOUNT_TOLERANCE = Decimal("1.00")

            if abs(historical_amount - claim_amount) <= AMOUNT_TOLERANCE:
                matches.append(...)
                matches.append({
                    "claimId": item.get("claimId"),
                    "policyNumber": item.get("policyNumber"),
                    "incidentDate": item.get("incidentDate"),
                    "claimAmountINR": historical_amount,
                    "source": (
                        "OPERATIONAL"
                        if table.name == OPERATIONAL_TABLE_NAME
                        else "REFERENCE"
                    ),
                })

        last_key = result.get("LastEvaluatedKey")
        if not last_key:
            break

    return matches


def lambda_handler(event, context):
    if event.get("httpMethod") == "OPTIONS":
        return response(200, {"message": "CORS preflight successful"})

    try:
        body = json.loads(event.get("body") or "{}")

        required = [
            "claimId",
            "policyNumber",
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

        claim_id = str(body["claimId"]).strip()
        policy_number = str(body["policyNumber"]).strip()
        incident_date = str(body["incidentDate"])
        claim_amount = Decimal(str(body["claimAmountINR"]))

        # Validate inputs before querying or writing.
        if not claim_id or not policy_number:
            return response(400, {
                "error": "claimId and policyNumber cannot be blank"
            })

        date.fromisoformat(incident_date)

        if not claim_amount.is_finite() or claim_amount < 0:
            return response(400, {
                "error": "claimAmountINR must be a valid non-negative number"
            })

        # 1. Make repeated requests for an already registered operational
        # claim idempotent: do not match the claim against itself.
        existing_operational = operational_table.get_item(
            Key={"claimId": claim_id}
        ).get("Item")

        if existing_operational:
            same_details = (
                existing_operational.get("policyNumber") == policy_number
                and existing_operational.get("incidentDate") == incident_date
                and Decimal(str(
                    existing_operational.get("claimAmountINR", "-1")
                )) == claim_amount
            )

            if same_details:
                return response(200, {
                    "duplicateStatus": "ALREADY_REGISTERED",
                    "matchType": None,
                    "message": "This claim ID is already registered. Its original result is returned.",
                    "registeredClaimId": claim_id,
                    "originalDuplicateStatus": existing_operational.get(
                        "duplicateStatus"
                    ),
                    "note": "No second record was created.",
                })

            return response(200, {
                "duplicateStatus": "REVIEW",
                "matchType": "OPERATIONAL_CLAIM_ID_CONFLICT",
                "message": "This claim ID is already registered with different details.",
                "registeredClaimId": claim_id,
                "note": "Verify the submission; the existing record was not overwritten.",
            })

        # 2. Check whether the incoming ID already exists in the
        # synthetic/historical reference dataset.
        reference_id_match = reference_table.get_item(
            Key={"claimId": claim_id},
            ProjectionExpression="claimId, policyNumber, incidentDate, claimAmountINR",
        ).get("Item")

        if reference_id_match:
            duplicate_status = "REVIEW"
            match_type = "EXACT_CLAIM_ID"
            matches = [{
                "claimId": reference_id_match.get("claimId"),
                "policyNumber": reference_id_match.get("policyNumber"),
                "incidentDate": reference_id_match.get("incidentDate"),
                "claimAmountINR": reference_id_match.get("claimAmountINR"),
                "source": "REFERENCE",
            }]
        else:
            # 3. Check the historical reference records.
            matches = find_amount_matches(
                reference_table, policy_number, incident_date, claim_amount
            )

            # 4. Check previous operational submissions too.
            matches.extend(find_amount_matches(
                operational_table, policy_number, incident_date, claim_amount
            ))

            if matches:
                duplicate_status = "REVIEW"
                match_type = "POLICY_DATE_AMOUNT_MATCH"
            else:
                duplicate_status = "NO_MATCH"
                match_type = None

        # 5. Register this submission, including review-worthy claims,
        # so later submissions can be compared against it.
        record = {
            "claimId": claim_id,
            "policyNumber": policy_number,
            "incidentDate": incident_date,
            "claimAmountINR": claim_amount,
            "duplicateStatus": duplicate_status,
            "matchType": match_type or "NONE",
            "createdAt": datetime.now(timezone.utc).isoformat(),
        }

        try:
            operational_table.put_item(
                Item=record,
                ConditionExpression="attribute_not_exists(claimId)",
            )
        except ClientError as error:
            if error.response.get("Error", {}).get("Code") == (
                "ConditionalCheckFailedException"
            ):
                # Another request may have registered this ID between
                # our initial read and write. Do not overwrite its record.
                return response(409, {
                    "duplicateStatus": "RETRY",
                    "message": "This claim ID was registered concurrently. Retry the request to retrieve its stored result.",
                })
            raise

        return response(200, {
            "duplicateStatus": duplicate_status,
            "matchType": match_type,
            "message": (
                "Potential duplicate found; analyst review is recommended."
                if matches
                else "No configured duplicate match found. Claim registered."
            ),
            "matches": matches,
            "registeredClaimId": claim_id,
            "note": (
                "A matching record is a review signal, not proof of fraud."
            ),
        })

    except (json.JSONDecodeError, ValueError, InvalidOperation):
        return response(400, {
            "error": "Invalid request. Check the JSON, ISO date, and claim amount."
        })
    except Exception:
        print("Duplicate check failed.")
        return response(500, {
            "error": "Duplicate detection could not be completed."
        })
