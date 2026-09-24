// Shared admin DTO types (mirrors backend schemas.py)

export interface AdminUser {
  id: number;
  email: string;
  username: string;
  avatar_url?: string | null;
  role: string;
  status: string;
  email_verified: boolean;
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

export interface Product {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  price_cents: number;
  stock: number;
  images: string[];
  status: string;
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
}

export interface UserRow {
  id: number;
  email: string;
  username: string;
  role: string;
  status: string;
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
}

export interface Order {
  id: number;
  order_no: string;
  user_id?: number;
  user_email?: string | null;
  status: string;
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
