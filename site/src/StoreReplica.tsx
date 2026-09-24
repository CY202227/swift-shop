import { useState } from "react";
import { dict, type Lang, type SiteKey } from "./i18n";
import { products, promotion, effectiveCents, type MockProduct } from "./mock";

// ---------------------------------------------------------------------------
// Pixel-accurate replica of the real web/ storefront, rendered inside the
// Pages facade. Same CSS variables, same class names, same layout. State is
// local (mock user/cart/orders) — zero network requests, as Pages has no
// backend. Clicking the storefront link swaps the whole screen to this view.
// ---------------------------------------------------------------------------

// Store-localized strings (labels unique to the replica, not shared with facade sections)
const S = {
  zh: {
    products: "商品", cart: "购物车", orders: "我的订单", login: "登录", register: "注册",
    logout: "退出", add_to_cart: "加入购物车", stock: "库存", stock_n: "库存 {n} 件",
    hero_title: "精选好物，即刻拥有", hero_sub: "注册即购 · 邮箱验证 · 模拟支付全流程演示",
    promo_banner: "🎉 开业酬宾：全场 9 折 · 与会员/商品折扣叠加",
    detail_qty: "数量", not_found: "商品不存在", login_title: "登录", register_title: "注册",
    email: "邮箱", password: "密码", username: "用户名", invite: "邀请码（可选）",
    invite_hint: "如果管理员开启了邀请注册", verify_title: "邮箱验证", verify_code: "验证码",
    verify_hint: "演示环境：任意 4 位以上数字即可通过验证", verify_btn: "完成注册",
    no_account: "还没有账号？", go_register: "去注册", have_account: "已有账号？", go_login: "去登录",
    cart_title: "购物车", cart_empty: "购物车是空的，去逛逛吧", please_login: "请先登录",
    col_product: "商品", col_price: "单价", col_qty: "数量", col_subtotal: "小计", remove: "删除",
    items_total: "共 {n} 件，合计", checkout: "结算下单",
    member_discount: "会员专属折扣 {p}%：-{amount}",
    order_created: "订单 {no} 已创建，请尽快支付", pay_now: "去支付", cancel: "取消",
    orders_title: "我的订单", no_orders: "还没有订单",
    col_order_no: "订单号", col_items: "商品", col_amount: "金额", col_status: "状态", col_time: "创建时间", col_actions: "操作",
    profile_title: "个人中心", role: "角色", created_at: "注册时间", verified: "已验证",
    role_user: "用户", role_admin: "管理员", role_super: "超级管理员",
    discount_label: "会员折扣",
  },
  en: {
    products: "Products", cart: "Cart", orders: "My Orders", login: "Sign in", register: "Sign up",
    logout: "Sign out", add_to_cart: "Add to cart", stock: "Stock", stock_n: "Stock {n}",
    hero_title: "Great finds, instantly yours", hero_sub: "Register & buy · Email verification · Full mock-payment demo",
    promo_banner: "🎉 Grand opening: 10% OFF everything · Stacks with member & product discounts",
    detail_qty: "Quantity", not_found: "Product not found", login_title: "Sign in", register_title: "Sign up",
    email: "Email", password: "Password", username: "Username", invite: "Invite code (optional)",
    invite_hint: "If the admin enabled invite-only signup", verify_title: "Email verification", verify_code: "Verification code",
    verify_hint: "Demo environment: any 4+ digit code passes", verify_btn: "Finish signup",
    no_account: "No account yet?", go_register: "Sign up", have_account: "Already registered?", go_login: "Sign in",
    cart_title: "Cart", cart_empty: "Your cart is empty — go browse", please_login: "Please sign in first",
    col_product: "Product", col_price: "Price", col_qty: "Qty", col_subtotal: "Subtotal", remove: "Remove",
    items_total: "{n} item(s), total", checkout: "Checkout", member_discount: "Member discount {p}%: -{amount}",
    order_created: "Order {no} created — please pay soon", pay_now: "Pay now", cancel: "Cancel",
    orders_title: "My Orders", no_orders: "No orders yet",
    col_order_no: "Order No.", col_items: "Items", col_amount: "Amount", col_status: "Status", col_time: "Created", col_actions: "Actions",
    profile_title: "Profile", role: "Role", created_at: "Joined", verified: "Verified",
    role_user: "User", role_admin: "Admin", role_super: "Super admin",
    discount_label: "Member discount",
  },
} as const;
type StoreKey = keyof typeof S.zh;
const ts = (lang: Lang) => (k: StoreKey) => S[lang][k] as string;

