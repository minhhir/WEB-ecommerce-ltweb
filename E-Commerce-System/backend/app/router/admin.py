from flask import Blueprint, request
from sqlalchemy import String, cast, or_
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models.order import OrderStatus
from app.models.product import Category
from app.models.user import Role, User
from app.utils.crud import json_payload_or_error
from app.utils.swagger_docs import collection_doc, create_doc, delete_doc, foreign_key_doc, item_doc, update_doc
from app.utils.rest import api_response, apply_search, error_response, paginate_query, serialize_model
from app.utils.auth import require_auth, require_role

bp = Blueprint("admin", __name__, url_prefix="/api/admin")


def _register_basic_resource(resource_name, model, required_fields, search_fields):
	def list_items():
		query = model.query.order_by(model.id.asc())
		search_term = request.args.get("q") or request.args.get("search")
		if search_term and search_fields:
			query = apply_search(query, model, search_term, search_fields)
		items, meta = paginate_query(query)
		return api_response([serialize_model(item) for item in items], meta=meta)

	def create_item():
		payload, error = json_payload_or_error(required_fields)
		if error:
			return error

		instance = model(**{field: payload[field] for field in required_fields})
		try:
			db.session.add(instance)
			db.session.commit()
		except IntegrityError as exc:
			db.session.rollback()
			return error_response(str(exc.orig), status=400)
		return api_response(serialize_model(instance), message=f"{resource_name[:-1].title()} created", status=201)

	def get_item(item_id):
		instance = db.session.get(model, item_id)
		if instance is None:
			return error_response(f"{resource_name[:-1].title()} not found", status=404)
		return api_response(serialize_model(instance))

	def update_item(item_id):
		instance = db.session.get(model, item_id)
		if instance is None:
			return error_response(f"{resource_name[:-1].title()} not found", status=404)

		payload = request.get_json(silent=True) or {}
		for field in required_fields:
			if field in payload:
				setattr(instance, field, payload[field])

		try:
			db.session.commit()
		except IntegrityError as exc:
			db.session.rollback()
			return error_response(str(exc.orig), status=400)
		return api_response(serialize_model(instance), message=f"{resource_name[:-1].title()} updated")

	def delete_item(item_id):
		instance = db.session.get(model, item_id)
		if instance is None:
			return error_response(f"{resource_name[:-1].title()} not found", status=404)
		db.session.delete(instance)
		db.session.commit()
		return api_response(message=f"{resource_name[:-1].title()} deleted")

	prefix = f"/{resource_name}"
	endpoint_base = resource_name.replace("-", "_")
	bp.add_url_rule(prefix, endpoint=f"{endpoint_base}_list", view_func=list_items, methods=["GET"])
	bp.add_url_rule(prefix, endpoint=f"{endpoint_base}_create", view_func=create_item, methods=["POST"])
	bp.add_url_rule(f"{prefix}/<int:item_id>", endpoint=f"{endpoint_base}_get", view_func=get_item, methods=["GET"])
	bp.add_url_rule(f"{prefix}/<int:item_id>", endpoint=f"{endpoint_base}_update", view_func=update_item, methods=["PUT", "PATCH"])
	bp.add_url_rule(f"{prefix}/<int:item_id>", endpoint=f"{endpoint_base}_delete", view_func=delete_item, methods=["DELETE"])

	resource_label = model.__name__
	list_items.__doc__ = collection_doc("Admin", f"List {resource_label}s", search_fields)
	create_item.__doc__ = create_doc("Admin", resource_label, required_fields)
	get_item.__doc__ = item_doc("Admin", resource_label)
	update_item.__doc__ = update_doc("Admin", resource_label, required_fields)
	delete_item.__doc__ = delete_doc("Admin", resource_label)


_register_basic_resource("roles", Role, ["name"], ["name"])
_register_basic_resource("categories", Category, ["name"], ["name"])
_register_basic_resource("order-statuses", OrderStatus, ["name"], ["name"])


@bp.get("/users")
def list_users():
	query = User.query.join(Role).order_by(User.id.asc())
	search_term = request.args.get("q") or request.args.get("search")
	if search_term:
		query = query.filter(
			or_(
				cast(User.id, String).ilike(f"%{search_term}%"),
				User.name.ilike(f"%{search_term}%"),
				User.email.ilike(f"%{search_term}%"),
				Role.name.ilike(f"%{search_term}%"),
			)
		)
	items, meta = paginate_query(query)
	return api_response([user.to_dict() for user in items], meta=meta)


@bp.post("/users")
def create_user():
	payload, error = json_payload_or_error(("name", "email", "password", "role_id"))
	if error:
		return error

	role = db.session.get(Role, payload["role_id"])
	if role is None:
		return error_response("Role not found", status=404)

	user = User(name=payload["name"], email=payload["email"], role_id=role.id)
	user.set_password(payload["password"])

	try:
		db.session.add(user)
		db.session.commit()
	except IntegrityError as exc:
		db.session.rollback()
		return error_response(str(exc.orig), status=400)

	return api_response(user.to_dict(), message="User created", status=201)


@bp.get("/users/<int:user_id>")
def get_user(user_id):
	user = db.session.get(User, user_id)
	if user is None:
		return error_response("User not found", status=404)
	return api_response(user.to_dict())


@bp.put("/users/<int:user_id>")
@bp.patch("/users/<int:user_id>")
def update_user(user_id):
	user = db.session.get(User, user_id)
	if user is None:
		return error_response("User not found", status=404)

	payload = request.get_json(silent=True) or {}
	if "name" in payload:
		user.name = payload["name"]
	if "email" in payload:
		user.email = payload["email"]
	if "password" in payload:
		user.set_password(payload["password"])
	if "role_id" in payload:
		role = db.session.get(Role, payload["role_id"])
		if role is None:
			return error_response("Role not found", status=404)
		user.role_id = role.id

	try:
		db.session.commit()
	except IntegrityError as exc:
		db.session.rollback()
		return error_response(str(exc.orig), status=400)

	return api_response(user.to_dict(), message="User updated")


@bp.delete("/users/<int:user_id>")
def delete_user(user_id):
	user = db.session.get(User, user_id)
	if user is None:
		return error_response("User not found", status=404)
	db.session.delete(user)
	db.session.commit()
	return api_response(message="User deleted")


@bp.get("/users/by-role/<int:role_id>")
def list_users_by_role(role_id):
	query = User.query.filter_by(role_id=role_id).order_by(User.id.asc())
	items, meta = paginate_query(query)
	return api_response([user.to_dict() for user in items], meta=meta)


list_users_by_role.__doc__ = foreign_key_doc("Admin", "users", "role_id")
