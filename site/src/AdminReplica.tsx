import { useState } from "react";
import type { Lang } from "./i18n";

// ---------------------------------------------------------------------------
// Static replica of the admin backoffice, rendered inside the Pages facade.
// Mirrors the real admin/ SPA layout (dark sidebar + content). Two role tiers
// are simulated exactly like the live system: super admin sees everything,
// regular admin sees users/orders/dashboard only. Zero network requests.
// ---------------------------------------------------------------------------

interface AdminUser {
  id: number;
  username: string;
  email: string;
  role: "user" | "admin" | "super_admin";
  status: "active" | "disabled";
  discount: number;
  created: string;
}

interface AdminProduct {
  id: number;
  name: string;
  price_cents: number;
  stock: number;
  status: "draft" | "active" | "retired";
  discount: number;
}

const ADMIN_USERS: AdminUser[] = [
  { id: 1, username: "admin", email: "admin@shop-dev.com", role: "super_admin", status: "active", discount: 0, created: "2026-08-30 09:12" },
  { id: 2, username: "u1", email: "u1@test.com", role: "admin", status: "active", discount: 0, created: "2026-09-01 14:30" },
  { id: 3, username: "宝可梦训练家", email: "e2e1790254395694@test.com", role: "user", status: "active", discount: 5, created: "2026-09-20 11:02" },
  { id: 4, username: "misty", email: "misty@cerulean.gg", role: "user", status: "active", discount: 10, created: "2026-09-21 16:45" },
  { id: 5, username: "brock", email: "brock@pewter.gg", role: "user", status: "disabled", discount: 0, created: "2026-09-22 08:20" },
];

const ADMIN_PRODUCTS: AdminProduct[] = [
  { id: 1, name: "喷火龙 ex·SSP 黑色星标 promo", price_cents: 29900, stock: 50, status: "active", discount: 10 },
  { id: 2, name: "皮卡丘 with 灰帽子 · 25周年", price_cents: 12900, stock: 80, status: "active", discount: 0 },
  { id: 3, name: "梦幻 ex · 151 补充包 PSA 9", price_cents: 89900, stock: 20, status: "active", discount: 0 },
  { id: 4, name: "沙奈朵 ex·S12a 漂亮宝贝", price_cents: 35900, stock: 35, status: "retired", discount: 5 },
];

const ADMIN_ORDERS = [
  { id: 1, order_no: "20260924-8F3A21B4", user: "宝可梦训练家", items: "喷火龙 ×1, 皮卡丘 ×2", total_cents: 51530, status: "paid", paid_at: "2026-09-24 10:31" },
  { id: 2, order_no: "20260924-9C7D0E12", user: "misty", items: "梦幻 ×1", total_cents: 72819, status: "pending_payment", paid_at: null },
  { id: 3, order_no: "20260923-4B8C2A9F", user: "宝可梦训练家", items: "沙奈朵 ×1", total_cents: 29355, status: "paid", paid_at: "2026-09-23 17:44" },
];

const PROMOTIONS = [
  { id: 1, name: "开业酬宾", kind: "percent_off", value: 10, status: "active", period: "09-20 00:00 ~ ∞" },
  { id: 2, name: "周年庆买4送1", kind: "buy_n_get_1", value: 4, status: "ended", period: "08-01 ~ 08-15" },
];

// 12-day revenue samples for the chart (matches live shape)
const REV_SERIES = [
  { date: "09-13", v: 0 }, { date: "09-14", v: 0 }, { date: "09-15", v: 29355 },
  { date: "09-16", v: 0 }, { date: "09-17", v: 12900 }, { date: "09-18", v: 0 },
  { date: "09-19", v: 0 }, { date: "09-20", v: 42740 }, { date: "09-21", v: 72819 },
  { date: "09-22", v: 0 }, { date: "09-23", v: 29355 }, { date: "09-24", v: 51530 },
];

const yuan = (c: number) => `¥${(c / 100).toFixed(2)}`;
const fmtK = (c: number) => (c >= 100000 ? `¥${(c / 100000).toFixed(1)}k` : `¥${(c / 100).toFixed(0)}`);

