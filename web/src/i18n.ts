// i18n: zh/en dictionaries + language auto-detection from navigator.language,
// persisted choice in localStorage, and a React context provider.
import { createContext, useContext } from "react";

export type Lang = "zh" | "en";

// dictionary shape: flat key -> per-lang string; supports {n} interpolation
type Dict = Record<string, string>;

const zh: Dict = {
  // common
  loading: "加载中…",
  load_failed: "加载失败",
  ok: "好",
  // nav
  nav_products: "商品",
  nav_cart: "购物车",
  nav_orders: "我的订单",
  nav_login: "登录",
  nav_register: "注册",
  nav_logout: "退出",
  nav_admin: "管理后台",
  nav_admin_hint: "在新标签页打开管理后台（仅管理员可见）",
  // hero
  hero_title: "精选好物，即刻拥有",
  hero_sub: "注册即购 · 邮箱验证 · 模拟支付全流程演示",
  // product
  add_to_cart: "加入购物车",
  stock_left: "库存 {n}",
  sold_out: "售罄",
  view_products: "浏览卡牌",
  view_products_hint: "可收藏的珍稀卡týt — 来源与评级均真实",
  // cart
  cart_title: "购物车",
  cart_empty: "购物车是空的，去逛逛吧",
  col_product: "商品",
  col_unit_price: "单价",
  col_qty: "数量",
  col_subtotal: "小计",
  remove: "删除",
  items_total: "共 {n} 件，合计",
  itemspecting_with_discount: "{n} 件（已含折扣）",
  checkout: "结算下单",
  campaign: "活动",
  promo_percent: "全场 {p}% OFF",
  promo_bng1: "买 {n} 送 1",
  member_discount: "会员折扣",
  member_discount_line: "你的专属折扣 {n}% -{amount}",
  // orders
  my_orders: "我的订单",
  order_no: "订单号",
  no_orders_yet: "还没有订单",
  order_created_banner: "订单 {no} 已创建，请尽快支付",
  go_pay: "去支付",
  cancel_order: "取消",
  order_status: "状态",
  order_amount: "金额",
  order_items: "商品",
  order_created_at: "创建时间",
  order_action: "操作",
  status_pending_payment: "待支付",
  status_paid: "已支付",
  status_cancelled: "已取消",
  status_completed: "已完成",
  // auth
  login: "登录",
  register: "注册",
  email: "邮箱",
  password: "密码",
  username: "用户名",
  invite_code: "邀请码",
  invite_optional: "邀请码（可选）",
  invite_placeholder: "如果管理员开启了邀请注册",
  login_failed_retry: "登录失败，请稍后重试",
  register_failed_retry: "注册失败，请稍后重试",
  logging_in: "登录中…",
  sending_code: "发送验证码…",
  no_account: "还没有账号？",
  has_account: "已有账号？",
  go_register: "去注册",
  go_login: "去登录",
  password_hint: "至少 8 位",
  username_hint: "2-64 字符",
  verify_title: "邮箱验证",
  verify_hint: "验证码已发送到你的邮箱（开发环境可在 Mailpit 或后端日志查看）",
  verify_code: "验证码",
  verify_code_hint: "6 位数字",
  verifying: "验证中…",
  finish_register: "完成注册",
  not_received: "没收到？",
  resend: "重新发送",
  verify_failed: "验证失败",
  resend_sent: "如该邮箱有待验证注册，验证码已重新发送（60 秒冷却）",
  email_verified: "已验证",
  email_unverified: "未验证",
  // profile
  profile_title: "个人中心",
  role_label: "角色",
  role_user: "用户",
  role_admin: "管理员",
  role_super_admin: "超级管理员",
  registered_at: "注册时间",
  logout: "退出",
  // google
  google_login: "使用 Google 账号继续",
  google_redirecting: "跳转 Google…",
  google_failed: "Google 登录失败",
  google_oauth_hint: "需要在后端 .env 配置 GOOGLE_CLIENT_ID/SECRET 并重启",
  // errors
  err_add_cart: "加购失败",
  err_update_cart: "更新失败",
  err_remove_cart: "删除失败",
  err_checkout: "下单失败",
  err_cancel: "取消失败",
  err_pay: "发起支付失败",
  err_no_pay_url: "支付渠道未返回支付链接",
  // 404
  not_found_text: "页面不存在",
  back_home: "回首页",
  // footer
  footer_text: "演示项目",
};

