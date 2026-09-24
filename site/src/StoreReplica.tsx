import { useState } from "react";
import { products, type MockProduct } from "./mock";

// ---------------------------------------------------------------------------
// Pixel-accurate replica of the real web/ storefront, rendered inside the
// Pages facade. Same CSS variables, same class names, same layout. State is
// local (mock user/cart/orders) — zero network requests, as Pages has no
// backend. Clicking the storefront link swaps the whole screen to this view.
// ---------------------------------------------------------------------------

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
  total_cents: number;
  status: "pending_payment" | "paid" | "cancelled";
  created_at: string;
  paid_at: string | null;
}

interface MockUser {
  username: string;
  email: string;
  role: string;
  created_at: string;
}

const yuan = (cents: number) => (cents / 100).toFixed(2);
const STATUS_TEXT: Record<string, string> = {
  pending_payment: "待支付",
  paid: "已支付",
  cancelled: "已取消",
  completed: "已完成",
};
const fmtTime = (iso: string | null) => (!iso ? "—" : iso.replace("T", " ").slice(0, 16));

export default function StoreReplica({ onExit }: { onExit: () => void }) {
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
      setUser({ username: "宝可梦训练家", email, role: "user", created_at: new Date().toISOString() });
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
      setErr("请输入验证码");
      return;
    }
    setUser({ username: username || "宝可梦训练家", email: pendingEmail, role: "user", created_at: new Date().toISOString() });
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
        const total = c.reduce((s, l) => s + l.product.price_cents * l.qty, 0);
        setOrders((os) => [
          {
            id: Date.now(),
            order_no: no,
            lines: c.map((l) => ({ name: l.product.name, qty: l.qty })),
            total_cents: total,
            status: "pending_payment",
            created_at: new Date().toISOString(),
            paid_at: null,
          },
          ...os,
        ]);
        setBanner(`订单 ${no} 已创建，请尽快支付（状态流转见下表）`);
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
    setBanner("模拟支付成功（Mock 收银台 → HMAC 签名 webhook → 幂等落账）");
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

  const totalCents = cart.reduce((s, l) => s + l.product.price_cents * l.qty, 0);

  return (
    <div className="replica-scope">
      <button className="replica-exit" onClick={onExit} title="返回演示门面">
        ← 返回门面
      </button>

      <div className="rs-app-shell">
        <header className="navbar">
          <div className="container rs-nav-inner">
            <a href="#rs-home" className="brand" onClick={(e) => { e.preventDefault(); go({ name: "home" }); }}>
              🃏 PTCG Shop
            </a>
            <nav className="nav-links">
              <a href="#rs-home" onClick={(e) => { e.preventDefault(); go({ name: "home" }); }}>商品</a>
              {user ? (
                <>
                  <a href="#rs-cart" onClick={(e) => { e.preventDefault(); go({ name: "cart" }); }}>购物车</a>
                  <a href="#rs-orders" onClick={(e) => { e.preventDefault(); go({ name: "orders" }); }}>我的订单</a>
                  <a href="#rs-profile" className="nav-user" onClick={(e) => { e.preventDefault(); go({ name: "profile" }); }}>
                    {user.username}
                  </a>
                  <button className="btn-link" onClick={logout}>退出</button>
                </>
              ) : (
                <>
                  <a href="#rs-login" onClick={(e) => { e.preventDefault(); go({ name: "login" }); }}>登录</a>
                  <a href="#rs-register" onClick={(e) => { e.preventDefault(); go({ name: "register" }); }}>注册</a>
                </>
              )}
            </nav>
          </div>
        </header>

        <main className="container">
          {banner && <div className="banner">{banner}</div>}

          {route.name === "home" && (
            <div>
              <div className="hero">
                <h1>精选好物，即刻拥有</h1>
                <p>注册即购 · 邮箱验证 · 模拟支付全流程演示</p>
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
                        {p.name}
                      </a>
                      <div className="product-desc">{p.desc}</div>
                      <div className="product-foot">
                        <span className="price">¥{yuan(p.price_cents)}</span>
                        <span className="stock">库存 {p.stock}</span>
                      </div>
                      <button className="btn btn-primary btn-block" onClick={() => addToCart(p, 1)}>
                        加入购物车
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {route.name === "detail" && (() => {
            const p = products.find((x) => x.slug === route.slug);
            if (!p) return <div className="empty">商品不存在</div>;
            return (
              <div className="detail">
                <div className="detail-thumb">
                  <span>{p.name.slice(0, 1)}</span>
                </div>
                <div className="detail-info">
                  <h1>{p.name}</h1>
                  <p className="product-desc">{p.desc}</p>
                  <div className="price-lg">¥{yuan(p.price_cents)}</div>
                  <div className="stock">库存 {p.stock} 件</div>
                  <div className="qty-row">
                    <label>数量</label>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={detailQty}
                      onChange={(e) => setDetailQty(Math.max(1, Math.min(Number(e.target.value) || 1, 99)))}
                    />
                  </div>
                  <button className="btn btn-primary" onClick={() => { addToCart(p, detailQty); setDetailQty(1); }}>
                    加入购物车
                  </button>
                </div>
              </div>
            );
          })()}

          {route.name === "login" && (
            <div className="auth-box">
              <h1>登录</h1>
              <form onSubmit={login}>
                <label>
                  邮箱
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                </label>
                <label>
                  密码
                  <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="至少 8 位" />
                </label>
                {err && <div className="form-error">{err}</div>}
                <button className="btn btn-primary btn-block" disabled={busy}>
                  {busy ? "登录中…" : "登录"}
                </button>
              </form>
              <p className="auth-switch">
                还没有账号？<a href="#rs-register" onClick={(e) => { e.preventDefault(); go({ name: "register" }); }}>去注册</a>
              </p>
            </div>
          )}

          {route.name === "register" && (
            <div className="auth-box">
              <h1>注册</h1>
              <form onSubmit={register}>
                <label>
                  用户名
                  <input required minLength={2} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="2-64 字符" />
                </label>
                <label>
                  邮箱
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                </label>
                <label>
                  密码
                  <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="至少 8 位" />
                </label>
                <label>
                  邀请码（可选）
                  <input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder="如果管理员开启了邀请注册" />
                </label>
                {err && <div className="form-error">{err}</div>}
                <button className="btn btn-primary btn-block">注册</button>
              </form>
              <p className="auth-switch">
                已有账号？<a href="#rs-login" onClick={(e) => { e.preventDefault(); go({ name: "login" }); }}>去登录</a>
              </p>
            </div>
          )}

          {route.name === "verify" && (
            <div className="auth-box">
              <h1>邮箱验证</h1>
              <p className="auth-hint">演示环境：任意 4 位以上数字即可通过验证</p>
            <form onSubmit={verify}>
                <label>
                  邮箱
                  <input type="email" required value={pendingEmail} readOnly />
                </label>
                <label>
                  验证码
                  <input
                    required
                    inputMode="numeric"
                    minLength={4}
                    maxLength={8}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="演示页面，任意数字"
                  />
                </label>
                {err && <div className="form-error">{err}</div>}
                <button className="btn btn-primary btn-block">完成注册</button>
              </form>
            </div>
          )}
          {route.name === "cart" && (
            (user ? (
              <div>
                <h1 className="page-title">购物车</h1>
                {cart.length === 0 ? (
                  <div className="empty">购物车是空的，去逛逛吧</div>
                ) : (
                  <>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>商品</th>
                          <th>单价</th>
                          <th>数量</th>
                          <th>小计</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {cart.map((it) => (
                          <tr key={it.product.id}>
                            <td>{it.product.name}</td>
                            <td>¥{yuan(it.product.price_cents)}</td>
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
                            <td>¥{yuan(it.product.price_cents * it.qty)}</td>
                            <td>
                              <button className="btn-link danger" onClick={() => removeLine(it.product.id)}>删除</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="cart-foot">
                      <span>
                        共 <b>{cart.reduce((s, i) => s + i.qty, 0)}</b> 件，合计{" "}
                        <b className="price">¥{yuan(totalCents)}</b>
                      </span>
                      <button className="btn btn-primary" onClick={checkout}>结算下单</button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="empty">请先登录</div>
            ))
          )}

          {route.name === "orders" && (
            (user ? (
              <div>
                <h1 className="page-title">我的订单</h1>
                {orders.length === 0 ? (
                  <div className="empty">还没有订单</div>
                ) : (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>订单号</th>
                        <th>商品</th>
                        <th>金额</th>
                        <th>状态</th>
                        <th>创建时间</th>
                        <th>操作</th>
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
                          <td>¥{yuan(o.total_cents)}</td>
                          <td>
                            <span className={"badge " + o.status}>{STATUS_TEXT[o.status]}</span>
                            {o.paid_at && <div className="paid-at">{fmtTime(o.paid_at)}</div>}
                          </td>
                          <td>{fmtTime(o.created_at)}</td>
                          <td>
                            {o.status === "pending_payment" && (
                              <>
                                <button className="btn btn-sm btn-primary" onClick={() => pay(o.id)}>去支付</button>{" "}
                                <button className="btn btn-sm" onClick={() => cancel(o.id)}>取消</button>
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
              <div className="empty">请先登录</div>
            ))
          )}

          {route.name === "profile" && user && (
            <div className="auth-box wide">
              <h1>个人中心</h1>
              <table className="table">
                <tbody>
                  <tr>
                    <th>用户名</th>
                    <td>{user.username}</td>
                  </tr>
                  <tr>
                    <th>邮箱</th>
                    <td>
                      {user.email} <span className="badge paid">已验证</span>
                    </td>
                  </tr>
                  <tr>
                    <th>角色</th>
                    <td>{user.role === "admin" ? "管理员" : "用户"}</td>
                  </tr>
                  <tr>
                    <th>注册时间</th>
                    <td>{fmtTime(user.created_at)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </main>

        <footer className="footer">
          PTCG Shop · FastAPI + React · 演示项目（GitHub Pages 静态复刻，无后端请求）
        </footer>
      </div>
    </div>
  );
}
