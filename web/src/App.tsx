import { useCallback, useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { AuthContext, clearTokens, loadTokens, saveTokens } from "./auth";
import { get } from "./api";
import { clearCartCache } from "./cartStore";
import { openDrawer } from "./uiStore";
import { I18nContext, detectLang, saveLang, translate, type Lang } from "./i18n";
import type { ShopSettings, User } from "./types";
import Navbar from "./components/Navbar";
import CartDrawer from "./components/CartDrawer";
import Home from "./pages/Home";
import ProductDetail from "./pages/ProductDetail";
import CartPage from "./pages/CartPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import VerifyPage from "./pages/VerifyPage";
import OrdersPage from "./pages/OrdersPage";
import ProfilePage from "./pages/ProfilePage";
import GoogleCallback from "./pages/GoogleCallback";
import NotFound from "./pages/NotFound";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);
  const [lang, setLangState] = useState<Lang>(() => detectLang());
  const [shop, setShop] = useState<ShopSettings | null>(null);
  const navigate = useNavigate();

  // Restore session on load if a token exists
  useEffect(() => {
    // Reverse token handoff from the admin SPA: "Visit Store" links here
    // with #handoff=<base64>. Consume immediately, save into our own
    // localStorage, then replace the URL so tokens never linger in the
    // address bar or browser history.
    const consumeHandoff = () => {
      const m = location.hash.match(/#handoff=([^&]+)/);
      if (!m) return false;
      try {
        // URL-safe base64 of JSON {"a": access, "r": refresh}
        const json = decodeURIComponent(escape(atob(m[1])));
        const parsed = JSON.parse(json);
        if (parsed.a && parsed.r) {
          saveTokens({ access: parsed.a, refresh: parsed.r });
        }
      } catch {
        // malformed payload — ignore, fall through to anonymous browsing
      }
      navigate(location.pathname, { replace: true });
      return true;
    };
    const consumed = consumeHandoff();
    const { access } = loadTokens();
    if (!access) {
      setBooting(false);
      return;
    }
    get("/api/v1/auth/me")
      .then((u) => setUser(u as User))
      .catch(() => {
        clearTokens();
        setUser(null);
      })
      .finally(() => setBooting(false));
  }, []);

  // Shop name + active promotion shown anywhere (public, no auth)
  useEffect(() => {
    get("/api/v1/public/settings")
      .then((d) => setShop(d as ShopSettings))
      .catch(() => setShop(null));
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    saveLang(l);
    document.documentElement.lang = l;
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => translate(lang, key, params),
    [lang]
  );

  // open the cart drawer from anywhere (add-to-cart, navbar badge, ...).
  // The state lives in uiStore: toggling re-renders ONLY the drawer, never
  // the App tree — protects the slide animation's frames on busy pages
  // (48-product grid etc.). loadCart is warmed inside openDrawer().
  const openCart = useCallback(() => openDrawer(), []);

  const logout = useCallback(async () => {
    const { refresh } = loadTokens();
    try {
      // backend revokes the refresh token family
      await fetch("/api/v1/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refresh ?? "" }),
      });
    } catch {
      // network failure shouldn't block local logout
    }
    clearCartCache(); // don't leak one user's cart into the next session
    clearTokens();
    setUser(null);
    navigate("/");
  }, [navigate]);

  if (booting) {
    return <div className="boot">{t("loading")}</div>;
  }

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      <AuthContext.Provider value={{ user, setUser, openCart }}>
        <div className="app-shell">
          <Navbar user={user} onLogout={logout} shopName={shop?.shop_name} promotion={shop?.promotion ?? null} onOpenCart={openCart} />
          <main className="container">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/product/:slug" element={<ProductDetail />} />
              <Route
                path="/cart"
                element={user ? <CartPage /> : <Navigate to="/login" replace />}
              />
              <Route
                path="/login"
                element={user ? <Navigate to="/" replace /> : <LoginPage />}
              />
              <Route
                path="/register"
                element={user ? <Navigate to="/" replace /> : <RegisterPage />}
              />
              <Route path="/verify" element={<VerifyPage />} />
              <Route path="/oauth/google/callback" element={<GoogleCallback />} />
              <Route
                path="/orders"
                element={user ? <OrdersPage /> : <Navigate to="/login" replace />}
              />
              <Route
                path="/profile"
                element={user ? <ProfilePage /> : <Navigate to="/login" replace />}
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
          <footer className="footer">
            {shop?.shop_name ?? "PTCG Shop"} · FastAPI + React · {t("footer_text")}
          </footer>
          {/* global cart drawer: slide-over from the right (self-managed state) */}
          <CartDrawer />
        </div>
      </AuthContext.Provider>
    </I18nContext.Provider>
  );
}
