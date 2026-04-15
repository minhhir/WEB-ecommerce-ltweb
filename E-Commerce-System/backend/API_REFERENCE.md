# E-Commerce Backend API Reference

Tai lieu nay tong hop toan bo API dang ton tai trong he thong.

## Quy uoc chung

- Response wrapper thuong dung:
  - `message`: string
  - `data`: object hoac array
  - `meta`: object phan trang (chi co o API list)

- Meta phan trang:
```json
{
  "page": 1,
  "per_page": 10,
  "total": 100,
  "pages": 10
}
```

## Models

### Role
```json
{
  "id": 1,
  "name": "admin"
}
```

### User
```json
{
  "id": 1,
  "name": "Nguyen Van A",
  "email": "a@example.com",
  "role_id": 1,
  "created_at": "2026-04-13T10:20:30+00:00",
  "role_name": "admin"
}
```

### Category
```json
{
  "id": 1,
  "name": "Electronics"
}
```

### OrderStatus
```json
{
  "id": 1,
  "name": "pending"
}
```

### Product
```json
{
  "id": 1,
  "name": "Ao thun",
  "description": "Cotton",
  "seller_id": 2,
  "category_id": 1,
  "discount": 10.0,
  "seller_name": "Shop ABC",
  "category_name": "Fashion"
}
```

### ProductOption
```json
{
  "id": 1,
  "product_id": 1,
  "name": "Size",
  "product_name": "Ao thun"
}
```

### ProductOptionValue
```json
{
  "id": 1,
  "option_id": 1,
  "value": "L",
  "option_name": "Size",
  "product_name": "Ao thun"
}
```

### ProductVariant
```json
{
  "id": 1,
  "product_id": 1,
  "sku_code": "TSHIRT-L-RED",
  "price": 199000.0,
  "stock": 15,
  "product_name": "Ao thun"
}
```

### VariantAttribute
```json
{
  "id": 1,
  "variant_id": 1,
  "option_value_id": 1,
  "variant_sku_code": "TSHIRT-L-RED",
  "option_value": "L",
  "option_name": "Size",
  "product_name": "Ao thun"
}
```

### Order
```json
{
  "id": 1,
  "user_id": 2,
  "total_price": 398000.0,
  "status_id": 1,
  "voucher_discount": 10000.0,
  "created_at": "2026-04-13T10:20:30+00:00",
  "user_name": "Nguyen Van B",
  "user_email": "b@example.com",
  "status_name": "pending",
  "items_count": 2
}
```

### OrderItem
```json
{
  "id": 1,
  "order_id": 1,
  "variant_id": 1,
  "unit_price": 199000.0,
  "quantity": 2,
  "variant_sku_code": "TSHIRT-L-RED",
  "product_name": "Ao thun"
}
```

## Admin APIs

### GET /api/admin/roles
Model: `Role`
Response schema:
```json
{ "message": "Success", "data": ["Role"], "meta": "PaginationMeta" }
```

### POST /api/admin/roles
Model: `Role`
Request body:
```json
{ "name": "admin" }
```

### GET /api/admin/roles/<item_id>
Model: `Role`
Response schema:
```json
{ "message": "Success", "data": "Role" }
```

### PUT/PATCH /api/admin/roles/<item_id>
Model: `Role`
Request body:
```json
{ "name": "manager" }
```

### DELETE /api/admin/roles/<item_id>
Model: `Role`
Request body: none

### GET /api/admin/categories
Model: `Category`
Response schema:
```json
{ "message": "Success", "data": ["Category"], "meta": "PaginationMeta" }
```

### POST /api/admin/categories
Model: `Category`
Request body:
```json
{ "name": "Fashion" }
```

### GET /api/admin/categories/<item_id>
Model: `Category`
Response schema:
```json
{ "message": "Success", "data": "Category" }
```

### PUT/PATCH /api/admin/categories/<item_id>
Model: `Category`
Request body:
```json
{ "name": "Home" }
```

### DELETE /api/admin/categories/<item_id>
Model: `Category`
Request body: none

### GET /api/admin/order-statuses
Model: `OrderStatus`
Response schema:
```json
{ "message": "Success", "data": ["OrderStatus"], "meta": "PaginationMeta" }
```

### POST /api/admin/order-statuses
Model: `OrderStatus`
Request body:
```json
{ "name": "processing" }
```

### GET /api/admin/order-statuses/<item_id>
Model: `OrderStatus`
Response schema:
```json
{ "message": "Success", "data": "OrderStatus" }
```

### PUT/PATCH /api/admin/order-statuses/<item_id>
Model: `OrderStatus`
Request body:
```json
{ "name": "completed" }
```

### DELETE /api/admin/order-statuses/<item_id>
Model: `OrderStatus`
Request body: none

