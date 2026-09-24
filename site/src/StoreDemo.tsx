import { products, yuan } from "./mock";

// Compact static panels beside the replica entry point: sample cards + the
// order-status flow. The full interactive replica lives in StoreReplica.tsx.
export default function StoreDemo() {
  const cards = products.slice(0, 3);
  return (
    <div className="demo-grid">
      <div className="demo-products">
        <div className="demo-label">商城卡牌（进入复刻视图可完整浏览）</div>
        <div className="demo-cards">
          {cards.map((p) => (
            <div key={p.id} className="demo-card">
              <div className="demo-emoji">{p.name.slice(0, 2)}</div>
              <div className="demo-name">{p.name.length > 14 ? p.name.slice(0, 13) + "…" : p.name}</div>
              <div className="demo-price">{yuan(p.price_cents)}</div>
              <div className="demo-add">查看详情</div>
            </div>
          ))}
        </div>

        <div className="demo-cart">
          <div className="demo-cart-head">🛒 购物车示例（前端展示，金额由服务端重算）</div>
          <div className="demo-line">
            <span>{products[0].name} × 1</span>
            <span>{yuan(products[0].price_cents)}</span>
          </div>
          <div className="demo-line">
            <span>{products[1].name} × 2</span>
            <span>{yuan(products[1].price_cents * 2)}</span>
          </div>
          <div className="demo-line total">
            <span>服务端重算合计</span>
            <span>{yuan(products[0].price_cents + products[1].price_cents * 2)}</span>
          </div>
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
        <div className="flow-note" style={{ marginTop: 12 }}>
          点击页面任意「进入商城浏览」，即可在复刻视图中完整走一遍上述流程。
        </div>
      </div>
    </div>
  );
}
