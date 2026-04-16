from flask import Blueprint, request
from sqlalchemy import String, cast, or_
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models.product import (
	Category,
	Product,
	ProductOption,
	ProductOptionValue,
	ProductVariant,
	VariantAttribute,
)
from app.models.user import User
from app.utils.crud import json_payload_or_error
from app.utils.cloudinary_service import upload_product_image
from app.utils.swagger_docs import collection_doc, create_doc, delete_doc, foreign_key_doc, item_doc, update_doc
from app.utils.rest import api_response, error_response, paginate_query, serialize_model


bp = Blueprint("products", __name__, url_prefix="/api")


def _not_found(label):
	return error_response(f"{label} not found", status=404)


def _fk(model, item_id, label):
	item = db.session.get(model, item_id)
	if item is None:
		return None, _not_found(label)
	return item, None


def _commit(instance, message, status=201):
	try:
		db.session.add(instance)
		db.session.commit()
	except IntegrityError as exc:
		db.session.rollback()
		return error_response(str(exc.orig), status=400)
	return api_response(instance.to_dict(), message=message, status=status)


def _update_and_commit(instance, payload, fields, after_update=None, message="Updated"):
	for field in fields:
		if field in payload:
			setattr(instance, field, payload[field])
	if after_update:
		after_update(instance, payload)
	try:
		db.session.commit()
	except IntegrityError as exc:
		db.session.rollback()
		return error_response(str(exc.orig), status=400)
	return api_response(instance.to_dict(), message=message)


def _register_resource(resource_name, model, label, create_fields, update_fields, serializer, list_query_builder, create_builder=None, update_builder=None):
	def list_items():
		search_term = request.args.get("q") or request.args.get("search")
		query = list_query_builder(search_term) if list_query_builder else model.query.order_by(model.id.asc())
		items, meta = paginate_query(query)
		return api_response([serializer(item) for item in items], meta=meta)

	def create_item():
		payload, error = json_payload_or_error(create_fields)
		if error:
			return error
		if create_builder:
			built = create_builder(payload)
			if built is not None:
				return built
		instance = model(**{field: payload[field] for field in create_fields})
		return _commit(instance, f"{label} created", status=201)

	def get_item(item_id):
		instance = db.session.get(model, item_id)
		if instance is None:
			return _not_found(label)
		return api_response(serializer(instance))

	def update_item(item_id):
		instance = db.session.get(model, item_id)
		if instance is None:
			return _not_found(label)
		payload = request.get_json(silent=True) or {}
		if update_builder:
			built = update_builder(instance, payload)
			if built is not None:
				return built
		return _update_and_commit(instance, payload, update_fields, message=f"{label} updated")

	def delete_item(item_id):
		instance = db.session.get(model, item_id)
		if instance is None:
			return _not_found(label)
		db.session.delete(instance)
		try:
			db.session.commit()
		except IntegrityError as exc:
			db.session.rollback()
			return error_response(str(exc.orig), status=400)
		return api_response(message=f"{label} deleted")

	base = f"/{resource_name}"
	endpoint = resource_name.replace("-", "_")
	bp.add_url_rule(base, endpoint=f"{endpoint}_list", view_func=list_items, methods=["GET"])
	bp.add_url_rule(base, endpoint=f"{endpoint}_create", view_func=create_item, methods=["POST"])
	bp.add_url_rule(f"{base}/<int:item_id>", endpoint=f"{endpoint}_get", view_func=get_item, methods=["GET"])
	bp.add_url_rule(f"{base}/<int:item_id>", endpoint=f"{endpoint}_update", view_func=update_item, methods=["PUT", "PATCH"])
	bp.add_url_rule(f"{base}/<int:item_id>", endpoint=f"{endpoint}_delete", view_func=delete_item, methods=["DELETE"])

	list_items.__doc__ = collection_doc("Products", f"List {label}s", ["name", "description", "id"])
	create_item.__doc__ = create_doc("Products", label, create_fields)
	get_item.__doc__ = item_doc("Products", label)
	update_item.__doc__ = update_doc("Products", label, update_fields)
	delete_item.__doc__ = delete_doc("Products", label)