const L = {
  zh: {
    back: "← 返回门面", brand: "🃏 PTCG Shop 后台",
    menu_dash: "仪表盘", menu_orders: "订单 / 导出", menu_users: "用户管理",
    menu_products: "商品管理", menu_promotions: "活动管理", menu_invites: "邀请码 / 注册设置", menu_revenue: "收入统计",
    logout: "退出登录",
    role_super: "超级管理员", role_admin: "管理员",
    demo_hint: "静态复刻演示 · 数据为内置假数据 · 无网络请求。右上角可切换角色视角。",
    view_as: "视角切换",
    dash_title: "仪表盘",
    stats_users: "用户总数", stats_products: "商品数", stats_active: "在售商品", stats_orders: "订单总数",
    stats_paid: "已支付订单", stats_revenue: "累计收入", stats_pending: "待支付",
    users_title: "用户管理",
    col_id: "ID", col_user: "用户名", col_email: "邮箱", col_role: "角色", col_status: "状态", col_discount: "折扣", col_created: "注册时间", col_actions: "操作",
    status_active: "正常", status_disabled: "已禁用",
    act_ban: "禁用", act_unban: "解禁", act_view: "查看",
    readonly_note: "只读视图：角色分配、禁用等操作仅超级管理员可执行。",
    products_title: "商品管理",
    col_name: "商品", col_price: "价格", col_stock: "库存", col_pstatus: "状态",
    p_draft: "草稿", p_active: "在售", p_retired: "已下架",
    product_readonly: "只读视图：商品的新建、编辑、上下架与删除仅超级管理员可操作；折扣可由管理员设定。",
    discount_editable: "折扣可编辑（0-100）",
    orders_title: "订单 / 导出",
    col_order_no: "订单号", col_buyer: "买家", col_items: "商品", col_amount: "金额", col_time: "支付时间",
    o_paid: "已支付", o_pending: "待支付", o_cancelled: "已取消", o_refunded: "已退款",
    export_csv: "导出 CSV（写审计日志）",
    promotions_title: "活动管理 (super_admin)",
    promo_new: "发起活动", promo_note: "同一时间只有一个活动生效；新活动自动结束旧活动",
    col_promo_name: "活动名", col_kind: "类型", col_power: "力度", col_period: "时间", col_pstatus2: "状态",
    kind_percent: "全场折扣", kind_bng1: "买 N 送 1",
    p_active_tag: "进行中", p_ended: "已结束",
    act_end: "结束",
    revenue_title: "收入统计 (super_admin)",
    real_rev: "已实现收入（已支付）", exp_rev: "预计收入（待支付）", total_rev: "合计预估",
    chart_title: "收入曲线（近 30 天 · 已支付）",
    invites_title: "邀请码 / 注册设置",
    invite_required: "开启邀请注册（未持码者无法注册）",
    invite_codes: "邀请码",
    invite_note: "支持次数 / 有效期 / 批量生成 / 作废 — 仅超级管理员可操作",
  },
  en: {
    back: "← Back to facade", brand: "🃏 PTCG Shop Backoffice",
    menu_dash: "Dashboard", menu_orders: "Orders / Export", menu_users: "Users",
    menu_products: "Products", menu_promotions: "Promotions", menu_invites: "Invites / Signup settings", menu_revenue: "Revenue",
    logout: "Sign out",
    role_super: "Super admin", role_admin: "Admin",
    demo_hint: "Static replica · in-page mock data · zero network calls. Switch role view at top-right.",
    view_as: "View as",
    dash_title: "Dashboard",
    stats_users: "Users", stats_products: "Products", stats_active: "Active products", stats_orders: "Orders",
    stats_paid: "Paid orders", stats_revenue: "Revenue", stats_pending: "Pending payment",
    users_title: "User management",
    col_id: "ID", col_user: "Username", col_email: "Email", col_role: "Role", col_status: "Status", col_discount: "Discount", col_created: "Joined", col_actions: "Actions",
    status_active: "Active", status_disabled: "Disabled",
    act_ban: "Ban", act_unban: "Unban", act_view: "View",
    readonly_note: "Read-only view: role assignment and bans are super-admin only.",
    products_title: "Product management",
    col_name: "Product", col_price: "Price", col_stock: "Stock", col_pstatus: "Status",
    p_draft: "Draft", p_active: "Active", p_retired: "Retired",
    product_readonly: "Read-only view: product CRUD, publish and delete are super-admin only; admins may set discounts.",
    discount_editable: "Discount editable (0-100)",
    orders_title: "Orders / Export",
    col_order_no: "Order No.", col_buyer: "Buyer", col_items: "Items", col_amount: "Amount", col_time: "Paid at",
    o_paid: "Paid", o_pending: "Pending", o_cancelled: "Cancelled", o_refunded: "Refunded",
    export_csv: "Export CSV (audit-logged)",
    promotions_title: "Promotions (super_admin)",
    promo_new: "New campaign", promo_note: "One active campaign at a time; a new one auto-ends the previous",
    col_promo_name: "Campaign", col_kind: "Kind", col_power: "Power", col_period: "Period", col_pstatus2: "Status",
    kind_percent: "Percent off", kind_bng1: "Buy N get 1",
    p_active_tag: "Running", p_ended: "Ended",
    act_end: "End",
    revenue_title: "Revenue (super_admin)",
    real_rev: "Realized revenue (paid)", exp_rev: "Expected revenue (pending)", total_rev: "Total projected",
    chart_title: "Revenue curve (last 30 days · paid)",
    invites_title: "Invites / Signup settings",
    invite_required: "Require invite codes to sign up",
    invite_codes: "Invite codes",
    invite_note: "Uses / expiry / bulk generation / revocation — super admin only",
  },
} as const;
type AKey = keyof typeof L.zh;

