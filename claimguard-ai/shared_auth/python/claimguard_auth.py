import json
import os


def _group_names(value):
    if isinstance(value, list):
        return {str(group) for group in value}
    if not isinstance(value, str) or not value:
        return set()
    try:
        decoded = json.loads(value)
    except json.JSONDecodeError:
        decoded = None
    if isinstance(decoded, list):
        return {str(group) for group in decoded}
    return {group.strip() for group in value.split(",") if group.strip()}


def identity_from_event(event):
    request_context = event.get("requestContext") or {}
    authorizer = request_context.get("authorizer") or {}
    claims = authorizer.get("claims") or {}
    if not claims:
        claims = (authorizer.get("jwt") or {}).get("claims") or {}
    user_id = claims.get("sub")
    if not isinstance(user_id, str) or not user_id:
        return None
    return {
        "userId": user_id,
        "email": claims.get("email"),
        "groups": _group_names(claims.get("cognito:groups")),
    }


def is_adjuster(identity):
    return bool(identity and "adjuster" in identity["groups"])


def response(status_code, body, origin=None):
    allowed_origin = origin or os.environ.get("CORS_ORIGIN")
    headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Methods": "OPTIONS,GET,POST",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
    }
    if allowed_origin:
        headers["Access-Control-Allow-Origin"] = allowed_origin
    return {
        "statusCode": status_code,
        "headers": headers,
        "body": json.dumps(body, default=str),
    }


def unauthorized_response():
    return response(401, {"error": "Unauthorized"})


def forbidden_response():
    return response(403, {"error": "Forbidden"})
