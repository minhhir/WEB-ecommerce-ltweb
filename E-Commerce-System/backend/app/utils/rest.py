from math import ceil
from decimal import Decimal
from datetime import datetime

from flask import jsonify, request
from sqlalchemy import String, cast, or_


def api_response(data=None, message="Success", status=200, meta=None):
    payload = {"message": message}
    if data is not None:
        payload["data"] = data
    if meta is not None:
        payload["meta"] = meta
    return jsonify(payload), status


def error_response(message, status=400, details=None):
    payload = {"message": message}
    if details is not None:
        payload["details"] = details
    return jsonify(payload), status


def get_json_payload():
    return request.get_json(silent=True) or {}


def serialize_model(instance, extra=None):
    data = {column.name: _json_safe(getattr(instance, column.name)) for column in instance.__table__.columns}
    if extra:
        data.update(extra)
    return data


def _json_safe(value):
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def apply_search(query, model, search_term, search_fields):
    if not search_term:
        return query
    filters = [cast(getattr(model, field), String).ilike(f"%{search_term}%") for field in search_fields]
    return query.filter(or_(*filters))


def paginate_query(query, default_per_page=10):
    try:
        page = max(int(request.args.get("page", 1)), 1)
        per_page = max(int(request.args.get("per_page", default_per_page)), 1)
    except (ValueError, TypeError):
        page = 1
        per_page = default_per_page
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    return pagination.items, {
        "page": pagination.page,
        "per_page": pagination.per_page,
        "total": pagination.total,
        "pages": pagination.pages,
    }