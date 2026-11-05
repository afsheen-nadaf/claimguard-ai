import hashlib
import json
import os
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation
from io import BytesIO

import boto3
import imagehash
from PIL import Image, UnidentifiedImageError
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

REGION = os.environ.get("AWS_REGION", "ap-southeast-2")
REFERENCE_TABLE_NAME = os.environ["REFERENCE_CLAIMS_TABLE"]
OPERATIONAL_TABLE_NAME = os.environ["OPERATIONAL_CLAIMS_TABLE"]
IMAGE_HASHES_TABLE_NAME = os.environ["IMAGE_HASHES_TABLE"]
BUCKET_NAME = os.environ["CLAIM_PACKETS_BUCKET"]

dynamodb = boto3.resource("dynamodb", region_name=REGION)
s3 = boto3.client("s3", region_name=REGION)

reference_table = dynamodb.Table(REFERENCE_TABLE_NAME)
operational_table = dynamodb.Table(OPERATIONAL_TABLE_NAME)
image_hashes_table = dynamodb.Table(IMAGE_HASHES_TABLE_NAME)

ALLOWED_ORIGIN = "http://localhost:5173"
INDEX_NAME = "PolicyNumberIncidentDateIndex"
MAX_IMAGES_PER_CLAIM = 3
MAX_IMAGE_BYTES = 10 * 1024 * 1024
PHASH_DISTANCE_THRESHOLD = 8


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
    """Find amount matches for one policy and incident date."""
    matches = []
    last_key = None
    amount_tolerance = Decimal("1.00")

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

            if abs(historical_amount - claim_amount) <= amount_tolerance:
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


def validate_image_keys(image_keys):
    """Validate the client-supplied S3 keys before accessing the bucket."""
    if image_keys is None:
        return []

    if not isinstance(image_keys, list):
        raise ValueError("imageKeys must be a list.")

    if len(image_keys) > MAX_IMAGES_PER_CLAIM:
        raise ValueError("A claim can contain a maximum of 3 images.")

    for key in image_keys:
        if not isinstance(key, str) or not key.startswith("incoming/"):
            raise ValueError("Each image key must refer to an uploaded incoming/ object.")

    if len(set(image_keys)) != len(image_keys):
        raise ValueError("imageKeys must not contain duplicate entries.")

    for key in image_keys:

        if ".." in key.split("/") or len(key) > 1024:
            raise ValueError("An image key is invalid.")

        if not key.lower().endswith((".jpg", ".jpeg", ".png")):
            raise ValueError("Only JPG, JPEG, and PNG images are supported.")

    return image_keys


def calculate_phash(s3_key):
    """Download one private S3 image and calculate its 64-bit perceptual hash."""
    result = s3.get_object(Bucket=BUCKET_NAME, Key=s3_key)

    if result.get("ContentLength", 0) > MAX_IMAGE_BYTES:
        raise ValueError("An uploaded image exceeds the 10 MB limit.")

    image_bytes = result["Body"].read(MAX_IMAGE_BYTES + 1)
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise ValueError("An uploaded image exceeds the 10 MB limit.")

    try:
        with Image.open(BytesIO(image_bytes)) as image:
            image.load()
            if image.format not in ("JPEG", "PNG"):
                raise ValueError("Only JPG, JPEG, and PNG images are supported.")
            return str(imagehash.phash(image.convert("RGB")))
    except (UnidentifiedImageError, OSError) as error:
        raise ValueError("An uploaded file is not a valid JPG or PNG image.") from error


def get_all_image_hashes():
    """Read the current image-hash dataset. Suitable for the initial small prototype."""
    items = []
    scan_args = {}

    while True:
        result = image_hashes_table.scan(**scan_args)
        items.extend(result.get("Items", []))

        last_key = result.get("LastEvaluatedKey")
        if not last_key:
            break

        scan_args["ExclusiveStartKey"] = last_key

    return items


