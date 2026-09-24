import { useContext, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { get, post, ApiError } from "../api";
import { AuthContext } from "../auth";
import { yuan } from "../format";
import type { ProductPage } from "../types";

export default function Home() {
  const [data, setData] = useState<ProductPage | null>(null);
  const [err, setErr] = useState("");
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    get("/api/v1/products?page=1&size=50")
      .then((d) => setData(d as ProductPage))
      .catch((e) => setErr(e instanceof ApiError ? e.detail : "加载失败"));
  }, []);

  const addToCart = async (productId: number) => {
    if (!user) {
      navigate("/login");
      return;
    }
    try {
      await post("/api/v1/cart", { product_id: productId, qty: 1 });
      navigate("/cart");
    } catch (e) {
      setErr(e instanceof ApiError ? e.detail : "加购失败");
    }
  };

  if (err && !data) return <div className="empty">{err}</div>;
  if (!data) return <div className="empty">加载中…</div>;

  return (
    <div>
      <div className="hero">
        <h1>精选好物，即刻拥有</h1>
        <p>注册即购 · 邮箱验证 · 模拟支付全流程演示</p>
      </div>
      <div className="product-grid">
        {data.items.map((p) => (
          <div key={p.id} className="card product-card">
            <Link to={`/product/${p.slug}`}>
              <div className="product-thumb">
                {p.images && p.images.length > 0 ? (
                  <img src={p.images[0]} alt={p.name} />
                ) : (
                  <span>{p.name.slice(0, 1)}</span>
                )}
              </div>
            </Link>
            <div className="product-body">
              <Link to={`/product/${p.slug}`} className="product-name">
                {p.name}
              </Link>
              <div className="product-desc">{p.description}</div>
              <div className="product-foot">
                <span className="price">¥{yuan(p.price_cents)}</span>
                <span className={"stock" + (p.stock <= 0 ? " out" : "")}>
                  {p.stock > 0 ? `库存 ${p.stock}` : "售罄"}
                </span>
              </div>
              <button
                className="btn btn-primary btn-block"
                disabled={p.stock <= 0}
                onClick={() => addToCart(p.id)}
              >
                加入购物车
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
