import time
from unittest.mock import MagicMock

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from jwt.exceptions import InvalidTokenError

import cognito_token


@pytest.fixture
def signing_setup(monkeypatch):
    pool_id = "ap-southeast-2_test"
    client_id = "public-client"
    region = "ap-southeast-2"
    issuer = f"https://cognito-idp.{region}.amazonaws.com/{pool_id}"
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    jwks = MagicMock()
    jwks.uri = f"{issuer}/.well-known/jwks.json"
    jwks.get_signing_key_from_jwt.return_value.key = private_key.public_key()
    monkeypatch.setattr(cognito_token, "JWKS_CLIENT", jwks)
    monkeypatch.setenv("USER_POOL_ID", pool_id)
    monkeypatch.setenv("USER_POOL_CLIENT_ID", client_id)
    monkeypatch.setenv("AWS_REGION", region)
    return issuer, client_id, private_key


def signed_token(issuer, client_id, private_key, **overrides):
    now = int(time.time())
    claims = {
        "iss": issuer,
        "aud": client_id,
        "sub": "claimant-123",
        "iat": now,
        "exp": now + 300,
        "token_use": "id",
        "cognito:groups": '["claimant"]',
    }
    claims.update(overrides)
    return jwt.encode(claims, private_key, algorithm="RS256")


def test_verifies_signature_claims_and_user_groups(signing_setup):
    issuer, client_id, private_key = signing_setup
    token = signed_token(issuer, client_id, private_key)

    identity = cognito_token.verify_id_token({"Authorization": token})

    assert identity == {"userId": "claimant-123", "groups": {"claimant"}}


@pytest.mark.parametrize(
    "claim_overrides",
    [
        {"token_use": "access"},
        {"aud": "different-client"},
        {"iss": "https://wrong-issuer.example"},
        {"exp": int(time.time()) - 1},
    ],
)
def test_rejects_invalid_id_token_claims(signing_setup, claim_overrides):
    issuer, client_id, private_key = signing_setup
    token = signed_token(issuer, client_id, private_key, **claim_overrides)

    with pytest.raises(InvalidTokenError):
        cognito_token.verify_id_token({"authorization": f"Bearer {token}"})


def test_rejects_missing_authorization(signing_setup):
    with pytest.raises(InvalidTokenError):
        cognito_token.verify_id_token({})
