from decimal import Decimal, ROUND_HALF_UP

from flask import Blueprint, request
from sqlalchemy import String, cast, or_
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models.order import Order, OrderItem, OrderStatus
from app.models.product import ProductVariant
from app.models.user import User
from app.utils.crud import json_payload_or_error
from app.utils.swagger_docs import collection_doc, create_doc, delete_doc, foreign_key_doc, item_doc, update_doc
from app.utils.rest import api_response, error_response, paginate_query, serialize_model


bp = Blueprint("orders", __name__, url_prefix="/api")
_MONEY_QUANTIZER = Decimal("0.01")


def _decimal(value):
	if isinstance(value, Decimal):
		return value
	if value is None:
		return Decimal("0")
	return Decimal(str(value))


def _money(value):
	return _decimal(value).quantize(_MONEY_QUANTIZER, rounding=ROUND_HALF_UP)


def _discounted_unit_price(variant):
	base_price = _decimal(variant.price)
	discount_percent = _decimal(variant.product.discount if variant.product else 0)
	discounted_price = base_price * (Decimal("1") - (discount_percent / Decimal("100")))
	return _money(max(discounted_price, Decimal("0")))


def _order_total(order, extra_item=None, excluded_item=None):
	subtotal = Decimal("0")
	for item in order.items or []:
		if excluded_item is not None and item.id == excluded_item.id:
			continue
		subtotal += _decimal(item.unit_price) * _decimal(item.quantity)
	if extra_item is not None:
		subtotal += _decimal(extra_item.unit_price) * _decimal(extra_item.quantity)
	total = subtotal - _decimal(order.voucher_discount)
	return _money(max(total, Decimal("0")))


def _recalculate_order_total(order, extra_item=None, excluded_item=None):
	order.total_price = _order_total(order, extra_item=extra_item, excluded_item=excluded_item)


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
		built = after_update(instance, payload)
		if built is not None:
			return built
	try:
		db.session.commit()
	except IntegrityError as exc:
		db.session.rollback()
		return error_response(str(exc.orig), status=400)
	return api_response(instance.to_dict(), message=message)


def _register_resource(
	resource_name,
	model,
	label,
	create_fields,
	update_fields,
	serializer,
	list_query_builder,
	create_builder=None,
	update_builder=None,
	update_after_update=None,
	delete_builder=None,
):
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
		return _update_and_commit(instance, payload, update_fields, after_update=update_after_update, message=f"{label} updated")

	def delete_item(item_id):
		instance = db.session.get(model, item_id)
		if instance is None:
			return _not_found(label)
		if delete_builder:
			built = delete_builder(instance)
			if built is not None:
				return built
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

	list_items.__doc__ = collection_doc("Orders", f"List {label}s", ["id", "user_id", "status_id"])
	create_item.__doc__ = create_doc("Orders", label, create_fields)
	get_item.__doc__ = item_doc("Orders", label)
	update_item.__doc__ = update_doc("Orders", label, update_fields)
	delete_item.__doc__ = delete_doc("Orders", label)


def _order_serializer(order):
	data = serialize_model(order)
	data["user_name"] = order.user.name if order.user else None
	data["user_email"] = order.user.email if order.user else None
	data["seller_name"] = order.seller.name if order.seller else None
	data["seller_email"] = order.seller.email if order.seller else None
	data["status_name"] = order.status.name if order.status else None
	data["items_count"] = len(order.items) if order.items is not None else 0
	data["order_items"] = [_item_serializer(item) for item in order.items] if order.items is not None else []
	return data


def _order_query(search_term):
	query = Order.query.join(User, Order.user_id == User.id).join(OrderStatus).order_by(Order.id.asc())
	if search_term:
		query = query.filter(
			or_(
				cast(Order.id, String).ilike(f"%{search_term}%"),
				cast(Order.user_id, String).ilike(f"%{search_term}%"),
				cast(Order.seller_id, String).ilike(f"%{search_term}%"),
				OrderStatus.name.ilike(f"%{search_term}%"),
				User.name.ilike(f"%{search_term}%"),
				User.email.ilike(f"%{search_term}%"),
			)
		)
	return query


def _create_order(payload):
	user, error = _fk(User, payload["user_id"], "User")
	if error:
		return error
	seller, error = _fk(User, payload["seller_id"], "Seller")
	if error:
		return error
	status, error = _fk(OrderStatus, payload["status_id"], "Order status")
	if error:
		return error
	order = Order(
		user_id=user.id,
		seller_id=seller.id,
		total_price=_money(0),
		status_id=status.id,
		voucher_discount=_money(payload.get("voucher_discount", 0)),
	)
	return _commit(order, "Order created", status=201)


def _update_order(instance, payload):
	if "user_id" in payload:
		user, error = _fk(User, payload["user_id"], "User")
		if error:
			return error
		instance.user_id = user.id
	if "seller_id" in payload:
		seller, error = _fk(User, payload["seller_id"], "Seller")
		if error:
			return error
		instance.seller_id = seller.id
	if "status_id" in payload:
		status, error = _fk(OrderStatus, payload["status_id"], "Order status")
		if error:
			return error
		instance.status_id = status.id
	return None


def _after_order_update(instance, payload):
	_recalculate_order_total(instance)
	return None