def _product_serializer(product):
	data = serialize_model(product)
	data["seller_name"] = product.seller.name if product.seller else None
	data["category_name"] = product.category.name if product.category else None
	data["product_variants"] = [_variant_serializer(variant) for variant in product.variants] if product.variants is not None else []
	return data


def _product_query(search_term):
	query = Product.query.join(User).join(Category).order_by(Product.id.asc())
	if search_term:
		query = query.filter(
			or_(
				cast(Product.id, String).ilike(f"%{search_term}%"),
				Product.name.ilike(f"%{search_term}%"),
				Product.description.ilike(f"%{search_term}%"),
				User.name.ilike(f"%{search_term}%"),
				Category.name.ilike(f"%{search_term}%"),
			)
		)
	return query


def _create_product(payload):
	seller, error = _fk(User, payload["seller_id"], "User")
	if error:
		return error
	category, error = _fk(Category, payload["category_id"], "Category")
	if error:
		return error
	product = Product(
		name=payload["name"],
		description=payload.get("description"),
		image_src=payload.get("image_src"),
		seller_id=seller.id,
		category_id=category.id,
		discount=payload.get("discount", 0),
	)
	return _commit(product, "Product created", status=201)


def _update_product(instance, payload):
	if "seller_id" in payload:
		seller, error = _fk(User, payload["seller_id"], "User")
		if error:
			return error
		instance.seller_id = seller.id
	if "category_id" in payload:
		category, error = _fk(Category, payload["category_id"], "Category")
		if error:
			return error
		instance.category_id = category.id
	return None


_register_resource(
	"products",
	Product,
	"Product",
	["name", "seller_id", "category_id"],
	["name", "description", "image_src", "seller_id", "category_id", "discount"],
	_product_serializer,
	_product_query,
	create_builder=_create_product,
	update_builder=_update_product,
)


@bp.post("/products/<int:product_id>/image")
def upload_image_for_product(product_id):
	product = db.session.get(Product, product_id)
	if product is None:
		return _not_found("Product")

	image_file = request.files.get("image")
	if image_file is None:
		return error_response("Missing image file. Use form-data key 'image'", status=400)

	try:
		image_url = upload_product_image(image_file, folder=f"ecommerce/products/{product_id}")
	except ValueError as exc:
		return error_response(str(exc), status=400)
	except RuntimeError as exc:
		return error_response(str(exc), status=500)

	product.image_src = image_url
	try:
		db.session.commit()
	except IntegrityError as exc:
		db.session.rollback()
		return error_response(str(exc.orig), status=400)

	return api_response(_product_serializer(product), message="Product image uploaded")


upload_image_for_product.__doc__ = """Upload product image
---
tags:
  - Products
consumes:
  - multipart/form-data
parameters:
  - in: path
    name: product_id
    required: true
    schema:
      type: integer
  - in: formData
    name: image
    type: file
    required: true
    description: Product image file
responses:
  200:
    description: Product image uploaded
  400:
    description: Missing image file or validation error
  404:
    description: Not found
  500:
    description: Cloudinary configuration or upload error
"""


def _option_serializer(option):
	data = serialize_model(option)
	data["product_name"] = option.product.name if option.product else None
	return data


def _option_query(search_term):
	query = ProductOption.query.join(Product).order_by(ProductOption.id.asc())
	if search_term:
		query = query.filter(
			or_(
				cast(ProductOption.id, String).ilike(f"%{search_term}%"),
				ProductOption.name.ilike(f"%{search_term}%"),
				Product.name.ilike(f"%{search_term}%"),
			)
		)
	return query


def _create_option(payload):
	product, error = _fk(Product, payload["product_id"], "Product")
	if error:
		return error
	option = ProductOption(product_id=product.id, name=payload["name"])
	return _commit(option, "Product option created", status=201)


def _update_option(instance, payload):
	if "product_id" in payload:
		product, error = _fk(Product, payload["product_id"], "Product")
		if error:
			return error
		instance.product_id = product.id
	return None


_register_resource(
	"product-options",
	ProductOption,
	"Product option",
	["product_id", "name"],
	["product_id", "name"],
	_option_serializer,
	_option_query,
	create_builder=_create_option,
	update_builder=_update_option,
)


