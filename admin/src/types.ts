// Shared admin DTO types (mirrors backend schemas.py)

export interface AdminUser {
  id: number;
  email: string;
  username: string;
  avatar_url?: string | null;
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
  user: AdminUser;
}

export interface Dashboard {
  users_total: number;
  products_total: number;
  products_active: number;
  orders_total: number;
  orders_paid: number;
  revenue_cents: number;
  pending_payment: number;
}

// role helpers shared across pages
export const isSuperAdmin = (u?: AdminUser | object | null): boolean =>
  !!(u as AdminUser | undefined)?.role && (u as AdminUser).role === "super_admin";

export interface Product {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  price_cents: number;
  stock: number;
  images: string[];
  status: string;
  discount_percent: number;
  created_at: string;
}

export interface ProductPage {
  items: Product[];
  total: number;
  page: number;
  pages: number;
}

export interface Invite {
  id: number;
  code: string;
  max_uses: number;
  used_count: number;
  expires_at: string | null;
  status: string;
  remark: string | null;
  created_at: string;
}

export interface InvitePage {
  items: Invite[];
  total: number;
}

export interface Settings {
  invite_required: boolean;
  shop_name?: string;
}

export interface UserRow {
  id: number;
  email: string;
  username: string;
  role: string;
  status: string;
  discount_percent: number;
  invite_code_id: number | null;
  created_at: string;
}

export interface UserPage {
  items: UserRow[];
  total: number;
  page: number;
  pages: number;
}

export interface OrderItem {
  product_id: number;
  title: string;
  unit_price_cents: number;
  qty: number;
  // price snapshots (server-side pricing engine; missing on very old rows)
  original_price_cents?: number;
  line_total_cents?: number;
}

export interface Order {
  id: number;
  order_no: string;
  user_id?: number;
  user_email?: string | null;
  status: string;
  // shipping snapshot for fulfilment
  recipient_name?: string | null;
  recipient_phone?: string | null;
  address?: string | null;
  total_cents: number;
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

// ---------- Promotions (super_admin) ----------
export interface Promotion {
  id: number;
  name: string;
  kind: "percent_off" | "buy_n_get_1";
  value: number;
  status: string;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
}

// ---------- Revenue stats (super_admin) ----------
export interface RevenuePoint {
  date: string;
  revenue_cents: number;
}

export interface Revenue {
  realized_cents: number;
  expected_cents: number;
  currency: string;
  series: RevenuePoint[];
}
