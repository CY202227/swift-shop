import { yuan } from "./mock";

// Pure-frontend storefront mock: cards, a demo cart, and the orderstatus flow
// that the real backend implements — zero network requests.
export default function StoreDemo() {
  return (
    <div className="demo-grid">
      <div className="demo-products">
        <div className="demo-label">商城商品（静态假数据）</div>
        <div className="demo-cards">
          <div className="demo-card">
            <div className="demo-emoji">⌨️</div>
            <div className="demo-name">机械键盘 87键</div>
            <div className="demo-price">{yuan(29900)}</div>
            <div className="demo-add">加入购物车</div>
          </div>
          <div className="demo-card">
            <div className="demo-emoji">🖱️</div>
            <div className="demo-name">无线鼠标</div>
            <div className="demo-price">{yuan(12900)}</div>
            <div className="demo-add">加入购物车</div>
          </div>
          <div className="demo-card">
            <div className="demo-emoji">🎧</div>
            <div className="demo-name">降噪耳机</div>
            <div className="demo-price">{yuan(89900)}</div>
            <div className="demo-add">加入购物车</div>
          </div>
        </div>

        <div className="demo-cart">
          <div className="demo-cart-head">🛒 购物车（前端仅作展示，金额由服务端重算）</div>
          <div className="demo-line">
            <span>机械键盘 87键 × 1</span>
            <span>{yuan(29900)}</span>
          </div>
          <div className="demo-line">
            <span>无线鼠标 × 2</span>
            <span>{yuan(25800)}</span>
          </div>
          <div className="demo-line total">
            <span>服务端重算合计</span>
            <span>{yuan(55700)}</span>
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