_register_resource(
	"orders",
	Order,
	"Order",
	["user_id", "seller_id", "status_id"],
	["user_id", "seller_id", "status_id", "voucher_discount"],
	_order_serializer,
	_order_query,
	create_builder=_create_order,
	update_builder=_update_order,
	update_after_update=_after_order_update,
)


def _item_serializer(item):
	data = serialize_model(item)
	data["variant_sku_code"] = item.variant.sku_code if item.variant else None
	data["product_name"] = item.variant.product.name if item.variant and item.variant.product else None
	return data


def _item_query(search_term):
	query = OrderItem.query.join(Order).join(ProductVariant).order_by(OrderItem.id.asc())
	if search_term:
		query = query.filter(
			or_(
				cast(OrderItem.id, String).ilike(f"%{search_term}%"),
				cast(OrderItem.order_id, String).ilike(f"%{search_term}%"),
				cast(OrderItem.variant_id, String).ilike(f"%{search_term}%"),
				ProductVariant.sku_code.ilike(f"%{search_term}%"),
			)
		)
	return query


def _create_item(payload):
	order, error = _fk(Order, payload["order_id"], "Order")
	if error:
		return error
	variant, error = _fk(ProductVariant, payload["variant_id"], "Product variant")
	if error:
		return error
	quantity = payload["quantity"]
	if quantity <= 0:
		return error_response("Quantity must be greater than 0", status=400)
	remaining_stock = variant.stock - quantity
	if remaining_stock < 0:
		return error_response("Out of stock for selected variant", status=400)
	variant.stock = remaining_stock
	item = OrderItem(
		order_id=order.id,
		variant_id=variant.id,
		unit_price=_discounted_unit_price(variant),
		quantity=quantity,
	)
	_recalculate_order_total(order, extra_item=item)
	return _commit(item, "Order item created", status=201)


def _update_item(instance, payload):
	previous_order_id = instance.order_id
	if "order_id" in payload:
		order, error = _fk(Order, payload["order_id"], "Order")
		if error:
			return error
		instance.order_id = order.id
	if "variant_id" in payload:
		variant, error = _fk(ProductVariant, payload["variant_id"], "Product variant")
		if error:
			return error
		instance.variant_id = variant.id
		instance.unit_price = _discounted_unit_price(variant)
	if previous_order_id != instance.order_id:
		instance._previous_order_id = previous_order_id
	return None


def _after_item_update(instance, payload):
	previous_order_id = getattr(instance, "_previous_order_id", None)
	current_order = db.session.get(Order, instance.order_id)
	if current_order is not None:
		_recalculate_order_total(current_order)
	if previous_order_id is not None and previous_order_id != instance.order_id:
		previous_order = db.session.get(Order, previous_order_id)
		if previous_order is not None:
			_recalculate_order_total(previous_order)
		try:
			delattr(instance, "_previous_order_id")
		except AttributeError:
			pass
	return None


def _before_item_delete(instance):
	order = instance.order or db.session.get(Order, instance.order_id)
	if order is not None:
		_recalculate_order_total(order, excluded_item=instance)
	return None


_register_resource(
	"order-items",
	OrderItem,
	"Order item",
	["order_id", "variant_id", "quantity"],
	["order_id", "variant_id", "quantity"],
	_item_serializer,
	_item_query,
	create_builder=_create_item,
	update_builder=_update_item,
	update_after_update=_after_item_update,
	delete_builder=_before_item_delete,
)


@bp.get("/orders/by-user/<int:user_id>")
def list_orders_by_user(user_id):
	query = Order.query.filter_by(user_id=user_id).order_by(Order.id.asc())
	items, meta = paginate_query(query)
	return api_response([_order_serializer(item) for item in items], meta=meta)


list_orders_by_user.__doc__ = foreign_key_doc("Orders", "orders", "user_id")


@bp.get("/orders/by-status/<int:status_id>")
def list_orders_by_status(status_id):
	query = Order.query.filter_by(status_id=status_id).order_by(Order.id.asc())
	items, meta = paginate_query(query)
	return api_response([_order_serializer(item) for item in items], meta=meta)


list_orders_by_status.__doc__ = foreign_key_doc("Orders", "orders", "status_id")


@bp.get("/orders/by-seller/<int:seller_id>")
def list_orders_by_seller(seller_id):
	query = Order.query.filter_by(seller_id=seller_id).order_by(Order.id.asc())
	items, meta = paginate_query(query)
	return api_response([_order_serializer(item) for item in items], meta=meta)


list_orders_by_seller.__doc__ = foreign_key_doc("Orders", "orders", "seller_id")


@bp.get("/order-items/by-order/<int:order_id>")
def list_order_items_by_order(order_id):
	query = OrderItem.query.filter_by(order_id=order_id).order_by(OrderItem.id.asc())
	items, meta = paginate_query(query)
	return api_response([_item_serializer(item) for item in items], meta=meta)


list_order_items_by_order.__doc__ = foreign_key_doc("Orders", "order items", "order_id")


@bp.get("/order-items/by-variant/<int:variant_id>")
def list_order_items_by_variant(variant_id):
	query = OrderItem.query.filter_by(variant_id=variant_id).order_by(OrderItem.id.asc())
	items, meta = paginate_query(query)
	return api_response([_item_serializer(item) for item in items], meta=meta)


list_order_items_by_variant.__doc__ = foreign_key_doc("Orders", "order items", "variant_id")
