from flask import Blueprint
from sqlalchemy.exc import IntegrityError
from flask_jwt_extended import create_access_token
from app.extensions import db
from app.models.user import Role, User
from app.utils.crud import json_payload_or_error
from app.utils.swagger_docs import auth_doc
from app.utils.rest import api_response, error_response

bp = Blueprint("auth", __name__, url_prefix="/api/auth")

@bp.post("/register")
def register():
	payload, error = json_payload_or_error(("name", "email", "password"))
	if error:
		return error

	role_id = payload.get("role_id")
	role = None
	if role_id is not None:
		role = db.session.get(Role, role_id)
	else:
		role = Role.query.filter_by(name=payload.get("role_name", "user")).first()

	if role is None:
		return error_response("Role not found. Create a role first or pass role_id.", status=400)

	user = User(
		name=payload["name"],
		email=payload["email"],
		role_id=role.id,
	)
	user.set_password(payload["password"])

	try:
		db.session.add(user)
		db.session.commit()
	except IntegrityError as exc:
		db.session.rollback()
		return error_response(str(exc.orig), status=400)

	return api_response(user.to_dict(), message="User registered", status=201)

register.__doc__ = auth_doc("Auth", "Register user", ["name", "email", "password", "role_id|role_name"])


@bp.post("/login")
def login():
	payload, error = json_payload_or_error(("email", "password"))
	if error:
		return error

	user = User.query.filter_by(email=payload["email"]).first()
	if user is None or not user.check_password(payload["password"]):
		return error_response("Invalid email or password", status=401)

	token = create_access_token(identity=str(user.id))
	return api_response(
		{"user": user.to_dict(), "access_token": token},
		message="Login successful"
	)

login.__doc__ = auth_doc("Auth", "Login user", ["email", "password"])