### GET /api/admin/users
Model: `User`
Response schema:
```json
{ "message": "Success", "data": ["User"], "meta": "PaginationMeta" }
```

### POST /api/admin/users
Model: `User`
Request body:
```json
{
  "name": "Nguyen Van C",
  "email": "c@example.com",
  "password": "123456",
  "role_id": 2
}
```

### GET /api/admin/users/<user_id>
Model: `User`
Response schema:
```json
{ "message": "Success", "data": "User" }
```

### PUT/PATCH /api/admin/users/<user_id>
Model: `User`
Request body:
```json
{
  "name": "Ten moi",
  "email": "new@example.com",
  "password": "newpass",
  "role_id": 1
}
```

### DELETE /api/admin/users/<user_id>
Model: `User`
Request body: none

### GET /api/admin/users/by-role/<role_id>
Model: `User`
Response schema:
```json
{ "message": "Success", "data": ["User"], "meta": "PaginationMeta" }
```

## Auth APIs

### POST /api/auth/register
Model: `User`
Request body:
```json
{
  "name": "Nguyen Van D",
  "email": "d@example.com",
  "password": "123456",
  "role_id": 2
}
```
Hoac:
```json
{
  "name": "Nguyen Van D",
  "email": "d@example.com",
  "password": "123456",
  "role_name": "user"
}
```

### POST /api/auth/login
Model: `User`
Request body:
```json
{
  "email": "d@example.com",
  "password": "123456"
}
```

## Product APIs

### GET /api/products
Model: `Product`
Response schema:
```json
{ "message": "Success", "data": ["Product"], "meta": "PaginationMeta" }
```

### POST /api/products
Model: `Product`
Request body:
```json
{
  "name": "Ao thun",
  "seller_id": 2,
  "category_id": 1,
  "description": "Cotton",
  "discount": 10
}
```

### GET /api/products/<item_id>
Model: `Product`
Response schema:
```json
{ "message": "Success", "data": "Product" }
```

### PUT/PATCH /api/products/<item_id>
Model: `Product`
Request body:
```json
{
  "name": "Ao polo",
  "description": "Premium",
  "seller_id": 2,
  "category_id": 1,
  "discount": 5
}
```

### DELETE /api/products/<item_id>
Model: `Product`
Request body: none

### GET /api/products/by-seller/<seller_id>
Model: `Product`
Response schema:
```json
{ "message": "Success", "data": ["Product"], "meta": "PaginationMeta" }
```

### GET /api/products/by-category/<category_id>
Model: `Product`
Response schema:
```json
{ "message": "Success", "data": ["Product"], "meta": "PaginationMeta" }
```

### GET /api/product-options
Model: `ProductOption`
Response schema:
```json
{ "message": "Success", "data": ["ProductOption"], "meta": "PaginationMeta" }
```

### POST /api/product-options
Model: `ProductOption`
Request body:
```json
{ "product_id": 1, "name": "Color" }
```

### GET /api/product-options/<item_id>
Model: `ProductOption`
Response schema:
```json
{ "message": "Success", "data": "ProductOption" }
```

### PUT/PATCH /api/product-options/<item_id>
Model: `ProductOption`
Request body:
```json
{ "product_id": 1, "name": "Size" }
```

### DELETE /api/product-options/<item_id>
Model: `ProductOption`
Request body: none

### GET /api/product-options/by-product/<product_id>
Model: `ProductOption`
Response schema:
```json
{ "message": "Success", "data": ["ProductOption"], "meta": "PaginationMeta" }
```

### GET /api/product-option-values
Model: `ProductOptionValue`
Response schema:
```json
{ "message": "Success", "data": ["ProductOptionValue"], "meta": "PaginationMeta" }
```

### POST /api/product-option-values
Model: `ProductOptionValue`
Request body:
```json
{ "option_id": 1, "value": "L" }
```

### GET /api/product-option-values/<item_id>
Model: `ProductOptionValue`
Response schema:
```json
{ "message": "Success", "data": "ProductOptionValue" }
```

### PUT/PATCH /api/product-option-values/<item_id>
Model: `ProductOptionValue`
Request body:
```json
{ "option_id": 1, "value": "XL" }
```

### DELETE /api/product-option-values/<item_id>
Model: `ProductOptionValue`
Request body: none

### GET /api/product-option-values/by-option/<option_id>
Model: `ProductOptionValue`
Response schema:
```json
{ "message": "Success", "data": ["ProductOptionValue"], "meta": "PaginationMeta" }
```

### GET /api/product-variants
Model: `ProductVariant`
Response schema:
```json
{ "message": "Success", "data": ["ProductVariant"], "meta": "PaginationMeta" }
```

### POST /api/product-variants
Model: `ProductVariant`
Request body:
```json
{
  "product_id": 1,
  "sku_code": "TSHIRT-L-RED",
  "price": 199000,
  "stock": 10
}
```

