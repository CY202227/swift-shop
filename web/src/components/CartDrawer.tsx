import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { removeItem, setItemQty, suppressCartEmitDuring, useCart } from "../cartStore";
import { closeDrawer, useDrawerOpen } from "../uiStore";
import { useI18n } from "../i18n";
import { yuan } from "../format";

// Right-side slide-over drawer so shoppers see what they just added
// without leaving the catalog. Open/close state lives in uiStore so
// toggling never re-renders the App tree (that re-render was eating the
// animation's frames). Reads the shared cart store — add-to-cart feeds
// the cache, so the drawer opens with content immediately.
export default function CartDrawer() {
  const open = useDrawerOpen();
  const cart = useCart();
  // Per-item in-flight bookkeeping now lives in a ref: pending used to be
  // state, so EVERY +/-/remove click re-rendered the whole drawer (all item
  // rows + totals) twice. The DOM never reads pending during render — the
  // buttons' disabled state comes from qty/stock and the optimistic cart
  // update already re-renders the row — so a ref loses nothing.
  const pending = useRef<Set<number>>(new Set());
  const { t } = useI18n();
  const navigate = useNavigate();

  // lock page scroll while open. scrollbar-gutter: stable (on <html>)
  // already reserves the gutter, so overflow:hidden causes no reflow and
  // the slide animation keeps its frames.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Mount gate: the drawer's item DOM is heavy (rows, thumbs, totals). New
  // mounts wait until the slide finishes so the compositor keeps its frames;
  // once mounted the DOM stays mounted forever — later opens mount nothing
  // and zero style/layout work happens during their slide.
  const [itemsReady, setItemsReady] = useState(false); // never reset
  const itemsMountedRef = useRef(false);
  const prevOpenRef = useRef(false);
  useLayoutEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const wasOpen = prevOpenRef.current;
    prevOpenRef.current = open;
    if (!wasOpen && !open) return; // initial mount, no transition — no-op
    // both slides get the same main-thread protection: in-flight cart
    // write-backs stay hidden until the drawer finishes moving
    suppressCartEmitDuring(reduceMotion ? 0 : open ? 320 : 260);
    if (!open || itemsMountedRef.current) return;
    const timer = window.setTimeout(() => {
      itemsMountedRef.current = true;
      // deliver any writes the slide window held back together with the
      // skeleton->rows swap: one batched render, not two stacked ones
      suppressCartEmitDuring(0);
      setItemsReady(true);
    }, reduceMotion ? 0 : 320); // past the 260ms slide window
    return () => window.clearTimeout(timer); // quick close re-arms the gate
  }, [open]);

  const mark = (id: number, on: boolean) => {
    if (on) pending.current.add(id);
    else pending.current.delete(id);
    // No setState here: pending never feeds the DOM (button disabled state
    // derives from qty/stock and the optimistic cart update already
    // re-renders), so flipping it must not re-render all drawer rows.
  };

  // same-item double clicks are gated; different items run in parallel
  const run = async (id: number, fn: () => Promise<unknown>) => {
    if (pending.current.has(id)) return;
    // a real interaction beats the open-slide suppression window: the
    // optimistic update below must paint immediately, not after the slide
    suppressCartEmitDuring(0);
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

  const goCheckout = () => {
    closeDrawer();
    navigate("/cart");
  };

  return (
    <>
      <div
        className={"drawer-backdrop" + (open ? " show" : "")}
        onClick={closeDrawer}
      />
      <aside className={"cart-drawer" + (open ? " open" : "")} aria-hidden={!open}>
        <div className="drawer-head">
          <span>
            {t("cart_title")} <span className="drawer-count">{count}</span>
          </span>
          <button className="drawer-close" onClick={closeDrawer} aria-label="close">x</button>
        </div>

        {cart === null ? (
          // cold cache (rare) — brief hint instead of a wrong "empty" flash
          <div className="drawer-empty">{t("loading")}</div>
        ) : !itemsReady && items.length > 0 ? (
          // first open, mid-slide: skeleton only. One cheap div instead of
          // the full row list keeps the slide window free of style/layout.
          <div className="drawer-empty drawer-skeleton">{t("loading")}</div>
        ) : items.length === 0 ? (
          <div className="drawer-empty">{t("cart_empty")}</div>
        ) : (
          <>
            <div className="drawer-items">
              {items.map((it) => (
                <div key={it.id} className="drawer-item">
                  <div className="drawer-item-thumb">
                    {it.images && it.images.length > 0 ? (
                      <img src={it.images[0]} alt={it.name} loading="lazy" decoding="async" />
                    ) : (
                      <span>{it.name.slice(0, 1)}</span>
                    )}
                  </div>
                  <div className="drawer-item-info">
                    <Link to={"/product/" + it.slug} onClick={closeDrawer} className="drawer-item-name">
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
              <button className="btn btn-primary drawer-checkout" onClick={goCheckout}>
                {t("checkout")}
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
