import json
import os

import jwt
from jwt import PyJWKClient
from jwt.exceptions import InvalidTokenError

JWKS_CLIENT = None


class TokenConfigurationError(Exception):
    pass


def _groups(value):
    if isinstance(value, list):
        return {str(group) for group in value}
    if not isinstance(value, str) or not value:
        return set()
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        parsed = None
    if isinstance(parsed, list):
        return {str(group) for group in parsed}
    return {group.strip() for group in value.split(",") if group.strip()}


def verify_id_token(headers):
    user_pool_id = os.environ.get("USER_POOL_ID")
    client_id = os.environ.get("USER_POOL_CLIENT_ID")
    region = os.environ.get("AWS_REGION")
    if not user_pool_id or not client_id or not region:
        raise TokenConfigurationError("Cognito token verification is not configured.")

    authorization = next(
        (value for key, value in (headers or {}).items() if key.lower() == "authorization"),
        "",
    )
    if not isinstance(authorization, str) or not authorization.strip():
        raise InvalidTokenError("ID token required.")
    token = authorization.strip()
    if token.lower().startswith("bearer "):
        token = token[7:].strip()

    issuer = f"https://cognito-idp.{region}.amazonaws.com/{user_pool_id}"
    global JWKS_CLIENT
    if getattr(JWKS_CLIENT, "uri", None) != f"{issuer}/.well-known/jwks.json":
        JWKS_CLIENT = PyJWKClient(
            f"{issuer}/.well-known/jwks.json",
            cache_keys=True,
            timeout=5,
        )
    signing_key = JWKS_CLIENT.get_signing_key_from_jwt(token)
    claims = jwt.decode(
        token,
        signing_key.key,
        algorithms=["RS256"],
        audience=client_id,
        issuer=issuer,
        options={"require": ["exp", "iat", "sub", "token_use"]},
    )
    if claims.get("token_use") != "id":
        raise InvalidTokenError("An ID token is required.")
    return {"userId": claims["sub"], "groups": _groups(claims.get("cognito:groups"))}
