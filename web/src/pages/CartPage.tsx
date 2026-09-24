import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { del, get, patch, post, ApiError } from "../api";
import { useI18n } from "../i18n";
import { yuan } from "../format";
import type { Cart } from "../types";

export default function CartPage() {
  const [cart, setCart] = useState<Cart | null>(null);
  const [msg, setMsg] = useState("");
  const { t } = useI18n();
  const navigate = useNavigate();

  const reload = () => {
    get("/api/v1/cart")
      .then((d) => setCart(d as Cart))
      .catch((e) => setMsg(e instanceof ApiError ? e.detail : t("load_failed")));
  };

  useEffect(reload, []);

  const changeQty = async (itemId: number, qty: number) => {
    try {
      setCart(await patch(`/api/v1/cart/${itemId}`, { qty }) as Cart);
    } catch (e) {
      setMsg(e instanceof ApiError ? e.detail : t("err_update_cart"));
    }
  };

  const removeItem = async (itemId: number) => {
    try {
      setCart(await del(`/api/v1/cart/${itemId}`) as Cart);
    } catch (e) {
      setMsg(e instanceof ApiError ? e.detail : t("err_remove_cart"));
    }
  };

  const checkout = async () => {
    try {
      const order = await post("/api/v1/orders", {});
      navigate("/orders", { state: { newOrder: order } });
    } catch (e) {
      setMsg(e instanceof ApiError ? e.detail : t("err_checkout"));
    }
  };

  if (!cart) return <div className="empty">{msg || t("loading")}</div>;

  const promo = cart.promotion;
  const userDisc = cart.user_discount_percent ?? 0;

  return (
    <div>
      <h1 className="page-title">{t("cart_title")}</h1>
      {cart.items.length === 0 ? (
        <div className="empty">{t("cart_empty")}</div>
      ) : (
        <>
          {promo && (
            <div className="promo-banner">
              🎉 {promo.name} —{" "}
              {promo.kind === "percent_off"
                ? t("promo_percent", { p: promo.value })
                : t("promo_bng1", { n: promo.value })}
            </div>
          )}
          <table className="table">
            <thead>
              <tr>
                <th>{t("col_product")}</th>
                <th>{t("col_unit_price")}</th>
                <th>{t("col_qty")}</th>
                <th>{t("col_subtotal")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cart.items.map((it) => (
                <tr key={it.id}>
                  <td>
                    {it.name}
                    {(it.product_discount_percent ?? 0) > 0 && (
                      <span className="discount-tag">-{it.product_discount_percent}%</span>
                    )}
                  </td>
                  <td>
                    {(it.product_discount_percent ?? 0) > 0 ? (
                      <>
                        <s className="price-was">¥{yuan(it.price_cents)}</s>{" "}
                        ¥{yuan(it.effective_unit_cents ?? it.price_cents)}
                      </>
                    ) : (
                      <>¥{yuan(it.price_cents)}</>
                    )}
                  </td>
                  <td>
                    <input
                      className="qty-input"
                      type="number"
                      min={1}
                      max={Math.min(it.stock, 99)}
                      value={it.qty}
                      onChange={(e) =>
                        changeQty(it.id, Math.max(1, Math.min(Number(e.target.value) || 1, Math.min(it.stock, 99))))
                      }
                    />
                  </td>
                  <td>¥{yuan(it.subtotal_cents)}</td>
                  <td>
                    <button className="btn-link danger" onClick={() => removeItem(it.id)}>
                      {t("remove")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="cart-foot">
            <div className="cart-summary">
              <span>
                {t("items_total", {
                  n: cart.items.reduce((s, i) => s + i.qty, 0),
                })}
              </span>
              {" "}
              <b className="price">¥{yuan(cart.total_cents)}</b>
              {userDisc > 0 && (
                <div className="cart-discount-note">
                  {t("member_discount_line", {
                    n: userDisc,
                    amount: "¥" + yuan(cart.user_discount_cents ?? 0),
                  })}
                </div>
              )}
            </div>
            <button className="btn btn-primary" onClick={checkout}>
              {t("checkout")}
            </button>
          </div>
        </>
      )}
      {msg && <div className="form-error">{msg}</div>}
    </div>
  );
}
