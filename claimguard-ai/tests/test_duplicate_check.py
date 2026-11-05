
import importlib
import json
import os
import sys
from io import BytesIO

import boto3
import pytest
from moto import mock_aws
from PIL import Image


BACKEND_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..")
)
DUPLICATE_API_DIR = os.path.join(BACKEND_DIR, "duplicate_check_api")

if DUPLICATE_API_DIR not in sys.path:
    sys.path.insert(0, DUPLICATE_API_DIR)


REGION = "ap-southeast-2"


def create_image_bytes(color="red"):
    """Create a small test PNG image in memory."""
    image = Image.new("RGB", (200, 200), color=color)
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


@pytest.fixture
def aws_environment(monkeypatch):
    """Create mocked S3 and DynamoDB resources for each test."""

    with mock_aws():
        monkeypatch.setenv("AWS_DEFAULT_REGION", REGION)
        monkeypatch.setenv("AWS_REGION", REGION)
        monkeypatch.setenv(
            "REFERENCE_CLAIMS_TABLE", "TestReferenceClaims"
        )
        monkeypatch.setenv(
            "OPERATIONAL_CLAIMS_TABLE", "TestOperationalClaims"
        )
        monkeypatch.setenv(
            "IMAGE_HASHES_TABLE", "TestImageHashes"
        )
        monkeypatch.setenv(
            "CLAIM_PACKETS_BUCKET", "test-claim-packets"
        )

        dynamodb = boto3.resource("dynamodb", region_name=REGION)
        s3 = boto3.client("s3", region_name=REGION)

        def create_claim_table(table_name):
            return dynamodb.create_table(
                TableName=table_name,
                KeySchema=[
                    {"AttributeName": "claimId", "KeyType": "HASH"}
                ],
                AttributeDefinitions=[
                    {"AttributeName": "claimId", "AttributeType": "S"},
                    {"AttributeName": "policyNumber", "AttributeType": "S"},
                    {"AttributeName": "incidentDate", "AttributeType": "S"},
                ],
                GlobalSecondaryIndexes=[
                    {
                        "IndexName": "PolicyNumberIncidentDateIndex",
                        "KeySchema": [
                            {
                                "AttributeName": "policyNumber",
                                "KeyType": "HASH",
                            },
                            {
                                "AttributeName": "incidentDate",
                                "KeyType": "RANGE",
                            },
                        ],
                        "Projection": {"ProjectionType": "ALL"},
                    }
                ],
                BillingMode="PAY_PER_REQUEST",
            )

        create_claim_table("TestReferenceClaims")
        create_claim_table("TestOperationalClaims")

        dynamodb.create_table(
            TableName="TestImageHashes",
            KeySchema=[
                {"AttributeName": "imageId", "KeyType": "HASH"}
            ],
            AttributeDefinitions=[
                {"AttributeName": "imageId", "AttributeType": "S"}
            ],
            BillingMode="PAY_PER_REQUEST",
        )

        s3.create_bucket(
            Bucket="test-claim-packets",
            CreateBucketConfiguration={
                "LocationConstraint": REGION
            },
        )

        # Import after environment variables and mocked AWS are ready.
        sys.modules.pop("app", None)
        app = importlib.import_module("app")

        yield app, s3, dynamodb

        sys.modules.pop("app", None)


def upload_test_image(s3, key, color="red"):
    """Upload a generated image to the mocked private S3 bucket."""
    s3.put_object(
        Bucket="test-claim-packets",
        Key=key,
        Body=create_image_bytes(color),
        ContentType="image/png",
    )


def make_event(body):
    return {
        "httpMethod": "POST",
        "body": json.dumps(body),
    }


def test_one_image_is_hashed_and_stored(aws_environment):
    app, s3, dynamodb = aws_environment

    upload_test_image(s3, "incoming/claim1.png")

    matches = app.process_claim_images(
        "CLAIM-001",
        ["incoming/claim1.png"],
    )

    table = dynamodb.Table("TestImageHashes")
    stored = table.scan()["Items"]

    assert matches == []
    assert len(stored) == 1
    assert stored[0]["claimId"] == "CLAIM-001"
    assert len(stored[0]["pHash"]) == 16


