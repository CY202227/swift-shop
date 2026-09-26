import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { removeItem, setItemQty, useCart } from "../cartStore";
import { useI18n } from "../i18n";
import { yuan } from "../format";
import type { CartItem } from "../types";

// Right-side slide-over drawer so shoppers see what they just added
// without leaving the catalog. Reads the shared cart store — add-to-cart
// feeds the cache from the POST response, so the drawer opens with
// content immediately; each +/- click is ONE request (optimistic UI,
// rollback on failure).
export default function CartDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const cart = useCart();
  const [pending, setPending] = useState<Set<number>>(new Set());
  const { t } = useI18n();
  const navigate = useNavigate();

  // lock page scroll while open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const mark = (id: number, on: boolean) => {
    setPending((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  // same-item double clicks are gated; different items run in parallel
  const run = async (id: number, fn: () => Promise<unknown>) => {
    if (pending.has(id)) return;
    mark(id, true);
    try {
      await fn();
    } catch {
      // store already rolled the optimistic change back
    } finally {
      mark(id, false);
    }
  };

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

        {cart === null ? (
          // first load (rare: only before any fetch completed) — show a
          // hint instead of flashing the wrong "empty cart" message
          <div className="drawer-empty">{t("loading")}</div>
        ) : items.length === 0 ? (
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
                        disabled={it.qty <= 1}
                        onClick={() => run(it.id, () => setItemQty(it, it.qty - 1))}
                      >−</button>
                      <span>{it.qty}</span>
                      <button
                        disabled={it.qty >= Math.min(it.stock, 99)}
                        onClick={() => run(it.id, () => setItemQty(it, it.qty + 1))}
                      >+</button>
                    </div>
                    <button
                      className="drawer-remove"
                      onClick={() => run(it.id, () => removeItem(it))}
                    >
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
