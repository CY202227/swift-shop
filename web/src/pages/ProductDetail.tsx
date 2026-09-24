import { useContext, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { get, post, ApiError } from "../api";
import { AuthContext } from "../auth";
import { yuan } from "../format";
import type { Product } from "../types";

export default function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [p, setP] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);
  const [msg, setMsg] = useState("");
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    get(`/api/v1/products/${slug}`)
      .then((d) => setP(d as Product))
      .catch((e) => setMsg(e instanceof ApiError ? e.detail : "商品不存在"));
  }, [slug]);

  const addToCart = async () => {
    if (!user) {
      navigate("/login");
      return;
    }
    try {
      await post("/api/v1/cart", { product_id: p!.id, qty });
      navigate("/cart");
    } catch (e) {
      setMsg(e instanceof ApiError ? e.detail : "加购失败");
    }
  };

  if (!p) return <div className="empty">{msg || "加载中…"}</div>;

  return (
    <div className="detail">
      <div className="detail-thumb">
        {p.images && p.images.length > 0 ? (
          <img src={p.images[0]} alt={p.name} />
        ) : (
          <span>{p.name.slice(0, 1)}</span>
        )}
      </div>
      <div className="detail-info">
        <h1>{p.name}</h1>
        <p className="product-desc">{p.description}</p>
        <div className="price-lg">¥{yuan(p.price_cents)}</div>
        <div className={"stock" + (p.stock <= 0 ? " out" : "")}>
          {p.stock > 0 ? `库存 ${p.stock} 件` : "已售罄"}
        </div>
        <div className="qty-row">
          <label>数量</label>
          <input
            type="number"
            min={1}
            max={Math.min(p.stock, 99)}
            value={qty}
            onChange={(e) => setQty(Math.max(1, Math.min(Number(e.target.value) || 1, Math.min(p.stock, 99))))}
          />
        </div>
        {msg && <div className="form-error">{msg}</div>}
        <button className="btn btn-primary" disabled={p.stock <= 0} onClick={addToCart}>
          加入购物车
        </button>
      </div>
    </div>
  );
}
