import csv
from decimal import Decimal
from pathlib import Path

import boto3

# Dataset folder relative to the outer Git repository.
DATASET_DIR = (
    Path(__file__).resolve().parents[2]
    / "claimguard-synthetic-reference-dataset"
    / "claimguard-reference-dataset"
)

REGION = "ap-southeast-2"
PROFILE = "claimguard-ai"

CLAIMS_TABLE = "ClaimGuardReferenceClaims"
POLICIES_TABLE = "ClaimGuardReferencePolicies"


def read_csv(filename):
    path = DATASET_DIR / filename
    if not path.exists():
        raise FileNotFoundError(f"Dataset file not found: {path}")

    with path.open("r", encoding="utf-8-sig", newline="") as file:
        return list(csv.DictReader(file))


def format_policy(row):
    return {
        "policyNumber": row["policyNumber"].strip(),
        "policyHolderName": row["policyHolderName"].strip(),
        "claimType": row["claimType"].strip(),
        "policyStatus": row["policyStatus"].strip(),
        "coverageStart": row["coverageStart"].strip(),
        "coverageEnd": row["coverageEnd"].strip(),
        "coverageLimitINR": Decimal(row["coverageLimitINR"].strip()),
        "synthetic": row.get("synthetic", "true").strip().lower() == "true",
    }


def format_claim(row):
    return {
        "claimId": row["claimId"].strip(),
        "claimantName": row["claimantName"].strip(),
        "claimType": row["claimType"].strip(),
        "policyNumber": row["policyNumber"].strip(),
        "incidentDate": row["incidentDate"].strip(),
        "claimAmountINR": Decimal(row["claimAmountINR"].strip()),
        "location": row["location"].strip(),
        "incidentDescription": row["incidentDescription"].strip(),
        "providerName": row["providerName"].strip(),
        "invoiceNumber": row["invoiceNumber"].strip(),
        "submissionDate": row["submissionDate"].strip(),
        "status": row["status"].strip(),
        "synthetic": row.get("synthetic", "true").strip().lower() == "true",
    }


def main():
    session = boto3.Session(profile_name=PROFILE, region_name=REGION)
    dynamodb = session.resource("dynamodb")

    claims = read_csv("reference_claims.csv")
    policies = read_csv("reference_policies.csv")

    claims_table = dynamodb.Table(CLAIMS_TABLE)
    policies_table = dynamodb.Table(POLICIES_TABLE)

    print(f"Dataset folder: {DATASET_DIR}")
    print(f"Claims to load: {len(claims)}")
    print(f"Policies to load: {len(policies)}")

    # Rerunning safely overwrites the same primary keys, not duplicate items.
    with claims_table.batch_writer() as batch:
        for record in claims:
            batch.put_item(Item=format_claim(record))

    with policies_table.batch_writer() as batch:
        for record in policies:
            batch.put_item(Item=format_policy(record))

    print("Reference data loaded successfully.")


if __name__ == "__main__":
    main()