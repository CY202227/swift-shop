// Auth session store: tokens in localStorage, user in React state.
import { createContext } from "react";
import type { AuthOut, User } from "./types";

const ACCESS_KEY = "shop_access";
const REFRESH_KEY = "shop_refresh";

export function loadTokens(): { access: string | null; refresh: string | null } {
  return {
    access: localStorage.getItem(ACCESS_KEY),
    refresh: localStorage.getItem(REFRESH_KEY),
  };
}

export function saveTokens(t: { access: string; refresh: string }) {
  localStorage.setItem(ACCESS_KEY, t.access);
  localStorage.setItem(REFRESH_KEY, t.refresh);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

// Lightweight event so components re-render on login/logout
export interface AuthState {
  user: User | null;
  setUser: (u: User | null) => void;
}

export const AuthContext = createContext<AuthState>({
  user: null,
  setUser: () => {},
});

export function authFrom(resp: AuthOut) {
  saveTokens({ access: resp.access_token, refresh: resp.refresh_token });
  return resp.user;
}
