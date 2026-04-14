from werkzeug.security import check_password_hash, generate_password_hash

from app.extensions import db
from app.models.base import CrudMixin, SerializerMixin, TimestampMixin
from app.utils.rest import serialize_model


class Role(db.Model, SerializerMixin, CrudMixin):
	__tablename__ = "roles"

	id = db.Column(db.Integer, primary_key=True)
	name = db.Column(db.String(50), nullable=False, unique=True)

	users = db.relationship("User", back_populates="role", lazy="select")


class User(db.Model, SerializerMixin, CrudMixin, TimestampMixin):
	__tablename__ = "users"

	id = db.Column(db.Integer, primary_key=True)
	name = db.Column(db.String(100), nullable=False)
	email = db.Column(db.String(255), nullable=False, unique=True)
	password = db.Column(db.String(255), nullable=False)
	role_id = db.Column(db.Integer, db.ForeignKey("roles.id"), nullable=False)

	role = db.relationship("Role", back_populates="users", lazy="joined")

	def set_password(self, raw_password):
		self.password = generate_password_hash(raw_password)

	def check_password(self, raw_password):
		if not self.password:
			return False

		try:
			return check_password_hash(self.password, raw_password)
		except ValueError:
			return False

	def to_dict(self):
		data = serialize_model(self)
		data.pop("password", None)
		data["role_name"] = self.role.name if self.role else None
		return data
