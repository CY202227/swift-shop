// Shared cart store: single source of truth for drawer + cart page.
//
// Why: cart endpoints (POST/PATCH/DELETE /cart) already return the full
// CartOut — the old flow threw the response away, then re-fetched GET /cart,
// doubling every round trip. Now mutations feed the cache directly, so the
// drawer opens instantly with the latest data (no flash of "empty cart")
// and qty clicks update in a single request.
import { useEffect, useSyncExternalStore } from "react";
import { del, get, patch, post } from "./api";
import { loadTokens } from "./auth";
import type { Cart, CartItem } from "./types";

let cache: Cart | null = null; // null = not loaded yet
let inflight: Promise<Cart | null> | null = null;

const listeners = new Set<() => void>();

// Drawer slide-in animation window. The drawer holds a compositor layer
// (transform), but a mid-slide cart update still re-renders the drawer tree
// on the main thread — style/paint of rows + thumb decodes are exactly the
// frames the animation needs. Defer the emit until the slide finishes; the
// cache is fresh immediately so any non-animated reader sees the new data.
let suppressUntil = 0;
let pendingFlush = false; // a write landed while hidden — flush at window end

function emit(): void {
  const now = performance.now();
  if (now < suppressUntil) {
    pendingFlush = true;
    return;
  }
  listeners.forEach((l) => l());
}

function setCart(cart: Cart | null): Cart | null {
  cache = cart;
  emit();
  return cart;
}

/** Called by the drawer while its slide animation plays; emit() goes quiet
 *  for the window so re-renders can't steal the animation's frames. Updates
 *  landing inside the window flush to listeners when it ends — nothing is
 *  ever lost. ms=0 just flushes synchronously (used under reduced motion). */
export function suppressCartEmitDuring(ms: number): void {
  if (ms <= 0) {
    // still bump the window-relative bookkeeping, then flush immediately
    suppressUntil = 0;
    if (pendingFlush) {
      pendingFlush = false;
      listeners.forEach((l) => l());
    }
    return;
  }
  suppressUntil = performance.now() + ms;
  window.setTimeout(() => {
    suppressUntil = 0;
    if (pendingFlush) {
      pendingFlush = false;
      listeners.forEach((l) => l());
    }
  }, ms + 10); // small grace past the window edge
}

/** Fetch the cart once; concurrent callers share one request. Anonymous
 *  users skip fetch entirely (the drawer only shows for logged-in users). */
export function loadCart(): Promise<Cart | null> {
  if (cache) return Promise.resolve(cache);
  if (!loadTokens().access) return Promise.resolve(null); // not signed in
  if (inflight) return inflight;
  inflight = get("/api/v1/cart")
    .then((d) => setCart(d as Cart))
    .catch(() => setCart(null))
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function subscribeCart(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Reactive cart snapshot; auto-loads on first subscribe (single request). */
export function useCart(): Cart | null {
  const cart = useSyncExternalStore(
    subscribeCart,
    () => cache,
    () => null,
  );
  useEffect(() => {
    void loadCart();
  }, []);
  return cart;
}

export function cartCount(cart: Cart | null | undefined): number {
  if (!cart) return 0;
  return cart.items.reduce((s, i) => s + i.qty, 0);
}

// ---------- mutations: the response IS the new cart, feed cache directly ----------

export async function addItem(productId: number, qty: number): Promise<Cart> {
  const cart = (await post("/api/v1/cart", { product_id: productId, qty })) as Cart;
  return setCart(cart) as Cart;
}

export async function setItemQty(item: CartItem, qty: number): Promise<Cart> {
  if (!cache) {
    // no cache yet — just apply the server's answer
    const fresh = (await patch(`/api/v1/cart/${item.id}`, { qty })) as Cart;
    return setCart(fresh) as Cart;
  }
  // optimistic qty bump so +/- clicks feel instant while the request runs
  const prev = cache;
  setCart({
    ...prev,
    items: prev.items.map((i) => (i.id === item.id ? { ...i, qty } : i)),
  });
  try {
    const fresh = (await patch(`/api/v1/cart/${item.id}`, { qty })) as Cart;
    return setCart(fresh) as Cart;
  } catch (e) {
    setCart(prev); // rollback on failure
    throw e;
  }
}

export async function removeItem(item: CartItem): Promise<Cart> {
  if (!cache) {
    const fresh = (await del(`/api/v1/cart/${item.id}`)) as Cart;
    return setCart(fresh) as Cart;
  }
  const prev = cache;
  setCart({
    ...prev,
    items: prev.items.filter((i) => i.id !== item.id), // optimistic removal
  });
  try {
    const fresh = (await del(`/api/v1/cart/${item.id}`)) as Cart;
    return setCart(fresh) as Cart;
  } catch (e) {
    setCart(prev);
    throw e;
  }
}

/** Drop the cache (logout / user switch). */
export function clearCartCache() {
  setCart(null);
}
