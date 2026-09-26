// Tiny UI store for the cart drawer.
//
// Why: drawerOpen used to live in App state, so every open/close re-rendered
// the ENTIRE route tree (48-product grid etc.) on the main thread — exactly
// when the slide animation needed those frames. With this module store only
// the drawer (and its backdrop) re-render; App and pages never do.
import { useSyncExternalStore } from "react";
import { loadCart } from "./cartStore";

let drawerOpen = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function openDrawer() {
  void loadCart(); // warm the cart cache while the drawer slides in
  if (drawerOpen) return;
  drawerOpen = true;
  emit();
}

export function closeDrawer() {
  if (!drawerOpen) return;
  drawerOpen = false;
  emit();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Reactive drawer open flag — only the subscribing component re-renders. */
export function useDrawerOpen(): boolean {
  return useSyncExternalStore(subscribe, () => drawerOpen, () => false);
}
