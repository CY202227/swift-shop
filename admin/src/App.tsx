import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Spin } from "antd";
import { get } from "./api";
import { clearTokens, loadTokens } from "./api";
import AdminGuard from "./components/AdminGuard";
import AdminLayout from "./components/AdminLayout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import ProductsPage from "./pages/ProductsPage";
import InvitesPage from "./pages/InvitesPage";
import UsersPage from "./pages/UsersPage";
import OrdersPage from "./pages/OrdersPage";

export default function App() {
  const [user, setUser] = useState<object | null | undefined>(undefined); // undefined = booting
  const navigate = useNavigate();
  const location = useLocation();

  // Session bootstrap: validate token + role once on load
  useEffect(() => {
    const { access } = loadTokens();
    if (!access) {
      setUser(null);
      return;
    }
    get("/api/v1/auth/me")
      .then((u) => setUser(u as object))
      .catch(() => {
        clearTokens();
        setUser(null);
      });
  }, []);

  const requireLogin = (el: React.ReactNode) => {
    if (user === undefined) return <Spin style={{ display: "block", margin: "120px auto" }} />;
    if (user === null) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    return el;
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
        <Route path="invites" element={<InvitesPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="orders" element={<OrdersPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