export default function AdminReplica({ onExit, lang }: { onExit: () => void; lang: Lang }) {
  const [role, setRole] = useState<"super_admin" | "admin">("super_admin");
  const [page, setPage] = useState("dashboard");
  const [users, setUsers] = useState(ADMIN_USERS);
  const [discountDrafts, setDiscountDrafts] = useState<Record<number, number>>({});
  const t = (k: AKey) => L[lang][k];
  const zh = lang === "zh";
  const isSuper = role === "super_admin";

  const menus = [
    { key: "dashboard", label: t("menu_dash"), superOnly: false },
    { key: "orders", label: t("menu_orders"), superOnly: false },
    { key: "users", label: t("menu_users"), superOnly: false },
    { key: "products", label: t("menu_products"), superOnly: false },
    { key: "promotions", label: t("menu_promotions"), superOnly: true },
    { key: "invites", label: t("menu_invites"), superOnly: true },
    { key: "revenue", label: t("menu_revenue"), superOnly: true },
  ].filter((m) => isSuper || !m.superOnly);

  // Direct URL landing on a super-only page bounces regular admins (mirrors AdminLayout)
  const active = !isSuper && ["promotions", "invites", "revenue"].includes(page) ? "dashboard" : page;

  const setDiscount = (id: number, v: number) => {
    const clamped = Math.max(0, Math.min(100, v || 0));
    setDiscountDrafts((d) => ({ ...d, [id]: clamped }));
    setUsers((us) => us.map((u) => (u.id === id ? { ...u, discount: clamped } : u)));
  };

  const revenueTotal = REV_SERIES.reduce((s, p) => s + p.v, 0);
  const pendingTotal = ADMIN_ORDERS.filter((o) => o.status === "pending_payment").reduce((s, o) => s + o.total_cents, 0);

  // ---- revenue chart geometry (inline SVG, same approach as the real RevenuePage) ----
  const chartW = 640;
  const chartH = 180;
  const pad = { l: 46, r: 12, t: 14, b: 24 };
  const maxY = Math.max(...REV_SERIES.map((p) => p.v), 1);
  const cx = (i: number) => pad.l + (i / (REV_SERIES.length - 1)) * (chartW - pad.l - pad.r);
  const cy = (v: number) => pad.t + (chartH - pad.t - pad.b) - (v / maxY) * (chartH - pad.t - pad.b);
  const pts = REV_SERIES.map((p, i) => `${cx(i).toFixed(1)},${cy(p.v).toFixed(1)}`).join(" L");
  const linePath = `M${pts}`;
  const areaPath = `M${pad.l},${cy(0)} L${pts} L${cx(REV_SERIES.length - 1)},${cy(0)} Z`;

  return (
    <div className="admin-replica-scope">
      <button className="replica-exit" onClick={onExit}>{t("back")}</button>

      <div className="ar-app-shell">
        <aside className="ar-sider">
          <div className="ar-brand">{t("brand")}</div>
          <nav className="ar-menu">
            {menus.map((m) => (
              <button
                key={m.key}
                className={"ar-menu-item" + (active === m.key ? " on" : "")}
                onClick={() => setPage(m.key)}
              >
                {m.label}
              </button>
            ))}
          </nav>
          <div className="ar-sider-foot">{t("demo_hint")}</div>
        </aside>

        <main className="ar-main">
          <div className="ar-topbar">
            <span
              className={"ar-badge " + (isSuper ? "super" : "admin")}
              onClick={() => setPage(active)}
            >
              {isSuper ? t("role_super") : t("role_admin")}
            </span>
            <span className="ar-topbar-hint">{t("view_as")}:</span>
            <button
              className={"ar-role-switch" + (isSuper ? "" : " on")}
              onClick={() => setRole(isSuper ? "admin" : "super_admin")}
            >
              {isSuper ? t("role_admin") : t("role_super")}
            </button>
            <span className="ar-user">admin</span>
            <button className="ar-logout" onClick={onExit}>{t("logout")}</button>
          </div>

          <div className="ar-content">
            {/* ---------- Dashboard ---------- */}
            {active === "dashboard" && (
              <div>
                <h2 className="ar-page-title">{t("dash_title")}</h2>
                <div className="ar-stat-grid">
                  {[
                    { label: t("stats_users"), value: String(users.length), highlight: false },
                    { label: t("stats_products"), value: String(ADMIN_PRODUCTS.length), highlight: false },
                    { label: t("stats_active"), value: String(ADMIN_PRODUCTS.filter((p) => p.status === "active").length), highlight: false },
                    { label: t("stats_orders"), value: String(ADMIN_ORDERS.length), highlight: false },
                    { label: t("stats_paid"), value: String(ADMIN_ORDERS.filter((o) => o.status === "paid").length), highlight: false },
                    { label: t("stats_revenue"), value: yuan(revenueTotal), highlight: true },
                    { label: t("stats_pending"), value: String(ADMIN_ORDERS.filter((o) => o.status === "pending_payment").length), highlight: false },
                  ].map((s) => (
                    <div key={s.label} className={"ar-stat" + (s.highlight ? " hl" : "")}>
                      <div className="ar-stat-label">{s.label}</div>
                      <div className="ar-stat-value">{s.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ---------- Orders ---------- */}
            {active === "orders" && (
              <div>
                <h2 className="ar-page-title">{t("orders_title")}</h2>
                <table className="ar-table">
                  <thead>
                    <tr>
                      <th>{t("col_order_no")}</th>
                      <th>{t("col_buyer")}</th>
                      <th>{t("col_items")}</th>
                      <th>{t("col_amount")}</th>
                      <th>{t("col_status")}</th>
                      <th>{t("col_time")}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {ADMIN_ORDERS.map((o) => (
                      <tr key={o.id}>
                        <td className="mono">{o.order_no}</td>
                        <td>{o.user}</td>
                        <td>{o.items}</td>
                        <td>{yuan(o.total_cents)}</td>
                        <td>
                          <span className={"ar-tag " + o.status}>{t(o.status === "paid" ? "o_paid" : o.status === "pending_payment" ? "o_pending" : "o_cancelled")}</span>
                        </td>
                        <td>{o.paid_at ?? "—"}</td>
                        <td>
                          {isSuper && <button className="ar-btn-sm">{t("export_csv")}</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ---------- Users ---------- */}
            {active === "users" && (
              <div>
                <h2 className="ar-page-title">{t("users_title")}</h2>
                {!isSuper && <div className="ar-note">{t("readonly_note")}</div>}
                <table className="ar-table">
                  <thead>
                    <tr>
                      <th>{t("col_id")}</th>
                      <th>{t("col_user")}</th>
                      <th>{t("col_email")}</th>
                      <th>{t("col_role")}</th>
                      <th>{t("col_status")}</th>
                      <th>{t("col_discount")}</th>
                      <th>{t("col_created")}</th>
                      {isSuper && <th>{t("col_actions")}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td>{u.id}</td>
                        <td>{u.username}</td>
                        <td>{u.email}</td>
                        <td>
                          {isSuper ? (
                            <select
                              className="ar-select"
                              value={u.role}
                              disabled={u.id === 1}
                              onChange={(e) =>
                                setUsers((us) =>
                                  us.map((x) => (x.id === u.id ? { ...x, role: e.target.value as AdminUser["role"] } : x))
                                )
                              }
                            >
                              <option value="user">{zh ? "用户" : "User"}</option>
                              <option value="admin">{zh ? "管理员" : "Admin"}</option>
                              <option value="super_admin">{zh ? "超级管理员" : "Super admin"}</option>
                            </select>
                          ) : (
                            <span className={"ar-tag role-" + u.role}>
                              {u.role === "super_admin" ? t("role_super") : u.role === "admin" ? t("role_admin") : zh ? "用户" : "User"}
                            </span>
                          )}
                        </td>
                        <td>
                          <span className={"ar-tag " + (u.status === "active" ? "ok" : "bad")}>
                            {u.status === "active" ? t("status_active") : t("status_disabled")}
                          </span>
                        </td>
                        <td>
                          <div className="ar-disc-cell">
                            <input
                              className="ar-disc-input"
                              type="number"
                              min={0}
                              max={100}
                              value={discountDrafts[u.id] ?? u.discount}
                              onChange={(e) => setDiscount(u.id, Number(e.target.value))}
                            />
                            <span className="ar-disc-unit">%</span>
                          </div>
                        </td>
                        <td>{u.created}</td>
                        {isSuper && (
                          <td>
                            <button
                              className="ar-btn-sm danger"
                              disabled={u.id === 1}
                              onClick={() =>
                                setUsers((us) =>
                                  us.map((x) =>
                                    x.id === u.id && x.id !== 1 ? { ...x, status: x.status === "active" ? "disabled" : "active" } : x
                                  )
                                )
                              }
                            >
                              {u.status === "active" ? t("act_ban") : t("act_unban")}
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ---------- Products (read-only for admin, full for super) ---------- */}
            {active === "products" && (
              <div>
                <h2 className="ar-page-title">{t("products_title")}</h2>
                {!isSuper && <div className="ar-note">{t("product_readonly")}</div>}
                <table className="ar-table">
                  <thead>
                    <tr>
                      <th>{t("col_id")}</th>
                      <th>{t("col_name")}</th>
                      <th>{t("col_price")}</th>
                      <th>{t("col_stock")}</th>
                      <th>{t("discount_editable")}</th>
                      <th>{t("col_pstatus")}</th>
                      {isSuper && <th>{t("col_actions")}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {ADMIN_PRODUCTS.map((p) => (
                      <tr key={p.id}>
                        <td>{p.id}</td>
                        <td>{p.name}</td>
                        <td>{yuan(p.price_cents)}</td>
                        <td>{p.stock}</td>
                        <td>
                          <div className="ar-disc-cell">
                            <input
                              className="ar-disc-input"
                              type="number"
                              min={0}
                              max={100}
                              value={p.discount}
                              readOnly={!isSuper}
                            />
                            <span className="ar-disc-unit">%</span>
                          </div>
                        </td>
                        <td>
                          <span className={"ar-tag " + (p.status === "active" ? "ok" : "dim")}>
                            {p.status === "active" ? t("p_active") : p.status === "draft" ? t("p_draft") : t("p_retired")}
                          </span>
                        </td>
                        {isSuper && (
                          <td>
                            <button className="ar-btn-sm">{p.status === "active" ? t("p_retired") : t("p_active")}</button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ---------- Promotions (super only) ---------- */}
            {active === "promotions" && isSuper && (
              <div>
                <h2 className="ar-page-title">{t("promotions_title")}</h2>
                <div className="ar-toolbar">
                  <button className="ar-btn-primary">{t("promo_new")}</button>
                  <span className="ar-toolbar-note">{t("promo_note")}</span>
                </div>
                <table className="ar-table">
                  <thead>
                    <tr>
                      <th>{t("col_id")}</th>
                      <th>{t("col_promo_name")}</th>
                      <th>{t("col_kind")}</th>
                      <th>{t("col_power")}</th>
                      <th>{t("col_pstatus2")}</th>
                      <th>{t("col_period")}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {PROMOTIONS.map((o) => (
                      <tr key={o.id}>
                        <td>{o.id}</td>
                        <td>{o.name}</td>
                              <td>
                          <span className={"ar-tag " + (o.kind === "percent_off" ? "purple" : "cyan")}>
                            {o.kind === "percent_off" ? t("kind_percent") : t("kind_bng1")}
                          </span>
                        </td>
                        <td>{o.kind === "percent_off" ? `${100 - o.value}% ${zh ? "折扣" : "off"}` : `${zh ? "买" : "Buy"} ${o.value} ${zh ? "送 1" : "get 1"}`}</td>
                        <td>
                          <span className={"ar-tag " + (o.status === "active" ? "ok" : "dim")}>
                            {o.status === "active" ? t("p_active_tag") : t("p_ended")}
                          </span>
                        </td>
                        <td>{o.period}</td>
                        <td>
                          {o.status === "active" && <button className="ar-btn-sm danger">{t("act_end")}</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ---------- Invites (super only) ---------- */}
            {active === "invites" && isSuper && (
              <div>
                <h2 className="ar-page-title">{t("invites_title")}</h2>
                <label className="ar-switch-row">
                  <input type="checkbox" defaultChecked />
                  <span>{t("invite_required")}</span>
                </label>
                <div className="ar-toolbar">
                  <button className="ar-btn-primary">{zh ? "批量生成" : "Bulk generate"}</button>
                  <span className="ar-toolbar-note">{t("invite_note")}</span>
                </div>
                <table className="ar-table">
                  <thead>
                    <tr>
                      <th>{t("col_id")}</th>
                      <th>{t("invite_codes")}</th>
                      <th>{zh ? "次数" : "Uses"}</th>
                      <th>{zh ? "有效期" : "Expiry"}</th>
                      <th>{t("col_status")}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>1</td>
                      <td className="mono">PTCG-9F3A-2K7B</td>
                      <td>{zh ? "已用 3 / 10" : "Used 3 / 10"}</td>
                      <td>2026-12-31</td>
                      <td><span className="ar-tag ok">{zh ? "有效" : "Valid"}</span></td>
                      <td><button className="ar-btn-sm danger">{zh ? "作废" : "Revoke"}</button></td>
                    </tr>
                    <tr>
                      <td>2</td>
                      <td className="mono">PTCG-QW8E-5R2T</td>
                      <td>{zh ? "已用 10 / 10" : "Used 10 / 10"}</td>
                      <td>2026-10-15</td>
                      <td><span className="ar-tag dim">{zh ? "已用尽" : "Exhausted"}</span></td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* ---------- Revenue (super only) ---------- */}
            {active === "revenue" && isSuper && (
              <div>
                <h2 className="ar-page-title">{t("revenue_title")}</h2>
                <div className="ar-stat-row">
                  <div className="ar-stat hl">
                    <div className="ar-stat-label">{t("real_rev")}</div>
                    <div className="ar-stat-value">{yuan(revenueTotal)}</div>
                  </div>
                  <div className="ar-stat">
                    <div className="ar-stat-label">{t("exp_rev")}</div>
                    <div className="ar-stat-value">{yuan(pendingTotal)}</div>
                  </div>
                  <div className="ar-stat">
                    <div className="ar-stat-label">{t("total_rev")}</div>
                    <div className="ar-stat-value">{yuan(revenueTotal + pendingTotal)}</div>
                  </div>
                </div>
                <h3 className="ar-section-title">{t("chart_title")}</h3>
                <svg viewBox={`0 0 ${chartW} ${chartH}`} className="ar-chart">
                  {[0, 0.5, 1].map((f) => (
                    <g key={f}>
                      <line x1={pad.l} y1={cy(maxY * f)} x2={chartW - pad.r} y2={cy(maxY * f)} stroke="#eee" />
                      <text x={pad.l - 6} y={cy(maxY * f) + 4} textAnchor="end" fontSize="10" fill="#999">
                        {fmtK(maxY * f)}
                      </text>
                    </g>
                  ))}
                  <path d={areaPath} fill="#e6f4ff" />
                  <path d={linePath} fill="none" stroke="#1677ff" strokeWidth="2" />
                  {REV_SERIES.map((p, i) => (
                    <g key={p.date}>
                      <circle cx={cx(i)} cy={cy(p.v)} r="2.5" fill="#1677ff" />
                      {(i === 0 || i === REV_SERIES.length - 1) && (
                        <text x={cx(i)} y={chartH - 8} textAnchor="middle" fontSize="10" fill="#999">
                          {p.date}
                        </text>
                      )}
                    </g>
                  ))}
                </svg>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
