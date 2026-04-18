from app.extensions import db
from app.models.base import CrudMixin, SerializerMixin, TimestampMixin


class Category(db.Model, SerializerMixin, CrudMixin):
	__tablename__ = "categories"

	id = db.Column(db.Integer, primary_key=True)
	name = db.Column(db.String(100), nullable=False, unique=True)

	products = db.relationship("Product", back_populates="category", lazy="select")


class Product(db.Model, SerializerMixin, CrudMixin):
	__tablename__ = "products"

	id = db.Column(db.Integer, primary_key=True)
	name = db.Column(db.String(255), nullable=False)
	description = db.Column(db.Text)
	image_src = db.Column(db.String(512))
	seller_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
	category_id = db.Column(db.Integer, db.ForeignKey("categories.id"), nullable=False)
	discount = db.Column(db.Numeric(5, 2), nullable=False, server_default="0")

	seller = db.relationship("User", lazy="joined")
	category = db.relationship("Category", back_populates="products", lazy="joined")
	options = db.relationship("ProductOption", back_populates="product", cascade="all, delete-orphan", lazy="select")
	variants = db.relationship("ProductVariant", back_populates="product", cascade="all, delete-orphan", lazy="select")


class ProductOption(db.Model, SerializerMixin, CrudMixin):
	__tablename__ = "product_options"

	id = db.Column(db.Integer, primary_key=True)
	product_id = db.Column(db.Integer, db.ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
	name = db.Column(db.String(100), nullable=False)

	product = db.relationship("Product", back_populates="options", lazy="joined")
	values = db.relationship("ProductOptionValue", back_populates="option", cascade="all, delete-orphan", lazy="select")


class ProductOptionValue(db.Model, SerializerMixin, CrudMixin):
	__tablename__ = "product_option_values"

	id = db.Column(db.Integer, primary_key=True)
	option_id = db.Column(db.Integer, db.ForeignKey("product_options.id", ondelete="CASCADE"), nullable=False)
	value = db.Column(db.String(100), nullable=False)

	option = db.relationship("ProductOption", back_populates="values", lazy="joined")


class ProductVariant(db.Model, SerializerMixin, CrudMixin):
	__tablename__ = "product_variants"

	id = db.Column(db.Integer, primary_key=True)
	product_id = db.Column(db.Integer, db.ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
	sku_code = db.Column(db.String(100), nullable=False, unique=True)
	price = db.Column(db.Numeric(15, 2), nullable=False)
	stock = db.Column(db.Integer, nullable=False, server_default="0")

	product = db.relationship("Product", back_populates="variants", lazy="joined")
	attributes = db.relationship("VariantAttribute", back_populates="variant", cascade="all, delete-orphan", lazy="select")


class VariantAttribute(db.Model, SerializerMixin, CrudMixin):
	__tablename__ = "variant_attributes"
	__table_args__ = (db.UniqueConstraint("variant_id", "option_value_id", name="uq_variant_option_value"),)

	id = db.Column(db.Integer, primary_key=True)
	variant_id = db.Column(db.Integer, db.ForeignKey("product_variants.id", ondelete="CASCADE"), nullable=False)
	option_value_id = db.Column(db.Integer, db.ForeignKey("product_option_values.id"), nullable=True)

	variant = db.relationship("ProductVariant", back_populates="attributes", lazy="joined")
	option_value = db.relationship("ProductOptionValue", lazy="joined")

class Review(db.Model, SerializerMixin, CrudMixin, TimestampMixin):
	__tablename__ = "reviews"

	id = db.Column(db.Integer, primary_key=True)
	product_id = db.Column(db.Integer, db.ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
	user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
	rating = db.Column(db.Integer, nullable=False) # Lưu số sao từ 1 đến 5
	comment = db.Column(db.Text, nullable=True)

	product = db.relationship("Product", backref=db.backref("reviews", lazy="select", cascade="all, delete-orphan"))
	user = db.relationship("User", lazy="joined")