def process_claim_images(claim_id, image_keys):
    """
    Hash incoming images, compare them with other claims, and store the hashes.
    Deterministic image IDs make repeated requests safe from duplicate records.
    """
    if not image_keys:
        return []

    historical_hashes = get_all_image_hashes()
    incoming = []

    for s3_key in image_keys:
        phash = calculate_phash(s3_key)
        image_id = hashlib.sha256(
            f"{claim_id}:{s3_key}".encode("utf-8")
        ).hexdigest()

        incoming.append({
            "imageId": image_id,
            "claimId": claim_id,
            "s3Key": s3_key,
            "pHash": phash,
        })

    matches = []

    for new_image in incoming:
        new_hash = imagehash.hex_to_hash(new_image["pHash"])

        for old_image in historical_hashes:
            # Never compare images belonging to the same claim.
            if old_image.get("claimId") == claim_id:
                continue

            old_phash = old_image.get("pHash")
            old_claim_id = old_image.get("claimId")
            if not old_phash or not old_claim_id:
                continue

            try:
                distance = new_hash - imagehash.hex_to_hash(old_phash)
            except (ValueError, TypeError):
                continue

            if distance <= PHASH_DISTANCE_THRESHOLD:
                matches.append({
                    "claimId": old_claim_id,
                    "matchedImageId": old_image.get("imageId"),
                    "uploadedImageKey": new_image["s3Key"],
                    "hammingDistance": distance,
                    "similarityPercent": round(
                        (64 - distance) / 64 * 100, 2
                    ),
                    "source": "IMAGE_HASH",
                })

    # Put only after all images have been downloaded and hashed successfully.
    # Repeated requests use the same imageId and therefore update the same item.
    for item in incoming:
        image_hashes_table.put_item(Item={
            **item,
            "createdAt": datetime.now(timezone.utc).isoformat(),
        })

    return matches


def lambda_handler(event, context):
    if event.get("httpMethod") == "OPTIONS":
        return response(200, {"message": "CORS preflight successful"})

    try:
        body = json.loads(event.get("body") or "{}")
        if not isinstance(body, dict):
            return response(400, {"error": "Request body must be a JSON object."})

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
        image_keys = validate_image_keys(body.get("imageKeys", []))

        if not claim_id or not policy_number:
            return response(400, {
                "error": "claimId and policyNumber cannot be blank"
            })

        date.fromisoformat(incident_date)

        if not claim_amount.is_finite() or claim_amount < 0:
            return response(400, {
                "error": "claimAmountINR must be a valid non-negative number"
            })

        # Check existing operational ID before processing images.
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
                # Reprocess safely: deterministic image IDs prevent extra records.
                image_matches = process_claim_images(claim_id, image_keys)
                return response(200, {
                    "duplicateStatus": "ALREADY_REGISTERED",
                    "matchType": None,
                    "message": "This claim ID is already registered. No second claim record was created.",
                    "registeredClaimId": claim_id,
                    "originalDuplicateStatus": existing_operational.get(
                        "duplicateStatus"
                    ),
                    "imageMatches": image_matches,
                    "imageMatchStatus": "REVIEW" if image_matches else "NO_MATCH",
                    "note": "Image matches are review signals, not proof of fraud.",
                })

            return response(200, {
                "duplicateStatus": "REVIEW",
                "matchType": "OPERATIONAL_CLAIM_ID_CONFLICT",
                "message": "This claim ID is already registered with different details.",
                "registeredClaimId": claim_id,
                "note": "Verify the submission; the existing record was not overwritten.",
            })

        # Check whether the incoming ID already exists in reference data.
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
            matches = find_amount_matches(
                reference_table, policy_number, incident_date, claim_amount
            )
            matches.extend(find_amount_matches(
                operational_table, policy_number, incident_date, claim_amount
            ))

            if matches:
                duplicate_status = "REVIEW"
                match_type = "POLICY_DATE_AMOUNT_MATCH"
            else:
                duplicate_status = "NO_MATCH"
                match_type = None

        # Compare images with other claims and persist their hashes.
        image_matches = process_claim_images(claim_id, image_keys)

        if image_matches:
            duplicate_status = "REVIEW"
            if not match_type:
                match_type = "IMAGE_SIMILARITY_MATCH"

        # Register the submission, including review-worthy claims.
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
                if matches or image_matches
                else "No configured duplicate match found. Claim registered."
            ),
            "matches": matches,
            "imageMatches": image_matches,
            "imageMatchStatus": "REVIEW" if image_matches else "NO_MATCH",
            "registeredClaimId": claim_id,
            "note": "A matching record is a review signal, not proof of fraud.",
        })

    except json.JSONDecodeError:
        return response(400, {
            "error": "Invalid JSON request body."
        })

    except ValueError as error:
        return response(400, {
            "error": str(error)
        })

    except InvalidOperation:
        return response(400, {
            "error": "claimAmountINR must be a valid number."
        })

    except Exception as error:
        print(f"Duplicate check failed: {type(error).__name__}: {error}")
        return response(500, {
            "error": "Duplicate detection could not be completed."
        })