### GET /api/product-variants/<item_id>
Model: `ProductVariant`
Response schema:
```json
{ "message": "Success", "data": "ProductVariant" }
```

### PUT/PATCH /api/product-variants/<item_id>
Model: `ProductVariant`
Request body:
```json
{
  "product_id": 1,
  "sku_code": "TSHIRT-L-BLUE",
  "price": 189000,
  "stock": 5
}
```

### DELETE /api/product-variants/<item_id>
Model: `ProductVariant`
Request body: none

### GET /api/product-variants/by-product/<product_id>
Model: `ProductVariant`
Response schema:
```json
{ "message": "Success", "data": ["ProductVariant"], "meta": "PaginationMeta" }
```

### GET /api/variant-attributes
Model: `VariantAttribute`
Response schema:
```json
{ "message": "Success", "data": ["VariantAttribute"], "meta": "PaginationMeta" }
```

### POST /api/variant-attributes
Model: `VariantAttribute`
Request body:
```json
{ "variant_id": 1, "option_value_id": 1 }
```

### GET /api/variant-attributes/<item_id>
Model: `VariantAttribute`
Response schema:
```json
{ "message": "Success", "data": "VariantAttribute" }
```

### PUT/PATCH /api/variant-attributes/<item_id>
Model: `VariantAttribute`
Request body:
```json
{ "variant_id": 1, "option_value_id": 2 }
```

### DELETE /api/variant-attributes/<item_id>
Model: `VariantAttribute`
Request body: none

### GET /api/variant-attributes/by-variant/<variant_id>
Model: `VariantAttribute`
Response schema:
```json
{ "message": "Success", "data": ["VariantAttribute"], "meta": "PaginationMeta" }
```

### GET /api/variant-attributes/by-option-value/<option_value_id>
Model: `VariantAttribute`
Response schema:
```json
{ "message": "Success", "data": ["VariantAttribute"], "meta": "PaginationMeta" }
```

## Order APIs

### GET /api/orders
Model: `Order`
Response schema:
```json
{ "message": "Success", "data": ["Order"], "meta": "PaginationMeta" }
```

### POST /api/orders
Model: `Order`
Request body:
```json
{
  "user_id": 2,
  "total_price": 398000,
  "status_id": 1,
  "voucher_discount": 10000
}
```

### GET /api/orders/<item_id>
Model: `Order`
Response schema:
```json
{ "message": "Success", "data": { "Order": "includes order_items" } }
```

### PUT/PATCH /api/orders/<item_id>
Model: `Order`
Request body:
```json
{
  "user_id": 2,
  "total_price": 500000,
  "status_id": 2,
  "voucher_discount": 0
}
```

### DELETE /api/orders/<item_id>
Model: `Order`
Request body: none

### GET /api/orders/by-user/<user_id>
Model: `Order`
Response schema:
```json
{ "message": "Success", "data": ["Order"], "meta": "PaginationMeta" }
```

### GET /api/orders/by-status/<status_id>
Model: `Order`
Response schema:
```json
{ "message": "Success", "data": ["Order"], "meta": "PaginationMeta" }
```

### GET /api/order-items
Model: `OrderItem`
Response schema:
```json
{ "message": "Success", "data": ["OrderItem"], "meta": "PaginationMeta" }
```

### POST /api/order-items
Model: `OrderItem`
Request body:
```json
{
  "order_id": 1,
  "variant_id": 1,
  "unit_price": 199000,
  "quantity": 2
}
```

### GET /api/order-items/<item_id>
Model: `OrderItem`
Response schema:
```json
{ "message": "Success", "data": "OrderItem" }
```

### PUT/PATCH /api/order-items/<item_id>
Model: `OrderItem`
Request body:
```json
{
  "order_id": 1,
  "variant_id": 1,
  "unit_price": 209000,
  "quantity": 1
}
```

### DELETE /api/order-items/<item_id>
Model: `OrderItem`
Request body: none

### GET /api/order-items/by-order/<order_id>
Model: `OrderItem`
Response schema:
```json
{ "message": "Success", "data": ["OrderItem"], "meta": "PaginationMeta" }
```

### GET /api/order-items/by-variant/<variant_id>
Model: `OrderItem`
Response schema:
```json
{ "message": "Success", "data": ["OrderItem"], "meta": "PaginationMeta" }
```

## System APIs

### GET /api/health
Model: `SystemHealth`
Response schema:
```json
{ "status": "ok" }
```

## Swagger APIs

### GET /apidocs/
Model: `SwaggerUI`
Response schema: HTML page

### GET /apidocs/index.html
Model: `SwaggerUI`
Response schema: HTML page

### GET /apispec_1.json
Model: `OpenAPISpec`
Response schema:
```json
{ "swagger": "2.0", "info": {}, "paths": {} }
```
