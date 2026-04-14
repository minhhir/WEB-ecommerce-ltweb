from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.utils.rest import api_response, error_response, get_json_payload


def commit_instance(instance, status=201, message="Success"):
    try:
        db.session.add(instance)
        db.session.commit()
    except IntegrityError as exc:
        db.session.rollback()
        return error_response(str(exc.orig), status=400)
    return api_response(instance.to_dict(), message=message, status=status)


def save_changes(message="Updated"):
    try:
        db.session.commit()
    except IntegrityError as exc:
        db.session.rollback()
        return error_response(str(exc.orig), status=400)
    return api_response(message=message)


def delete_instance(instance, message="Deleted"):
    db.session.delete(instance)
    return save_changes(message=message)


def extract_fields(payload, fields):
    return {field: payload[field] for field in fields if field in payload}


def require_fields(payload, fields):
    missing = [field for field in fields if field not in payload]
    if missing:
        return error_response(f"Missing required fields: {', '.join(missing)}", status=400)
    return None


def json_payload_or_error(required_fields=()):
    payload = get_json_payload()
    error = require_fields(payload, required_fields)
    return payload, error