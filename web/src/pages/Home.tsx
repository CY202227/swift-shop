import { useContext, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { get, post, ApiError } from "../api";
import { AuthContext } from "../auth";
import { useI18n } from "../i18n";
import { yuan } from "../format";
import type { ProductPage } from "../types";

export default function Home() {
  const [data, setData] = useState<ProductPage | null>(null);
  const [err, setErr] = useState("");
  const { user, openCart } = useContext(AuthContext);
  const { t } = useI18n();
  const navigate = useNavigate();

  useEffect(() => {
    get("/api/v1/products?page=1&size=48")
      .then((d) => setData(d as ProductPage))
      .catch((e) => setErr(e instanceof ApiError ? e.detail : t("load_failed")));
  }, []);

  const addToCart = async (productId: number) => {
    if (!user) {
      navigate("/login");
      return;
    }
    try {
      await post("/api/v1/cart", { product_id: productId, qty: 1 });
      openCart?.(); // slide the drawer out instead of leaving the catalog
    } catch (e) {
      setErr(e instanceof ApiError ? e.detail : t("err_add_cart"));
    }
  };

  if (err && !data) return <div className="empty">{err}</div>;
  if (!data) return <div className="empty">{t("loading")}</div>;

  return (
    <div>
      <div className="hero">
        <h1>{t("hero_title")}</h1>
        <p>{t("hero_sub")}</p>
      </div>
      <div className="product-grid">
        {data.items.map((p) => {
          const disc = p.discount_percent ?? 0;
          const eff = disc ? Math.max(1, Math.floor(p.price_cents * (100 - disc) / 100)) : p.price_cents;
          return (
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
                  <span className="price">
                    {disc > 0 && (
                      <s className="price-was">¥{yuan(p.price_cents)}</s>
                    )}
                    ¥{yuan(eff)}
                    {disc > 0 && <span className="discount-tag">-{disc}%</span>}
                  </span>
                  <span className={"stock" + (p.stock <= 0 ? " out" : "")}>
                    {p.stock > 0 ? t("stock_left", { n: p.stock }) : t("sold_out")}
                  </span>
                </div>
                <button
                  className="btn btn-primary btn-block"
                  disabled={p.stock <= 0}
                  onClick={() => addToCart(p.id)}
                >
                  {t("add_to_cart")}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
