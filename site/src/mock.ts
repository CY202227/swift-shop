// Static mock data only — this site never calls any API (Pages has no backend).
// Keep in sync loosely with backend/app/main.py DEMO_PRODUCTS.

export interface MockProduct {
  id: number;
  slug: string;
  name: string;
  name_en?: string;
  price_cents: number;
  desc: string;
  desc_en?: string;
  stock: number;
  discount_percent: number;
}

// Mirrors the live shop's active campaign + seeded product discounts so the
// facade shows the same pricing math as the real store.
export const promotion = {
  active: true,
  kind: "percent_off" as const,
  value: 10, // 10% off everything → pay 90%
  name: "开业酬宾",
};

export const products: MockProduct[] = [
  { id: 1, slug: "charizard-ex-ssp-black-star", name: "喷火龙 ex·SSP 黑色星标 promo", name_en: "Charizard ex · SSP Black Star promo", price_cents: 29900, desc: "SVR 特典卡 · 2023 世锦赛限定 · PSA 评级热门", desc_en: "SVR special card · 2023 Worlds exclusive · PSA grading favorite", stock: 50, discount_percent: 10 },
  { id: 2, slug: "pikachu-gray-cap-25th", name: "皮卡丘 with 灰帽子 · 25周年", name_en: "Pikachu with Gray Cap · 25th Anniversary", price_cents: 12900, desc: "经典俏皮闪 · 25 周年纪念插画", desc_en: "Classic playful holo · 25th anniversary art", stock: 80, discount_percent: 0 },
  { id: 3, slug: "mew-ex-151-psa9", name: "梦幻 ex · 151 补充包 PSA 9", name_en: "Mew ex · 151 Booster PSA 9", price_cents: 89900, desc: "151 全图特异 S 异画 · PSA 评级", desc_en: "151 full-art S alt art · PSA graded", stock: 20, discount_percent: 0 },
  { id: 4, slug: "gardevoir-ex-s12a", name: "沙奈朵 ex·S12a 漂亮宝贝", name_en: "Gardevoir ex · S12a Cute Collect", price_cents: 35900, desc: "SAR 超级闪耀稀有 · 收藏品相 NM", desc_en: "SAR ultra shiny rare · NM collector condition", stock: 35, discount_percent: 5 },
];

export const yuan = (cents: number) => `¥${(cents / 100).toFixed(2)}`;

// Effective unit price after product discount + active promotion stacking
export const effectiveCents = (p: MockProduct) => {
  let c = p.price_cents;
  if (p.discount_percent > 0) c = Math.round(c * (100 - p.discount_percent) / 100);
  if (promotion.active && promotion.kind === "percent_off") c = Math.round(c * (100 - promotion.value) / 100);
  return c;
};

export const features = [
  {
    icon: "📧",
    title: "邮箱 + Google 注册",
    title_en: "Email + Google signup",
    desc: "验证码两步注册（注册仅暂存，验证才建号）；Google OAuth 一键绑定/建号；JWT 双令牌 + refresh 旋转。",
    desc_en: "Two-step code signup (staged until verified); Google OAuth bind-or-create; JWT pair + refresh rotation.",
  },
  {
    icon: "🎟️",
    title: "邀请注册开关 + 邀请码",
    title_en: "Invite-gated signup + codes",
    desc: "管理员后台随时开关；邀请码支持次数、有效期、批量生成与作废；SQL 原子消耗，免疫并发重放。",
    desc_en: "Toggle anytime in the backoffice; codes carry uses/expiry, bulk generate and revoke; atomic SQL redemption.",
  },
  {
    icon: "📦",
    title: "商品上架 / 下架",
    title_en: "Publish / retire products",
    desc: "draft → active → retired 状态机；有订单史的商品只可下架不可删除；下架对商城端即时可见。",
    desc_en: "draft → active → retired state machine; products with order history can retire but not delete; instant storefront visibility.",
  },
  {
    icon: "💳",
    title: "Mock 支付闭环",
    title_en: "Mock payment loop",
    desc: "PaymentProvider 适配器层预留 stripe/alipay/wechat；内置 Mock 收银台 + HMAC 签名 webhook + 幂等处理。",
    desc_en: "PaymentProvider adapter reserves stripe/alipay/wechat; built-in mock cashier + HMAC-signed webhook + idempotent handling.",
  },
  {
    icon: "📊",
    title: "订单记录导出",
    title_en: "Order export & audit",
    desc: "管理后台按状态/用户筛选，一键导出 CSV；每次导出写入审计日志（who / filters / rows）。",
    desc_en: "Filter by status/user in the backoffice, one-click CSV export; every export writes an audit log (who / filters / rows).",
  },
  {
    icon: "🧑‍💼",
    title: "三级角色权限",
    title_en: "Three-tier roles",
    desc: "user / admin / super_admin：管理员可看订单用户、设折扣；超级管理员独占商品增删改、上下架、活动、邀请码、营收。",
    desc_en: "user / admin / super_admin: admins view orders/users and grant discounts; the super admin owns product CRUD, publish, campaigns, invites and revenue.",
  },
];

export const milestones = [
  { name: "M1 基建 + compose", name_en: "M1 Infra + compose", done: true },
  { name: "M2 认证注册（邀请码）", name_en: "M2 Auth (invites)", done: true },
  { name: "M3 商品 + 购物车", name_en: "M3 Products + cart", done: true },
  { name: "M4 订单 + 支付", name_en: "M4 Orders + payment", done: true },
  { name: "M5 管理后台", name_en: "M5 Backoffice", done: true },
  { name: "M6 演示站点", name_en: "M6 Demo site", done: true },
];

export const quickStart = [
  "git clone https://github.com/YOUR_NAME/swift-shop.git",
  "cd swift-shop && docker compose up -d        # pg + minio + mailpit（可选）",
  "cd backend && pip install -r requirements.txt",
  "cp .env.example .env",
  "uvicorn app.main:app --port 8010             # 首次启动自动建表+种子",
  "cd web && npm install && npm run dev         # 商城 :5173",
];
