
import json
import os
import statistics
from decimal import Decimal, InvalidOperation

import boto3


dynamodb = boto3.resource("dynamodb")
claims_table = dynamodb.Table(
    os.environ["REFERENCE_CLAIMS_TABLE"]
)

MINIMUM_SAMPLE_SIZE = 5
ROBUST_Z_THRESHOLD = 3.5
IQR_MULTIPLIER = 1.5


def response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "http://localhost:5173",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "OPTIONS,POST",
        },
        "body": json.dumps(body),
    }


def get_reference_amounts(claim_type):
    """Read all reference claims of the requested type."""
    amounts = []
    scan_kwargs = {}

    while True:
        result = claims_table.scan(**scan_kwargs)

        for item in result.get("Items", []):
            if str(item.get("claimType", "")).strip().lower() != claim_type.lower():
                continue

            try:
                amount = Decimal(str(item["claimAmountINR"]))
                if amount.is_finite() and amount >= 0:
                    amounts.append(float(amount))
            except (KeyError, InvalidOperation, ValueError):
                continue

        last_key = result.get("LastEvaluatedKey")
        if not last_key:
            break

        scan_kwargs["ExclusiveStartKey"] = last_key

    return amounts


def quartile(sorted_values, fraction):
    """Calculate a linearly interpolated percentile."""
    position = (len(sorted_values) - 1) * fraction
    lower_index = int(position)
    upper_index = min(lower_index + 1, len(sorted_values) - 1)
    weight = position - lower_index

    return (
        sorted_values[lower_index] * (1 - weight)
        + sorted_values[upper_index] * weight
    )


def lambda_handler(event, context):
    try:
        body = event.get("body") or "{}"
        if isinstance(body, str):
            body = json.loads(body)

        claim_type = str(body.get("claimType", "")).strip()
        if not claim_type:
            return response(400, {
                "error": "claimType is required."
            })

        raw_amount = body.get("claimAmountINR")
        if raw_amount is None or isinstance(raw_amount, bool):
            return response(400, {
                "error": "claimAmountINR is required and must be numeric."
            })

        try:
            claim_amount = Decimal(str(raw_amount))
        except (InvalidOperation, ValueError):
            return response(400, {
                "error": "claimAmountINR must be numeric."
            })

        if not claim_amount.is_finite() or claim_amount < 0:
            return response(400, {
                "error": "claimAmountINR must be a finite, non-negative amount."
            })

        claim_amount = float(claim_amount)

        amounts = get_reference_amounts(claim_type)

        if len(amounts) < MINIMUM_SAMPLE_SIZE:
            return response(200, {
                "status": "INSUFFICIENT_DATA",
                "claimType": claim_type,
                "sampleSize": len(amounts),
                "minimumSampleSize": MINIMUM_SAMPLE_SIZE,
                "message": "Not enough comparable reference claims to assess this amount."
            })

        sorted_amounts = sorted(amounts)
        median = statistics.median(amounts)
        deviations = [abs(value - median) for value in amounts]
        mad = statistics.median(deviations)

        q1 = quartile(sorted_amounts, 0.25)
        q3 = quartile(sorted_amounts, 0.75)
        iqr = q3 - q1

        method = "ROBUST_Z_SCORE"
        robust_z_score = None

        if mad > 0:
            robust_z_score = (
                0.6745 * (claim_amount - median) / mad
            )
            is_outlier = abs(robust_z_score) > ROBUST_Z_THRESHOLD
            lower_bound = median - (
                ROBUST_Z_THRESHOLD * mad / 0.6745
            )
            upper_bound = median + (
                ROBUST_Z_THRESHOLD * mad / 0.6745
            )
        else:
            method = "IQR"
            lower_bound = q1 - IQR_MULTIPLIER * iqr
            upper_bound = q3 + IQR_MULTIPLIER * iqr
            is_outlier = (
                claim_amount < lower_bound
                or claim_amount > upper_bound
            )

        return response(200, {
            "status": "REVIEW" if is_outlier else "NOT_OUTLIER",
            "claimType": claim_type,
            "claimAmountINR": claim_amount,
            "sampleSize": len(amounts),
            "method": method,
            "threshold": (
                ROBUST_Z_THRESHOLD
                if method == "ROBUST_Z_SCORE"
                else IQR_MULTIPLIER
            ),
            "medianINR": round(median, 2),
            "madINR": round(mad, 2),
            "q1INR": round(q1, 2),
            "q3INR": round(q3, 2),
            "lowerBoundINR": round(lower_bound, 2),
            "upperBoundINR": round(upper_bound, 2),
            "robustZScore": (
                round(robust_z_score, 4)
                if robust_z_score is not None
                else None
            ),
            "message": (
                "Claim amount is outside the statistical bounds for comparable reference claims."
                if is_outlier
                else "Claim amount is within the statistical bounds for comparable reference claims."
            ),
            "disclaimer": "An outlier is a screening signal, not proof of fraud."
        })

    except Exception:
        print("Unexpected error during outlier detection.")
        return response(500, {
            "error": "Unable to assess the claim amount."
        })