def test_three_images_are_hashed_and_stored(aws_environment):
    app, s3, dynamodb = aws_environment

    keys = [
        "incoming/image1.png",
        "incoming/image2.png",
        "incoming/image3.png",
    ]

    for index, key in enumerate(keys):
        upload_test_image(s3, key, color=["red", "blue", "green"][index])

    matches = app.process_claim_images("CLAIM-002", keys)

    stored = dynamodb.Table("TestImageHashes").scan()["Items"]

    assert matches == []
    assert len(stored) == 3
    assert {item["s3Key"] for item in stored} == set(keys)


def test_same_image_in_another_claim_is_flagged(aws_environment):
    app, s3, dynamodb = aws_environment

    upload_test_image(s3, "incoming/first-claim.png")
    upload_test_image(s3, "incoming/second-claim.png")

    app.process_claim_images(
        "CLAIM-001",
        ["incoming/first-claim.png"],
    )

    matches = app.process_claim_images(
        "CLAIM-002",
        ["incoming/second-claim.png"],
    )

    assert len(matches) == 1
    assert matches[0]["claimId"] == "CLAIM-001"
    assert matches[0]["hammingDistance"] == 0
    assert matches[0]["similarityPercent"] == 100.0


def test_same_claim_images_are_not_matched_against_themselves(
    aws_environment,
):
    app, s3, dynamodb = aws_environment

    upload_test_image(s3, "incoming/first.png")
    upload_test_image(s3, "incoming/second.png")

    app.process_claim_images(
        "CLAIM-001",
        ["incoming/first.png"],
    )

    matches = app.process_claim_images(
        "CLAIM-001",
        ["incoming/second.png"],
    )

    assert matches == []


def test_repeated_processing_does_not_create_extra_hash_records(
    aws_environment,
):
    app, s3, dynamodb = aws_environment

    key = "incoming/retry-image.png"
    upload_test_image(s3, key)

    app.process_claim_images("CLAIM-001", [key])
    app.process_claim_images("CLAIM-001", [key])

    stored = dynamodb.Table("TestImageHashes").scan()["Items"]

    assert len(stored) == 1


def test_four_image_keys_are_rejected(aws_environment):
    app, s3, dynamodb = aws_environment

    keys = [
        "incoming/image1.png",
        "incoming/image2.png",
        "incoming/image3.png",
        "incoming/image4.png",
    ]

    with pytest.raises(ValueError, match="maximum of 3"):
        app.validate_image_keys(keys)


def test_invalid_s3_key_is_rejected(aws_environment):
    app, s3, dynamodb = aws_environment

    with pytest.raises(ValueError):
        app.validate_image_keys(["other-folder/image.png"])


def test_amount_based_duplicate_detection_still_works(
    aws_environment,
):
    app, s3, dynamodb = aws_environment

    reference_table = dynamodb.Table("TestReferenceClaims")

    reference_table.put_item(
        Item={
            "claimId": "REFERENCE-001",
            "policyNumber": "POLICY-001",
            "incidentDate": "2026-10-31",
            "claimAmountINR": 25000,
        }
    )

    event = make_event({
        "claimId": "NEW-CLAIM-001",
        "policyNumber": "POLICY-001",
        "incidentDate": "2026-10-31",
        "claimAmountINR": 25000,
        "imageKeys": [],
    })

    result = app.lambda_handler(event, None)
    body = json.loads(result["body"])

    assert result["statusCode"] == 200
    assert body["duplicateStatus"] == "REVIEW"
    assert body["matchType"] == "POLICY_DATE_AMOUNT_MATCH"
    assert body["matches"][0]["claimId"] == "REFERENCE-001"


def test_claim_with_four_images_returns_http_400(aws_environment):
    app, s3, dynamodb = aws_environment

    event = make_event({
        "claimId": "NEW-CLAIM-002",
        "policyNumber": "POLICY-002",
        "incidentDate": "2026-10-31",
        "claimAmountINR": 10000,
        "imageKeys": [
            "incoming/1.png",
            "incoming/2.png",
            "incoming/3.png",
            "incoming/4.png",
        ],
    })

    result = app.lambda_handler(event, None)
    body = json.loads(result["body"])

    assert result["statusCode"] == 400
    assert "maximum of 3" in body["error"]
