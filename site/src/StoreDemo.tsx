import { useI18n } from "./i18n";
import { products, promotion, yuan, effectiveCents } from "./mock";

// Compact static panels beside the replica entry point: sample cards + the
// order-status flow. The full interactive replica lives in StoreReplica.tsx.
export default function StoreDemo() {
  const { lang, t } = useI18n();
  const en = lang === "en";
  const cards = products.slice(0, 3);
  const p0 = products[0];
  const p1 = products[1];

  return (
    <div className="demo-grid">
      <div className="demo-products">
        <div className="demo-label">
          {en ? "Shop cards (enter the replica to browse all)" : "商城卡牌（进入复刻视图可完整浏览）"}
        </div>
        <div className="demo-cards">
          {cards.map((p) => {
            const eff = effectiveCents(p);
            const discounted = eff < p.price_cents;
            return (
              <div key={p.id} className="demo-card">
                <div className="demo-emoji">{p.name.slice(0, 2)}</div>
                <div className="demo-name">
                  {(en && p.name_en ? p.name_en : p.name).length > 14 ? (en && p.name_en ? p.name_en : p.name).slice(0, 13) + "…" : (en && p.name_en ? p.name_en : p.name)}
                </div>
                <div className="demo-price">
                  {discounted && <span className="price-was">{yuan(p.price_cents)}</span>} {yuan(eff)}
                  {discounted && (
                    <span className="discount-tag">-{((1 - eff / p.price_cents) * 100).toFixed(0)}%</span>
                  )}
                </div>
                <div className="demo-add">{en ? "View detail" : "查看详情"}</div>
              </div>
            );
          })}
        </div>

        <div className="demo-cart">
          <div className="demo-cart-head">
            🛒 {en ? "Cart sample (display; totals recomputed server-side)" : "购物车示例（前端展示，金额由服务端重算）"}
          </div>
          <div className="demo-line">
            <span>{en ? p0.name_en : p0.name} × 1</span>
            <span>{yuan(effectiveCents(p0))}</span>
          </div>
          <div className="demo-line">
            <span>{en ? p1.name_en : p1.name} × 2</span>
            <span>{yuan(effectiveCents(p1) * 2)}</span>
          </div>
          {promotion.active && (
            <div className="demo-line promo">
              <span>
                {en
                  ? `Campaign: 10% off everything (stacked above)`
                  : "活动：全场 9 折（已叠加到上方单价）"}
              </span>
              <span></span>
            </div>
          )}
          <div className="demo-line total">
            <span>{en ? "Discounted subtotal" : "折后小计（未含会员折扣）"}</span>
            <span>{yuan(effectiveCents(p0) + effectiveCents(p1) * 2)}</span>
          </div>
        </div>
      </div>

      <div className="demo-flow">
        <div className="demo-label">
          {en ? "Order status flow (matches the real backend)" : "订单状态流转（与真实后端一致）"}
        </div>
        <div className="flow">
          <span className="node pending">{en ? "Pending" : "待支付"}</span>
          <span className="arrow">────▶</span>
          <span className="node paid">{en ? "Paid" : "已支付"}</span>
        </div>
        <div className="flow-note">💳 {en ? "Mock cashier → HMAC-signed webhook → idempotent ledger" : "Mock 收银台 → HMAC 签名 webhook → 幂等落账"}</div>
        <div className="flow">
          <span className="node pending">{en ? "Pending" : "待支付"}</span>
          <span className="arrow">────▶</span>
          <span className="node cancelled">{en ? "Cancelled" : "已取消"}</span>
        </div>
        <div className="flow-note">↩ {en ? "Cancel → atomic stock restore (conditional SQL)" : "取消订单 → 库存原子回补（SQL 条件更新）"}</div>
        <div className="flow-note" style={{ marginTop: 12 }}>
          {en
            ? "Click any “Browse the store” button to run the full flow in the replica view."
            : "点击页面任意「进入商城浏览」，即可在复刻视图中完整走一遍上述流程。"}
        </div>
      </div>
    </div>
  );
}