def _value_serializer(option_value):
	data = serialize_model(option_value)
	data["option_name"] = option_value.option.name if option_value.option else None
	data["product_name"] = option_value.option.product.name if option_value.option and option_value.option.product else None
	return data


def _value_query(search_term):
	query = ProductOptionValue.query.join(ProductOption).join(Product).order_by(ProductOptionValue.id.asc())
	if search_term:
		query = query.filter(
			or_(
				cast(ProductOptionValue.id, String).ilike(f"%{search_term}%"),
				ProductOptionValue.value.ilike(f"%{search_term}%"),
				ProductOption.name.ilike(f"%{search_term}%"),
				Product.name.ilike(f"%{search_term}%"),
			)
		)
	return query


def _create_value(payload):
	option, error = _fk(ProductOption, payload["option_id"], "Product option")
	if error:
		return error
	value = ProductOptionValue(
		option_id=option.id,
		value=payload["value"],
	)
	return _commit(value, "Product option value created", status=201)


def _update_value(instance, payload):
	if "option_id" in payload:
		option, error = _fk(ProductOption, payload["option_id"], "Product option")
		if error:
			return error
		instance.option_id = option.id
	return None


_register_resource(
	"product-option-values",
	ProductOptionValue,
	"Product option value",
	["option_id", "value"],
	["option_id", "value"],
	_value_serializer,
	_value_query,	
	create_builder=_create_value,
	update_builder=_update_value,
)


def _variant_serializer(variant):
	data = serialize_model(variant)
	data["product_name"] = variant.product.name if variant.product else None
	data["variant_attributes"] = [_variant_attribute_serializer(attribute) for attribute in variant.attributes] if variant.attributes is not None else []
	return data


def _variant_query(search_term):
	query = ProductVariant.query.join(Product).order_by(ProductVariant.id.asc())
	if search_term:
		query = query.filter(
			or_(
				cast(ProductVariant.id, String).ilike(f"%{search_term}%"),
				ProductVariant.sku_code.ilike(f"%{search_term}%"),
				Product.name.ilike(f"%{search_term}%"),
			)
		)
	return query


def _create_variant(payload):
	product, error = _fk(Product, payload["product_id"], "Product")
	if error:
		return error
	variant = ProductVariant(
		product_id=product.id,
		sku_code=payload["sku_code"],
		price=payload["price"],
		stock=payload.get("stock", 0),
	)
	return _commit(variant, "Product variant created", status=201)


def _update_variant(instance, payload):
	if "product_id" in payload:
		product, error = _fk(Product, payload["product_id"], "Product")
		if error:
			return error
		instance.product_id = product.id
	return None


_register_resource(
	"product-variants",
	ProductVariant,
	"Product variant",
	["product_id", "sku_code", "price"],
	["product_id", "sku_code", "price", "stock"],
	_variant_serializer,
	_variant_query,
	create_builder=_create_variant,
	update_builder=_update_variant,
)


def _variant_attribute_serializer(attribute):
	data = serialize_model(attribute)
	data["variant_sku_code"] = attribute.variant.sku_code if attribute.variant else None
	data["option_value"] = attribute.option_value.value if attribute.option_value else None
	data["option_name"] = attribute.option_value.option.name if attribute.option_value and attribute.option_value.option else None
	data["product_name"] = attribute.variant.product.name if attribute.variant and attribute.variant.product else None
	return data


def _variant_attribute_query(search_term):
	query = VariantAttribute.query.join(ProductVariant).join(ProductOptionValue).join(ProductOption).join(Product).order_by(VariantAttribute.id.asc())
	if search_term:
		query = query.filter(
			or_(
				cast(VariantAttribute.id, String).ilike(f"%{search_term}%"),
				cast(VariantAttribute.variant_id, String).ilike(f"%{search_term}%"),
				cast(VariantAttribute.option_value_id, String).ilike(f"%{search_term}%"),
				ProductVariant.sku_code.ilike(f"%{search_term}%"),
				ProductOptionValue.value.ilike(f"%{search_term}%"),
				ProductOption.name.ilike(f"%{search_term}%"),
				Product.name.ilike(f"%{search_term}%"),
			)
		)
	return query


