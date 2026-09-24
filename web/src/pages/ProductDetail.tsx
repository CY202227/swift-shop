import { useContext, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { get, post, ApiError } from "../api";
import { AuthContext } from "../auth";
import { useI18n } from "../i18n";
import { yuan } from "../format";
import type { Product } from "../types";

export default function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [p, setP] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);
  const [msg, setMsg] = useState("");
  const { user } = useContext(AuthContext);
  const { t } = useI18n();
  const navigate = useNavigate();

  useEffect(() => {
    get(`/api/v1/products/${slug}`)
      .then((d) => setP(d as Product))
      .catch((e) => setMsg(e instanceof ApiError ? e.detail : t("load_failed")));
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
      setMsg(e instanceof ApiError ? e.detail : t("err_add_cart"));
    }
  };

  if (!p) return <div className="empty">{msg || t("loading")}</div>;

  const disc = p.discount_percent ?? 0;
  const eff = disc ? Math.max(1, Math.floor(p.price_cents * (100 - disc) / 100)) : p.price_cents;

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
        <div className="price-lg">
          {disc > 0 && <s className="price-was">¥{yuan(p.price_cents)}</s>}
          ¥{yuan(eff)}
          {disc > 0 && <span className="discount-tag">-{disc}%</span>}
        </div>
        <div className={"stock" + (p.stock <= 0 ? " out" : "")}>
          {p.stock > 0 ? `${t("stock_left", { n: p.stock })}` : t("sold_out")}
        </div>
        <div className="qty-row">
          <label>{t("col_qty")}</label>
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
          {t("add_to_cart")}
        </button>
      </div>
    </div>
  );
}
