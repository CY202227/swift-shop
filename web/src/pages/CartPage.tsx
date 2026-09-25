import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { del, get, patch, post, ApiError } from "../api";
import { useI18n } from "../i18n";
import { yuan } from "../format";
import type { Cart } from "../types";

export default function CartPage() {
  const [cart, setCart] = useState<Cart | null>(null);
  const [msg, setMsg] = useState("");
  // shipping form state (checkout step 2)
  const [shipOpen, setShipOpen] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [shipping, setShipping] = useState(false);
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

  // step 1: open the shipping form for validation before creating the order
  const startCheckout = () => {
    if (!recipient.trim() || !phone.trim() || !address.trim()) {
      setShipOpen(true);
      setMsg(t("err_shipping_required"));
      return;
    }
    setShipOpen(true);
  };

  // step 2: submit the order with the shipping snapshot
  const checkout = async () => {
    if (!recipient.trim() || !phone.trim() || !address.trim()) {
      setMsg(t("err_shipping_required"));
      return;
    }
    setShipping(true);
    setMsg("");
    try {
      const order = await post("/api/v1/orders", {
        recipient_name: recipient.trim(),
        recipient_phone: phone.trim(),
        address: address.trim(),
      });
      navigate("/orders", { state: { newOrder: order } });
    } catch (e) {
      setMsg(e instanceof ApiError ? e.detail : t("err_checkout"));
      setShipping(false);
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

          {/* shipping info form — required before the order can be created */}
          <div className="ship-box">
            <div className="ship-head" onClick={() => setShipOpen(!shipOpen)}>
              <b>{t("ship_title")}</b>
              <span className="ship-toggle">{shipOpen ? "−" : "+"}</span>
            </div>
            {shipOpen && (
              <div className="ship-form">
                <label>
                  <span>{t("ship_name")}</span>
                  <input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder={t("ship_name_ph")} maxLength={64} />
                </label>
                <label>
                  <span>{t("ship_phone")}</span>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("ship_phone_ph")} maxLength={32} />
                </label>
                <label>
                  <span>{t("ship_address")}</span>
                  <textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t("ship_address_ph")} maxLength={255} rows={2} />
                </label>
                <div className="ship-note">{t("ship_note")}</div>
              </div>
            )}
          </div>

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
            <button className="btn btn-primary" disabled={shipping} onClick={shipOpen ? checkout : startCheckout}>
              {shipping ? t("shipping_busy") : t("checkout")}
            </button>
          </div>
        </>
      )}
      {msg && <div className="form-error">{msg}</div>}
    </div>
  );
}