type Route =
  | { name: "home" }
  | { name: "detail"; slug: string }
  | { name: "login" }
  | { name: "register" }
  | { name: "verify" }
  | { name: "cart" }
  | { name: "orders" }
  | { name: "profile" };

interface CartLine {
  product: MockProduct;
  qty: number;
}

interface MockOrder {
  id: number;
  order_no: string;
  lines: { name: string; qty: number }[];
  subtotal_cents: number;
  discount_cents: number;
  total_cents: number;
  status: "pending_payment" | "paid" | "cancelled";
  created_at: string;
  paid_at: string | null;
}

interface MockUser {
  username: string;
  email: string;
  role: string;
  discount_percent: number;
  created_at: string;
}

const yuan = (cents: number) => (cents / 100).toFixed(2);
const STATUS_TEXT: Record<string, string> = {
  pending_payment: "待支付",
  paid: "已支付",
  cancelled: "已取消",
  completed: "已完成",
};
const STATUS_TEXT_EN: Record<string, string> = {
  pending_payment: "Pending payment",
  paid: "Paid",
  cancelled: "Cancelled",
  completed: "Completed",
};
const fmtTime = (iso: string | null) => (!iso ? "—" : iso.replace("T", " ").slice(0, 16));

export default function StoreReplica({ onExit, lang }: { onExit: () => void; lang: Lang }) {
  const t = ts(lang);
  // Facade footer uses these too
  const _ft = (k: SiteKey) => dict[lang][k];

  const [route, setRoute] = useState<Route>({ name: "home" });
  const [user, setUser] = useState<MockUser | null>(null);
  const [pendingEmail, setPendingEmail] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [orders, setOrders] = useState<MockOrder[]>([]);
  const [banner, setBanner] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // login/register form fields (shared by both pages)
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [code, setCode] = useState("");
  // quantity selected on the product detail page
  const [detailQty, setDetailQty] = useState(1);

  const go = (r: Route) => {
    setErr("");
    setBanner("");
    setRoute(r);
  };

  const login = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setBusy(true);
    setTimeout(() => {
      // Demo member carries a 5% personal discount, mirroring the live shop data
      setUser({ username: "宝可梦训练家", email, role: "user", discount_percent: 5, created_at: new Date().toISOString() });
      setBusy(false);
      go({ name: "home" });
    }, 400);
  };

  const register = (e: React.FormEvent) => {
    e.preventDefault();
    setPendingEmail(email);
    setTimeout(() => go({ name: "verify" }), 400);
  };

  const verify = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length < 4) {
      setErr(lang === "zh" ? "请输入验证码" : "Please enter the code");
      return;
    }
    setUser({ username: username || "宝可梦训练家", email: pendingEmail, role: "user", discount_percent: 5, created_at: new Date().toISOString() });
    go({ name: "home" });
  };

  const requireLogin = (then: () => void) => {
    if (!user) {
      go({ name: "login" });
      return;
    }
    then();
  };

  const addToCart = (p: MockProduct, qty: number) =>
    requireLogin(() => {
      setCart((c) => {
        const hit = c.find((l) => l.product.id === p.id);
        if (hit) {
          return c.map((l) => (l.product.id === p.id ? { ...l, qty: Math.min(l.qty + qty, 99) } : l));
        }
        return [...c, { product: p, qty }];
      });
      go({ name: "cart" });
    });

  const changeQty = (id: number, qty: number) =>
    setCart((c) => c.map((l) => (l.product.id === id ? { ...l, qty } : l)));

  const removeLine = (id: number) => setCart((c) => c.filter((l) => l.product.id !== id));

  const checkout = () =>
    setCart((c) => {
      if (c.length) {
        const no = "20260925-" + Math.random().toString(16).slice(2, 10).toUpperCase();
        // Same math as the live pricing engine: product% + promotion% then member%
        const subtotal = c.reduce((s, l) => s + effectiveCents(l.product) * l.qty, 0);
        const discount = user?.discount_percent
          ? Math.floor(subtotal * user.discount_percent / 100)
          : 0;
        const total = subtotal - discount;
        setOrders((os) => [
          {
            id: Date.now(),
            order_no: no,
            lines: c.map((l) => ({ name: l.product.name, qty: l.qty })),
            subtotal_cents: subtotal,
            discount_cents: discount,
            total_cents: total,
            status: "pending_payment",
            created_at: new Date().toISOString(),
            paid_at: null,
          },
          ...os,
        ]);
        setBanner(t("order_created").replace("{no}", no));
      }
      return [];
    });

  const pay = (orderId: number) => {
    setOrders((os) =>
      os.map((o) =>
        o.id === orderId
          ? { ...o, status: "paid" as const, paid_at: new Date().toISOString() }
          : o
      )
    );
    setBanner(lang === "zh" ? "模拟支付成功（Mock 收银台 → HMAC 签名 webhook → 幂等落账）" : "Mock payment OK (cashier → HMAC-signed webhook → idempotent ledger)");
  };

  const cancel = (orderId: number) => {
    setOrders((os) => os.map((o) => (o.id === orderId ? { ...o, status: "cancelled" as const } : o)));
    // Stock restoration mirrors the real backend's conditional SQL update
  };

  const logout = () => {
    setUser(null);
    setCart([]);
    go({ name: "home" });
  };

  const subtotalCents = cart.reduce((s, l) => s + effectiveCents(l.product) * l.qty, 0);
  const memberDiscountCents = user?.discount_percent ? Math.floor(subtotalCents * user.discount_percent / 100) : 0;

  const priceCell = (p: MockProduct) => {
    const eff = effectiveCents(p);
    const hasDiscount = p.discount_percent > 0 || (promotion.active && promotion.kind === "percent_off");
    return (
      <span className="price-cell">
        {hasDiscount && <span className="price-was">¥{yuan(p.price_cents)}</span>}
        <span className="price">¥{yuan(eff)}</span>
        {hasDiscount && (
          <span className="discount-tag">
            -{((1 - eff / p.price_cents) * 100).toFixed(0)}%
          </span>
        )}
      </span>
    );
  };

  return (
    <div className="replica-scope">
      <button className="replica-exit" onClick={onExit} title="Facade">
        {lang === "zh" ? "← 返回门面" : "← Back to facade"}
      </button>

      <div className="rs-app-shell">
        <header className="navbar">
          <div className="container rs-nav-inner">
            <a href="#rs-home" className="brand" onClick={(e) => { e.preventDefault(); go({ name: "home" }); }}>
              🃏 PTCG Shop
            </a>
            <nav className="nav-links">
              <a href="#rs-home" onClick={(e) => { e.preventDefault(); go({ name: "home" }); }}>{t("products")}</a>
              {user ? (
                <>
                  <a href="#rs-cart" onClick={(e) => { e.preventDefault(); go({ name: "cart" }); }}>{t("cart")}</a>
                  <a href="#rs-orders" onClick={(e) => { e.preventDefault(); go({ name: "orders" }); }}>{t("orders")}</a>
                  <a href="#rs-profile" className="nav-user" onClick={(e) => { e.preventDefault(); go({ name: "profile" }); }}>
                    {user.username}
                  </a>
                  <button className="btn-link" onClick={logout}>{t("logout")}</button>
                </>
              ) : (
                <>
                  <a href="#rs-login" onClick={(e) => { e.preventDefault(); go({ name: "login" }); }}>{t("login")}</a>
                  <a href="#rs-register" onClick={(e) => { e.preventDefault(); go({ name: "register" }); }}>{t("register")}</a>
                </>
              )}
            </nav>
          </div>
        </header>

        <main className="container">
          {banner && <div className="banner">{banner}</div>}
          {promotion.active && (
            <div className="promo-banner">{t("promo_banner")}</div>
          )}

          {route.name === "home" && (
            <div>
              <div className="hero">
                <h1>{t("hero_title")}</h1>
                <p>{t("hero_sub")}</p>
              </div>
              <div className="product-grid">
                {products.map((p) => (
                  <div key={p.id} className="card product-card">
                    <a
                      href={`#rs-${p.slug}`}
                      onClick={(e) => { e.preventDefault(); go({ name: "detail", slug: p.slug }); }}
                    >
                      <div className="product-thumb">
                        <span>{p.name.slice(0, 1)}</span>
                      </div>
                    </a>
                    <div className="product-body">
                      <a
                        href={`#rs-${p.slug}`}
                        className="product-name"
                        onClick={(e) => { e.preventDefault(); go({ name: "detail", slug: p.slug }); }}
                      >
                        {lang === "en" && p.name_en ? p.name_en : p.name}
                      </a>
                      <div className="product-desc">{lang === "en" && p.desc_en ? p.desc_en : p.desc}</div>
                      <div className="product-foot">
                        {priceCell(p)}
                        <span className="stock">{t("stock")} {p.stock}</span>
                      </div>
                      {p.stock > 0 ? (
                        <button className="btn btn-primary btn-block" onClick={() => addToCart(p, 1)}>
                          {t("add_to_cart")}
                        </button>
                      ) : (
                        <button className="btn btn-block" disabled>
                          {lang === "zh" ? "暂时缺货" : "Sold out"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {route.name === "detail" && (() => {
            const p = products.find((x) => x.slug === route.slug);
            if (!p) return <div className="empty">{t("not_found")}</div>;
            const eff = effectiveCents(p);
            const hasDiscount = eff < p.price_cents;
            return (
              <div className="detail">
                <div className="detail-thumb">
                  <span>{p.name.slice(0, 1)}</span>
                </div>
                <div className="detail-info">
                  <h1>{lang === "en" && p.name_en ? p.name_en : p.name}</h1>
                  <p className="product-desc">{lang === "en" && p.desc_en ? p.desc_en : p.desc}</p>
                  <div className="price-cell price-lg-row">
                    {hasDiscount && <span className="price-was">¥{yuan(p.price_cents)}</span>}
                    <span className="price-lg">¥{yuan(eff)}</span>
                    {hasDiscount && (
                      <span className="discount-tag">-{((1 - eff / p.price_cents) * 100).toFixed(0)}%</span>
                    )}
                  </div>
                  <div className="stock">{t("stock_n").replace("{n}", String(p.stock))}</div>
                  <div className="qty-row">
                    <label>{t("detail_qty")}</label>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={detailQty}
                      onChange={(e) => setDetailQty(Math.max(1, Math.min(Number(e.target.value) || 1, 99)))}
                    />
                  </div>
                  <button className="btn btn-primary" onClick={() => { addToCart(p, detailQty); setDetailQty(1); }}>
                    {t("add_to_cart")}
                  </button>
                </div>
              </div>
            );
          })()}

          {route.name === "login" && (
            <div className="auth-box">
              <h1>{t("login_title")}</h1>
              <form onSubmit={login}>
                <label>
                  {t("email")}
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                </label>
                <label>
                  {t("password")}
                  <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder={lang === "zh" ? "至少 8 位" : "At least 8 chars"} />
                </label>
                {err && <div className="form-error">{err}</div>}
                <button className="btn btn-primary btn-block" disabled={busy}>
                  {busy ? (lang === "zh" ? "登录中…" : "Signing in…") : t("login")}
                </button>
              </form>
              <p className="auth-switch">
                {t("no_account")}<a href="#rs-register" onClick={(e) => { e.preventDefault(); go({ name: "register" }); }}>{t("go_register")}</a>
              </p>
            </div>
          )}

          {route.name === "register" && (
            <div className="auth-box">
              <h1>{t("register_title")}</h1>
              <form onSubmit={register}>
                <label>
                  {t("username")}
                  <input required minLength={2} value={username} onChange={(e) => setUsername(e.target.value)} placeholder={lang === "zh" ? "2-64 字符" : "2-64 chars"} />
                </label>
                <label>
                  {t("email")}
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                </label>
                <label>
                  {t("password")}
                  <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={lang === "zh" ? "至少 8 位" : "At least 8 chars"} />
                </label>
                <label>
                  {t("invite")}
                  <input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder={t("invite_hint")} />
                </label>
                {err && <div className="form-error">{err}</div>}
                <button className="btn btn-primary btn-block">{t("register")}</button>
              </form>
              <p className="auth-switch">
                {t("have_account")}<a href="#rs-login" onClick={(e) => { e.preventDefault(); go({ name: "login" }); }}>{t("go_login")}</a>
              </p>
            </div>
          )}

          {route.name === "verify" && (
            <div className="auth-box">
              <h1>{t("verify_title")}</h1>
              <p className="auth-hint">{t("verify_hint")}</p>
            <form onSubmit={verify}>
                <label>
                  {t("email")}
                  <input type="email" required value={pendingEmail} readOnly />
                </label>
                <label>
                  {t("verify_code")}
                  <input
                    required
                    inputMode="numeric"
                    minLength={4}
                    maxLength={8}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    placeholder={lang === "zh" ? "演示页面，任意数字" : "Demo: any digits"}
                  />
                </label>
                {err && <div className="form-error">{err}</div>}
                <button className="btn btn-primary btn-block">{t("verify_btn")}</button>
              </form>
            </div>
          )}
          {route.name === "cart" && (
            (user ? (
              <div>
                <h1 className="page-title">{t("cart_title")}</h1>
                {cart.length === 0 ? (
                  <div className="empty">{t("cart_empty")}</div>
                ) : (
                  <>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>{t("col_product")}</th>
                          <th>{t("col_price")}</th>
                          <th>{t("col_qty")}</th>
                          <th>{t("col_subtotal")}</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {cart.map((it) => (
                          <tr key={it.product.id}>
                            <td>{lang === "en" && it.product.name_en ? it.product.name_en : it.product.name}</td>
                            <td>{priceCell(it.product)}</td>
                            <td>
                              <input
                                className="qty-input"
                                type="number"
                                min={1}
                                max={99}
                                value={it.qty}
                                onChange={(e) => changeQty(it.product.id, Math.max(1, Math.min(Number(e.target.value) || 1, 99)))}
                              />
                            </td>
                            <td>¥{yuan(effectiveCents(it.product) * it.qty)}</td>
                            <td>
                              <button className="btn-link danger" onClick={() => removeLine(it.product.id)}>{t("remove")}</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="cart-foot">
                      <div className="cart-summary">
                        <span>
                          {t("items_total")
                            .replace("{n}", String(cart.reduce((s, i) => s + i.qty, 0)))
                            .replace("，", lang === "zh" ? "，" : " ")}
                        </span>
                        {memberDiscountCents > 0 && (
                          <span className="cart-discount-note">
                            {t("member_discount")
                              .replace("{p}", String(user?.discount_percent ?? 0))
                              .replace("{amount}", `¥${yuan(memberDiscountCents)}`)}
                          </span>
                        )}
                        <span>
                          <b className="price">¥{yuan(subtotalCents - memberDiscountCents)}</b>
                        </span>
                      </div>
                      <button className="btn btn-primary" onClick={checkout}>{t("checkout")}</button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="empty">{t("please_login")}</div>
            ))
          )}

          {route.name === "orders" && (
            (user ? (
              <div>
                <h1 className="page-title">{t("orders_title")}</h1>
                {orders.length === 0 ? (
                  <div className="empty">{t("no_orders")}</div>
                ) : (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{t("col_order_no")}</th>
                        <th>{t("col_items")}</th>
                        <th>{t("col_amount")}</th>
                        <th>{t("col_status")}</th>
                        <th>{t("col_time")}</th>
                        <th>{t("col_actions")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((o) => (
                        <tr key={o.id}>
                          <td className="mono">{o.order_no}</td>
                          <td>
                            {o.lines.map((i, idx) => (
                              <div key={idx} className="order-item">
                                {i.name} × {i.qty}
                              </div>
                            ))}
                          </td>
                          <td>
                            ¥{yuan(o.total_cents)}
                            {o.discount_cents > 0 && (
                              <div className="order-discount">
                                {lang === "zh" ? `会员折扣 -¥${yuan(o.discount_cents)}` : `Member discount -¥${yuan(o.discount_cents)}`}
                              </div>
                            )}
                          </td>
                          <td>
                            <span className={"badge " + o.status}>
                              {(lang === "en" ? STATUS_TEXT_EN : STATUS_TEXT)[o.status]}
                            </span>
                            {o.paid_at && <div className="paid-at">{fmtTime(o.paid_at)}</div>}
                          </td>
                          <td>{fmtTime(o.created_at)}</td>
                          <td>
                            {o.status === "pending_payment" && (
                              <>
                                <button className="btn btn-sm btn-primary" onClick={() => pay(o.id)}>{t("pay_now")}</button>{" "}
                                <button className="btn btn-sm" onClick={() => cancel(o.id)}>{t("cancel")}</button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ) : (
              <div className="empty">{t("please_login")}</div>
            ))
          )}

          {route.name === "profile" && user && (
            <div className="auth-box wide">
              <h1>{t("profile_title")}</h1>
              <table className="table">
                <tbody>
                  <tr>
                    <th>{t("username")}</th>
                    <td>{user.username}</td>
                  </tr>
                  <tr>
                    <th>{t("email")}</th>
                    <td>
                      {user.email} <span className="badge paid">{t("verified")}</span>
                    </td>
                  </tr>
                  <tr>
                    <th>{t("role")}</th>
                    <td>
                      {user.role === "admin" ? t("role_admin") : user.role === "super_admin" ? t("role_super") : t("role_user")}
                    </td>
                  </tr>
                  {user.discount_percent > 0 && (
                    <tr>
                      <th>{t("discount_label")}</th>
                      <td>
                        {user.discount_percent}% ({"zh" === lang ? "下单时自动抵扣" : "auto-applied at checkout"})
                      </td>
                    </tr>
                  )}
                  <tr>
                    <th>{t("created_at")}</th>
                    <td>{fmtTime(user.created_at)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </main>

        <footer className="footer">
          {lang === "zh"
            ? "PTCG Shop · FastAPI + React · 演示项目（GitHub Pages 静态复刻，无后端请求）"
            : "PTCG Shop · FastAPI + React · Demo (static GitHub Pages replica, no backend calls)"}
        </footer>
      </div>
    </div>
  );
}
