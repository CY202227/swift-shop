import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Spin } from "antd";
import { get } from "./api";
import { clearTokens, loadTokens, saveTokens } from "./api";
import { AuthCtx } from "./auth";
import type { AdminUser } from "./types";
import AdminGuard from "./components/AdminGuard";
import AdminLayout from "./components/AdminLayout";
import RoleRoute from "./components/RoleRoute";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import ProductsPage from "./pages/ProductsPage";
import InvitesPage from "./pages/InvitesPage";
import UsersPage from "./pages/UsersPage";
import OrdersPage from "./pages/OrdersPage";
import PromotionsPage from "./pages/PromotionsPage";
import RevenuePage from "./pages/RevenuePage";

export default function App() {
  const [user, setUser] = useState<AdminUser | null | undefined>(undefined); // undefined = booting
  const navigate = useNavigate();
  const location = useLocation();

  // Session bootstrap: validate token + role once on load
  useEffect(() => {
    // Token handoff from the storefront SPA: the web app links here with
    // #handoff=<base64> when an admin clicks the backoffice entry. Consume
    // immediately and wipe the hash so tokens never linger in the address
    // bar or browser history.
    const consumeHandoff = () => {
      const m = location.hash.match(/#handoff=([^&]+)/);
      if (!m) return;
      try {
        // URL-safe base64 of JSON {"a": access, "r": refresh}
        const json = decodeURIComponent(escape(atob(m[1])));
        const parsed = JSON.parse(json);
        if (parsed.a && parsed.r) {
          saveTokens({ access: parsed.a, refresh: parsed.r });
        }
      } catch {
        // malformed payload — ignore, fall through to login page
      }
      navigate(location.pathname, { replace: true });
    };
    consumeHandoff();
    const { access } = loadTokens();
    if (!access) {
      setUser(null);
      return;
    }
    get("/api/v1/auth/me")
      .then((u) => setUser(u as AdminUser))
      .catch(() => {
        clearTokens();
        setUser(null);
      });
  }, []);

  const requireLogin = (el: React.ReactNode) => {
    if (user === undefined) return <Spin style={{ display: "block", margin: "120px auto" }} />;
    if (user === null) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    // Both admin tiers may enter; regular users are bounced at the door
    if (user.role !== "admin" && user.role !== "super_admin") {
      clearTokens();
      return <Navigate to="/login" replace />;
    }
    return (
      <AuthCtx.Provider value={{ user: user as AdminUser }}>
        {el}
      </AuthCtx.Provider>
    );
  };

  return (
    <Routes>
      <Route
        path="/login"
        element={
          user === undefined ? (
            <Spin style={{ display: "block", margin: "120px auto" }} />
          ) : user ? (
            <Navigate to="/" replace />
          ) : (
            <LoginPage onLogin={setUser} />
          )
        }
      />
      <Route
        path="/"
        element={requireLogin(
          <AdminGuard
            user={user}
            onLogout={() => {
              clearTokens();
              setUser(null);
              navigate("/login");
            }}
          >
            <AdminLayout
              user={user as object}
              onLogout={() => {
                const { refresh } = loadTokens();
                // Best-effort server-side revoke; local state cleared regardless
                fetch("/api/v1/auth/logout", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ refresh_token: refresh ?? "" }),
                }).catch(() => {});
                clearTokens();
                setUser(null);
                navigate("/login");
              }}
            />
          </AdminGuard>
        )}
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="products" element={<ProductsPage />} />
        {/* super-only pages are blocked at the route level so the page
            components (and their API calls) never mount for regular admins */}
        <Route
          path="promotions"
          element={
            <RoleRoute superOnly>
              <PromotionsPage />
            </RoleRoute>
          }
        />
        <Route
          path="invites"
          element={
            <RoleRoute superOnly>
              <InvitesPage />
            </RoleRoute>
          }
        />
        <Route path="users" element={<UsersPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route
          path="revenue"
          element={
            <RoleRoute superOnly>
              <RevenuePage />
            </RoleRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
