import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { del, get, patch, ApiError } from "../api";
import { useI18n } from "../i18n";
import { yuan } from "../format";
import type { Cart, CartItem } from "../types";

// Right-side slide-over drawer so shoppers see what they just added
// without leaving the catalog. Shares the /cart data source; edits here
// are the same PATCH/DELETE calls the full cart page uses.
export default function CartDrawer({
  open,
  onClose,
  onCartChanged,
}: {
  open: boolean;
  onClose: () => void;
  onCartChanged?: () => void;
}) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [busy, setBusy] = useState(false);
  const { t } = useI18n();
  const navigate = useNavigate();
  const prevQty = useRef<Record<number, number>>({});

  // load cart content each time the drawer opens
  useEffect(() => {
    if (!open) return;
    get("/api/v1/cart")
      .then((d) => setCart(d as Cart))
      .catch(() => setCart(null));
  }, [open]);

  // lock page scroll while open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const mutateCart = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      const d = await get("/api/v1/cart");
      setCart(d as Cart);
      onCartChanged?.();
    } catch (e) {
      // silent in drawer; full cart page shows errors
    } finally {
      setBusy(false);
    }
  };

  const changeQty = (it: CartItem, qty: number) =>
    mutateCart(() => patch(`/api/v1/cart/${it.id}`, { qty }));

  const removeItem = (it: CartItem) =>
    mutateCart(() => del(`/api/v1/cart/${it.id}`));

  const items = cart?.items ?? [];
  const count = items.reduce((s, i) => s + i.qty, 0);
  const userDisc = cart?.user_discount_percent ?? 0;

  return (
    <>
      <div
        className={"drawer-backdrop" + (open ? " show" : "")}
        onClick={onClose}
      />
      <aside className={"cart-drawer" + (open ? " open" : "")} aria-hidden={!open}>
        <div className="drawer-head">
          <span>
            {t("cart_title")} <span className="drawer-count">{count}</span>
          </span>
          <button className="drawer-close" onClick={onClose} aria-label="close">✕</button>
        </div>

        {items.length === 0 ? (
          <div className="drawer-empty">{t("cart_empty")}</div>
        ) : (
          <>
            <div className="drawer-items">
              {items.map((it) => (
                <div key={it.id} className="drawer-item">
                  <div className="drawer-item-thumb">
                    {it.images && it.images.length > 0 ? (
                      <img src={it.images[0]} alt={it.name} />
                    ) : (
                      <span>{it.name.slice(0, 1)}</span>
                    )}
                  </div>
                  <div className="drawer-item-info">
                    <Link to={`/product/${it.slug}`} onClick={onClose} className="drawer-item-name">
                      {it.name}
                    </Link>
                    {(it.product_discount_percent ?? 0) > 0 && (
                      <span className="discount-tag">-{it.product_discount_percent}%</span>
                    )}
                    <div className="drawer-item-price">
                      ¥{yuan(it.effective_unit_cents ?? it.price_cents)} × {it.qty}
                      {(it.product_discount_percent ?? 0) > 0 && (
                        <s className="price-was">¥{yuan(it.price_cents)}</s>
                      )}
                    </div>
                  </div>
                  <div className="drawer-item-ops">
                    <div className="drawer-qty">
                      <button
                        disabled={busy || it.qty <= 1}
                        onClick={() => changeQty(it, it.qty - 1)}
                      >−</button>
                      <span>{it.qty}</span>
                      <button
                        disabled={busy || it.qty >= Math.min(it.stock, 99)}
                        onClick={() => changeQty(it, it.qty + 1)}
                      >+</button>
                    </div>
                    <button className="drawer-remove" onClick={() => removeItem(it)} disabled={busy}>
                      {t("remove")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="drawer-foot">
              {userDisc > 0 && (
                <div className="cart-discount-note">
                  {t("member_discount_line", {
                    n: userDisc,
                    amount: "¥" + yuan(cart?.user_discount_cents ?? 0),
                  })}
                </div>
              )}
              <div className="drawer-total-row">
                <span>{t("drawer_total")}</span>
                <b className="price">¥{yuan(cart?.total_cents ?? 0)}</b>
              </div>
              <button className="btn btn-primary drawer-checkout" onClick={() => { onClose(); navigate("/cart"); }}>
                {t("checkout")}
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
