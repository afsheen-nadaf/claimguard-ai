import base64
import importlib.util
import json
from pathlib import Path
from unittest.mock import patch

import boto3
from botocore.exceptions import ClientError

from claimguard_auth import identity_from_event

BACKEND_DIR = Path(__file__).resolve().parents[1]


def load_fetch_app(monkeypatch, table):
    class DynamoDB:
        def Table(self, name):
            return table

    monkeypatch.setenv("OPERATIONAL_CLAIMS_TABLE", "claims")
    monkeypatch.setenv("AWS_REGION", "ap-southeast-2")
    monkeypatch.setenv("CORS_ORIGIN", "http://localhost:5173")
    with patch.object(boto3, "resource", return_value=DynamoDB()):
        spec = importlib.util.spec_from_file_location(
            "fetch_claims_app", BACKEND_DIR / "fetch_claims_api" / "app.py"
        )
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
    return module


def load_save_app(monkeypatch, table):
    class DynamoDB:
        def Table(self, name):
            return table

    monkeypatch.setenv("OPERATIONAL_CLAIMS_TABLE", "claims")
    monkeypatch.setenv("AWS_REGION", "ap-southeast-2")
    monkeypatch.setenv("CORS_ORIGIN", "http://localhost:5173")
    with patch.object(boto3, "resource", return_value=DynamoDB()):
        spec = importlib.util.spec_from_file_location(
            "save_claim_results_app",
            BACKEND_DIR / "save_claim_results_api" / "app.py",
        )
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
    return module


def event_for(groups, user_id="user-1", query=None):
    return {
        "httpMethod": "GET",
        "queryStringParameters": query or {},
        "requestContext": {
            "authorizer": {
                "claims": {
                    "sub": user_id,
                    "cognito:groups": groups,
                }
            }
        },
    }


def test_identity_accepts_list_and_serialized_groups():
    assert identity_from_event(event_for(["adjuster"]))["groups"] == {"adjuster"}
    assert identity_from_event(event_for('["claimant"]'))["groups"] == {"claimant"}


def test_claimant_history_queries_only_their_user_id(monkeypatch):
    class Table:
        args = None

        def query(self, **args):
            self.args = args
            return {
                "Items": [{
                    "claimId": "claim-1",
                    "userId": "user-1",
                    "incidentDate": "2025-01-01",
                    "duplicateMatches": [{"claimId": "other-user-claim"}],
                }],
                "LastEvaluatedKey": {
                    "userId": "user-1",
                    "incidentDate": "2025-01-01",
                    "claimId": "claim-1",
                },
            }

    table = Table()
    app = load_fetch_app(monkeypatch, table)
    result = app.lambda_handler(event_for(["claimant"], query={"limit": "10"}), None)
    body = json.loads(result["body"])

    assert result["statusCode"] == 200
    assert table.args["IndexName"] == "UserIdIndex"
    assert table.args["Limit"] == 10
    assert body["claims"][0]["claimId"] == "claim-1"
    assert "duplicateMatches" not in body["claims"][0]
    decoded_cursor = json.loads(
        base64.urlsafe_b64decode(
            body["nextCursor"] + "=" * (-len(body["nextCursor"]) % 4)
        ).decode("utf-8")
    )
    assert decoded_cursor["userId"] == "user-1"


def test_adjuster_history_uses_bounded_scan_and_returns_match_details(monkeypatch):
    class Table:
        args = None

        def scan(self, **args):
            self.args = args
            return {
                "Items": [{
                    "claimId": "claim-1",
                    "duplicateMatches": [{"claimId": "claim-2"}],
                }],
            }

    table = Table()
    app = load_fetch_app(monkeypatch, table)
    result = app.lambda_handler(event_for("adjuster", query={"limit": "20"}), None)
    body = json.loads(result["body"])

    assert result["statusCode"] == 200
    assert table.args["Limit"] == 20
    assert body["claims"][0]["duplicateMatches"][0]["claimId"] == "claim-2"


def test_claimant_cannot_read_another_users_claim(monkeypatch):
    class Table:
        def get_item(self, **args):
            return {"Item": {"claimId": "claim-2", "userId": "user-2"}}

    app = load_fetch_app(monkeypatch, Table())
    result = app.lambda_handler(
        event_for(["claimant"], query={"claimId": "claim-2"}),
        None,
    )

    assert result["statusCode"] == 403
    assert result["headers"]["Access-Control-Allow-Origin"] == "http://localhost:5173"


def test_missing_identity_returns_cors_enabled_401(monkeypatch):
    class Table:
        pass

    app = load_fetch_app(monkeypatch, Table())
    result = app.lambda_handler({"queryStringParameters": {}}, None)
    assert result["statusCode"] == 401
    assert result["headers"]["Access-Control-Allow-Headers"] == "Content-Type,Authorization"


def test_screening_results_update_requires_claim_owner(monkeypatch):
    class Table:
        calls = []

        def update_item(self, **args):
            self.calls.append(args)

    table = Table()
    app = load_save_app(monkeypatch, table)
    result = app.lambda_handler({
        "body": json.dumps({
            "claimId": "claim-1",
            "checkKey": "policy",
            "checkResult": {"status": "done", "result": {"state": "pass"}},
        }),
        "requestContext": {
            "authorizer": {
                "claims": {
                    "sub": "user-1",
                    "cognito:groups": ["claimant"],
                }
            }
        },
    }, None)

    assert result["statusCode"] == 200
    assert len(table.calls) == 2
    assert table.calls[1]["ExpressionAttributeValues"][":userId"] == "user-1"


def test_screening_results_cannot_be_written_by_non_owner(monkeypatch):
    class Table:
        def update_item(self, **args):
            raise ClientError(
                {"Error": {"Code": "ConditionalCheckFailedException"}},
                "UpdateItem",
            )

    app = load_save_app(monkeypatch, Table())
    result = app.lambda_handler({
        "body": json.dumps({
            "claimId": "claim-1",
            "checkKey": "policy",
            "checkResult": {"status": "done"},
        }),
        "requestContext": {
            "authorizer": {
                "claims": {"sub": "user-2", "cognito:groups": ["claimant"]}
            }
        },
    }, None)
    assert result["statusCode"] == 403