def _create_variant_attribute(payload):
	variant, error = _fk(ProductVariant, payload["variant_id"], "Product variant")
	if error:
		return error
	option_value_id = None
	if "option_value_id" in payload and payload["option_value_id"] is not None:
		option_value, error = _fk(ProductOptionValue, payload["option_value_id"], "Product option value")
		if error:
			return error
		option_value_id = option_value.id
	attribute = VariantAttribute(variant_id=variant.id, option_value_id=option_value_id)
	return _commit(attribute, "Variant attribute created", status=201)


def _update_variant_attribute(instance, payload):
	if "variant_id" in payload:
		variant, error = _fk(ProductVariant, payload["variant_id"], "Product variant")
		if error:
			return error
		instance.variant_id = variant.id
	if "option_value_id" in payload:
		if payload["option_value_id"] is None:
			instance.option_value_id = None
		else:
			option_value, error = _fk(ProductOptionValue, payload["option_value_id"], "Product option value")
			if error:
				return error
			instance.option_value_id = option_value.id
	return None


_register_resource(
	"variant-attributes",
	VariantAttribute,
	"Variant attribute",
	["variant_id"],
	["variant_id", "option_value_id"],
	_variant_attribute_serializer,
	_variant_attribute_query,
	create_builder=_create_variant_attribute,
	update_builder=_update_variant_attribute,
)


@bp.get("/products/by-seller/<int:seller_id>")
def list_products_by_seller(seller_id):
	query = Product.query.filter_by(seller_id=seller_id).order_by(Product.id.asc())
	items, meta = paginate_query(query)
	return api_response([_product_serializer(item) for item in items], meta=meta)


list_products_by_seller.__doc__ = foreign_key_doc("Products", "products", "seller_id")


@bp.get("/products/by-category/<int:category_id>")
def list_products_by_category(category_id):
	query = Product.query.filter_by(category_id=category_id).order_by(Product.id.asc())
	items, meta = paginate_query(query)
	return api_response([_product_serializer(item) for item in items], meta=meta)


list_products_by_category.__doc__ = foreign_key_doc("Products", "products", "category_id")


@bp.get("/product-options/by-product/<int:product_id>")
def list_options_by_product(product_id):
	query = ProductOption.query.filter_by(product_id=product_id).order_by(ProductOption.id.asc())
	items, meta = paginate_query(query)
	return api_response([_option_serializer(item) for item in items], meta=meta)


list_options_by_product.__doc__ = foreign_key_doc("Products", "product options", "product_id")


@bp.get("/product-option-values/by-option/<int:option_id>")
def list_values_by_option(option_id):
	query = ProductOptionValue.query.filter_by(option_id=option_id).order_by(ProductOptionValue.id.asc())
	items, meta = paginate_query(query)
	return api_response([_value_serializer(item) for item in items], meta=meta)


list_values_by_option.__doc__ = foreign_key_doc("Products", "product option values", "option_id")


@bp.get("/product-variants/by-product/<int:product_id>")
def list_variants_by_product(product_id):
	query = ProductVariant.query.filter_by(product_id=product_id).order_by(ProductVariant.id.asc())
	items, meta = paginate_query(query)
	return api_response([_variant_serializer(item) for item in items], meta=meta)


list_variants_by_product.__doc__ = foreign_key_doc("Products", "product variants", "product_id")


@bp.get("/variant-attributes/by-variant/<int:variant_id>")
def list_variant_attributes_by_variant(variant_id):
	query = VariantAttribute.query.filter_by(variant_id=variant_id).order_by(VariantAttribute.id.asc())
	items, meta = paginate_query(query)
	return api_response([_variant_attribute_serializer(item) for item in items], meta=meta)


list_variant_attributes_by_variant.__doc__ = foreign_key_doc("Products", "variant attributes", "variant_id")


@bp.get("/variant-attributes/by-option-value/<int:option_value_id>")
def list_variant_attributes_by_option_value(option_value_id):
	query = VariantAttribute.query.filter_by(option_value_id=option_value_id).order_by(VariantAttribute.id.asc())
	items, meta = paginate_query(query)
	return api_response([_variant_attribute_serializer(item) for item in items], meta=meta)


list_variant_attributes_by_option_value.__doc__ = foreign_key_doc("Products", "variant attributes", "option_value_id")
