// Shared API DTO types mirroring backend app/schemas.py

export interface User {
  id: number;
  email: string;
  username: string;
  avatar_url: string | null;
  role: string;
  status: string;
  email_verified: boolean;
  discount_percent?: number;
  created_at: string;
}

export interface AuthOut {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface Product {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  price_cents: number;
  stock: number;
  images: string[];
  status: string;
  discount_percent?: number;
  created_at: string;
}

export interface ProductPage {
  items: Product[];
  total: number;
  page: number;
  pages: number;
}

export interface CartItem {
  id: number;
  product_id: number;
  name: string;
  slug: string;
  price_cents: number;
  stock: number;
  images: string[];
  qty: number;
  subtotal_cents: number;
  product_discount_percent?: number;
  effective_unit_cents?: number;
}

export interface PromotionBrief {
  id: number;
  name: string;
  kind: "percent_off" | "buy_n_get_1";
  value: number;
}

export interface Cart {
  items: CartItem[];
  total_cents: number;
  subtotal_cents?: number;
  user_discount_percent?: number;
  user_discount_cents?: number;
  promotion?: PromotionBrief | null;
}

export interface OrderItem {
  product_id: number;
  title: string;
  unit_price_cents: number;
  original_price_cents?: number;
  qty: number;
  line_total_cents?: number;
}

export interface Order {
  id: number;
  order_no: string;
  status: string;
  total_cents: number;
  subtotal_cents?: number;
  discount_cents?: number;
  promotion_name?: string | null;
  paid_at: string | null;
  created_at: string;
  items: OrderItem[];
}

export interface OrderPage {
  items: Order[];
  total: number;
  page: number;
  pages: number;
}

export interface PayOut {
  payment_id: number;
  provider: string;
  status: string;
  pay_url: string | null;
  order_no: string;
}

export interface ShopSettings {
  invite_required: boolean;
  shop_name: string;
  promotion?: PromotionBrief | null;
}

export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "cancelled"
  | "completed";
