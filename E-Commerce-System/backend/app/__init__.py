from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager

from app.config import get_config
from app.extensions import db, swagger
from app.models import OrderStatus, Role
from app.router import register_blueprints


def seed_defaults():
	roles = ["admin", "seller", "buyer"]
	for role_name in roles:
		if not Role.query.filter_by(name=role_name).first():
			db.session.add(Role(name=role_name))

	default_statuses = ["pending", "processing", "completed", "cancelled"]
	existing_statuses = {row.name for row in OrderStatus.query.all()}
	for status_name in default_statuses:
		if status_name not in existing_statuses:
			db.session.add(OrderStatus(name=status_name))

	db.session.commit()

def create_app():
	app = Flask(__name__)
	app.config.from_object(get_config())
	CORS(
		app,
		resources={
			r"/api/*": {
				"origins": ["http://localhost:3000", "http://127.0.0.1:3000"],
			}
		},
	)

	db.init_app(app)
	swagger.init_app(app)
	jwt = JWTManager(app)

	with app.app_context():
		from app import models  # noqa: F401

		db.create_all()
		seed_defaults()

	register_blueprints(app)

	@app.get("/api/health")
	def health_check():
		"""
		Health check endpoint.
		---
		responses:
		  200:
			description: API is running
			schema:
			  type: object
			  properties:
				status:
				  type: string
		"""
		return jsonify({"status": "ok"})

	return app
