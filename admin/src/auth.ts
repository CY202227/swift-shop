// Lightweight auth context for the admin SPA: App holds the session user and
// provides it via this context so pages can gate actions by role.
import { createContext, useContext } from "react";
import type { AdminUser } from "./types";

export const AuthCtx = createContext<{ user: AdminUser | null }>({ user: null });

export const useAuth = () => useContext(AuthCtx);