const en: Dict = {
  loading: "Loading…",
  load_failed: "Failed to load",
  ok: "OK",
  nav_products: "Products",
  nav_cart: "Cart",
  nav_orders: "My Orders",
  nav_login: "Sign in",
  nav_register: "Sign up",
  nav_logout: "Sign out",
  nav_admin: "Admin Panel",
  nav_admin_hint: "Open the admin backoffice in a new tab (admins only)",
  hero_title: "Great finds, instantly yours",
  hero_sub: "Register & buy · Email verification · Full mock-payment demo",
  add_to_cart: "Add to cart",
  stock_left: "Stock {n}",
  sold_out: "Sold out",
  view_products: "Browse cards",
  view_products_hint: "Collectible rare cards — authentic source and grading",
  cart_title: "Cart",
  cart_empty: "Your cart is empty — go browse",
  col_product: "Product",
  col_unit_price: "Price",
  col_qty: "Qty",
  col_subtotal: "Subtotal",
  remove: "Remove",
  items_total: "{n} item(s), total",
  itemspecting_with_discount: "{n} item(s) (incl. discounts)",
  checkout: "Checkout",
  campaign: "Campaign",
  promo_percent: "{p}% OFF everything",
  promo_bng1: "Buy {n} get 1 free",
  member_discount: "Member discount",
  member_discount_line: "Your discount {n}% -{amount}",
  my_orders: "My Orders",
  order_no: "Order No.",
  no_orders_yet: "No orders yet",
  order_created_banner: "Order {no} created — please pay soon",
  go_pay: "Pay now",
  cancel_order: "Cancel",
  order_status: "Status",
  order_amount: "Amount",
  order_items: "Items",
  order_created_at: "Created",
  order_action: "Action",
  status_pending_payment: "Pending",
  status_paid: "Paid",
  status_cancelled: "Cancelled",
  status_completed: "Completed",
  login: "Sign in",
  register: "Sign up",
  email: "Email",
  password: "Password",
  username: "Username",
  invite_code: "Invite code",
  invite_optional: "Invite code (optional)",
  invite_placeholder: "Only if the admin enabled invite registration",
  login_failed_retry: "Sign-in failed, try again later",
  register_failed_retry: "Sign-up failed, try again later",
  dict_update: "Updating…",
  logging_in: "Signing in…",
  sending_code: "Sending code…",
  no_account: "No account yet?",
  has_account: "Already have an account?",
  go_register: "Sign up",
  go_login: "Sign in",
  password_hint: "At least 8 chars",
  username_hint: "2-64 chars",
  verify_title: "Email verification",
  verify_hint: "Code sent to your inbox (dev: see Mailpit or backend log)",
  verify_code: "Code",
  verify_code_hint: "6 digits",
  verifying: "Verifying…",
  finish_register: "Finish sign-up",
  not_received: "Not received?",
  resend: "Resend",
  verify_failed: "Verification failed",
  resend_sent: "If a pending registration exists, the code was resent (60s cooldown)",
  email_verified: "Verified",
  email_unverified: "Unverified",
  profile_title: "Profile",
  role_user: "User",
  role_admin: "Admin",
  role_super_admin: "Super admin",
  registered_at: "Registered",
  logout: "Sign out",
  google_login: "Continue with Google",
  google_redirecting: "Redirecting to Google…",
  google_failed: "Google sign-in failed",
  google_oauth_hint: "Requires GOOGLE_CLIENT_ID/SECRET in backend .env + restart",
  err_add_cart: "Failed to add to cart",
  err_update_cart: "Failed to update",
  err_remove_cart: "Failed to remove",
  err_checkout: "Checkout failed",
  err_cancel: "Cancel failed",
  err_pay: "Failed to start payment",
  err_no_pay_url: "Payment provider returned no pay URL",
  // 404
  not_found_text: "Page not found",
  back_home: "Back home",
  footer_text: "Demo project",
};

const dicts: Record<Lang, Dict> = { zh, en };
const LANG_KEY = "shop_lang";

export function detectLang(): Lang {
  const saved = localStorage.getItem(LANG_KEY);
  if (saved === "zh" || saved === "en") return saved;
  // read the client language: any Chinese locale -> zh, otherwise en
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language || "en"];
  for (const l of langs) {
    if (l && l.toLowerCase().startsWith("zh")) return "zh";
  }
  return "en";
}

export function saveLang(l: Lang) {
  localStorage.setItem(LANG_KEY, l);
}

// translate with {name} interpolation
export function translate(lang: Lang, key: string, params?: Record<string, string | number>): string {
  let s = dicts[lang][key] ?? dicts.zh[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return s;
}

export interface I18nState {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export const I18nContext = createContext<I18nState>({
  lang: "zh",
  setLang: () => {},
  t: (k) => k,
});

// hook for consuming the i18n context
export function useI18n(): I18nState {
  return useContext(I18nContext);
}
