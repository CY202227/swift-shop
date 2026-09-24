// Static mock data only — this site never calls any API (Pages has no backend).
// Keep in sync loosely with backend/app/main.py DEMO_PRODUCTS.

export interface MockProduct {
  id: number;
  name: string;
  price_cents: number;
  desc: string;
  emoji: string;
  stock: number;
}

export const products: MockProduct[] = [
  { id: 1, name: "机械键盘 87键", price_cents: 29900, desc: "热插拔轴体 · PBT 键帽 · 三模连接", emoji: "⌨️", stock: 50 },
  { id: 2, name: "无线鼠标", price_cents: 12900, desc: "静音微动 · 人体工学 · Type-C 快充", emoji: "🖱️", stock: 80 },
  { id: 3, name: "降噪耳机", price_cents: 89900, desc: "主动降噪 42dB · 续航 60 小时", emoji: "🎧", stock: 20 },
  { id: 4, name: "USB-C 扩展坞", price_cents: 35900, desc: "8 合 1 · HDMI 4K60 · 千兆网口", emoji: "🔌", stock: 35 },
];

export const yuan = (cents: number) => `¥${(cents / 100).toFixed(2)}`;

export const features = [
  {
    icon: "📧",
    title: "邮箱 + Google 注册",
    desc: "验证码两步注册（注册仅暂存，验证才建号）；Google OAuth 一键绑定/建号；JWT 双令牌 + refresh 旋转。",
  },
  {
    icon: "🎟️",
    title: "邀请注册开关 + 邀请码",
    desc: "管理员后台随时开关；邀请码支持次数、有效期、批量生成与作废；SQL 原子消耗，免疫并发重放。",
  },
  {
    icon: "📦",
    title: "商品上架 / 下架",
    desc: "draft → active → retired 状态机；有订单史的商品只可下架不可删除；下架对商城端即时可见。",
  },
  {
    icon: "💳",
    title: "Mock 支付闭环",
    desc: "PaymentProvider 适配器层预留 stripe/alipay/wechat；内置 Mock 收银台 + HMAC 签名 webhook + 幂等处理。",
  },
  {
    icon: "📊",
    title: "订单记录导出",
    desc: "管理后台按状态/用户筛选，一键导出 CSV；每次导出写入审计日志（who / filters / rows）。",
  },
  {
    icon: "🧱",
    title: "前后端分离",
    desc: "web / admin / api 三个独立服务，REST + JSON；金额一律服务端重算，前端传回的数字直接丢弃。",
  },
];

export const milestones = [
  { name: "M1 基建 + compose", done: true },
  { name: "M2 认证注册（邀请码）", done: true },
  { name: "M3 商品 + 购物车", done: true },
  { name: "M4 订单 + Mock 支付", done: true },
  { name: "M5 管理后台", done: true },
  { name: "M6 演示站点", done: true },
];

export const quickStart = [
  "git clone https://github.com/YOUR_NAME/swift-shop.git",
  "cd swift-shop && docker compose up -d        # pg + minio + mailpit（可选）",
  "cd backend && pip install -r requirements.txt",
  "cp .env.example .env",
  "uvicorn app.main:app --port 8010             # 首次启动自动建表+种子",
  "cd web && npm install && npm run dev         # 商城 :5173",
];
