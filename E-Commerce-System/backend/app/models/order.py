from app.extensions import db
from app.models.base import CrudMixin, SerializerMixin, TimestampMixin

class OrderStatus(db.Model, SerializerMixin, CrudMixin):
	__tablename__ = "order_statuses"
	id = db.Column(db.Integer, primary_key=True)
	name = db.Column(db.String(50), nullable=False, unique=True)
	orders = db.relationship("Order", back_populates="status", lazy="select")

class Order(db.Model, SerializerMixin, CrudMixin, TimestampMixin):
	__tablename__ = "orders"
	id = db.Column(db.Integer, primary_key=True)
	user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
	seller_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True) # Để True tránh lỗi nếu lỡ có order cũ ko có seller
	total_price = db.Column(db.Numeric(15, 2), nullable=False)
	status_id = db.Column(db.Integer, db.ForeignKey("order_statuses.id"), nullable=False)
	voucher_discount = db.Column(db.Numeric(15, 2), nullable=False, server_default="0")
	user = db.relationship("User", foreign_keys=[user_id], lazy="joined")
	seller = db.relationship("User", foreign_keys=[seller_id], lazy="joined")
	status = db.relationship("OrderStatus", back_populates="orders", lazy="joined")
	items = db.relationship("OrderItem", back_populates="order", cascade="all, delete-orphan", lazy="select")

class OrderItem(db.Model, SerializerMixin, CrudMixin):
	__tablename__ = "order_items"
	id = db.Column(db.Integer, primary_key=True)
	order_id = db.Column(db.Integer, db.ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
	variant_id = db.Column(db.Integer, db.ForeignKey("product_variants.id"), nullable=False)
	unit_price = db.Column(db.Numeric(15, 2), nullable=False)
	quantity = db.Column(db.Integer, nullable=False)
	order = db.relationship("Order", back_populates="items", lazy="joined")
	variant = db.relationship("ProductVariant", lazy="joined")