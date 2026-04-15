export type RoleId = 1 | 2 | 3;

export interface ApiMeta {
  page: number;
  per_page: number;
  total: number;
  pages: number;
}

export interface ApiResponse<T> {
  message: string;
  data: T;
  meta?: ApiMeta;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role_id: RoleId;
  role_name?: string;
  created_at?: string;
}

export interface Product {
  id: number;
  name: string;
  description?: string;
  seller_id: number;
  seller_name?: string;
  category_id: number;
  category_name?: string;
  discount?: number;
}

export interface ProductOption {
  id: number;
  product_id: number;
  name: string;
  product_name?: string;
}

export interface ProductOptionValue {
  id: number;
  option_id: number;
  value: string;
  option_name?: string;
  product_name?: string;
}

export interface ProductVariant {
  id: number;
  product_id: number;
  sku_code: string;
  price: number;
  stock: number;
  option_value_ids?: number[];
  product_name?: string;
}

export interface Category {
  id: number;
  name: string;
}

export interface Order {
  id: number;
  user_id: number;
  seller_id?: number;
  total_price: number;
  status_id: number;
  status_name?: string;
  voucher_discount?: number;
  created_at?: string;
  user_name?: string;
  user_email?: string;
  items_count?: number;
}

export interface OrderItem {
  id: number;
  order_id: number;
  variant_id: number;
  unit_price: number;
  quantity: number;
  variant_sku_code?: string;
  product_name?: string;
}

export interface CartItem {
  lineKey: string;
  variantId: number;
  productId: number;
  sellerId: number;
  productName: string;
  skuCode: string;
  unitPrice: number;
  quantity: number;
  optionSummary?: string;
}
