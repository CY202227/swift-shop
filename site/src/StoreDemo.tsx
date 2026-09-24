import { products, yuan } from "./mock";

// Pure-frontend storefront mock: PTCG card products, a demo cart, and the
// order-status flow that the real backend implements — zero network requests.
export default function StoreDemo() {
  const cards = products.slice(0, 3);
  return (
    <div className="demo-grid">
      <div className="demo-products">
        <div className="demo-label">商城商品（PTCG 卡牌 · 静态假数据）</div>
        <div className="demo-cards">
          {cards.map((p) => (
            <div key={p.id} className="demo-card">
              <div className="demo-emoji">{p.emoji}</div>
              <div className="demo-name">{p.name}</div>
              <div className="demo-price">{yuan(p.price_cents)}</div>
              <div className="demo-add">加入购物车</div>
            </div>
          ))}
        </div>

        <div className="demo-cart">
          <div className="demo-cart-head">🛒 购物车（前端仅作展示，金额由服务端重算）</div>
          {cards.slice(0, 2).map((p) => (
            <div key={p.id} className="demo-line">
              <span>{p.name} × {p.id === 1 ? 1 : 2}</span>
              <span>{yuan(p.price_cents * (p.id === 1 ? 1 : 2))}</span>
            </div>
          ))}
          <div className="demo-line total">
            <span>服务端重算合计</span>
            <span>{yuan(products[0].price_cents + products[1].price_cents * 2)}</span>
          </div>
          <div className="demo-btn">结算下单 →</div>
        </div>
      </div>

      <div className="demo-flow">
        <div className="demo-label">订单状态流转（与真实后端一致）</div>
        <div className="flow">
          <span className="node pending">待支付</span>
          <span className="arrow">────▶</span>
          <span className="node paid">已支付</span>
        </div>
        <div className="flow-note">💳 Mock 收银台 → HMAC 签名 webhook → 幂等落账</div>
        <div className="flow">
          <span className="node pending">待支付</span>
          <span className="arrow">────▶</span>
          <span className="node cancelled">已取消</span>
        </div>
        <div className="flow-note">↩ 取消订单 → 库存原子回补（SQL 条件更新）</div>
      </div>
    </div>
  );
}
