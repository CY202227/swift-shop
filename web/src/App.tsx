import { useCallback, useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { AuthContext, clearTokens, loadTokens } from "./auth";
import { get } from "./api";
import type { User } from "./types";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import ProductDetail from "./pages/ProductDetail";
import CartPage from "./pages/CartPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import VerifyPage from "./pages/VerifyPage";
import OrdersPage from "./pages/OrdersPage";
import ProfilePage from "./pages/ProfilePage";
import NotFound from "./pages/NotFound";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);
  const navigate = useNavigate();

  // Restore session on load if a token exists
  useEffect(() => {
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
    clearTokens();
    setUser(null);
    navigate("/");
  }, [navigate]);

  if (booting) {
    return <div className="boot">加载中…</div>;
  }

  return (
    <AuthContext.Provider value={{ user, setUser }}>
      <div className="app-shell">
        <Navbar user={user} onLogout={logout} />
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
          Swift Shop · FastAPI + React · 演示项目
        </footer>
      </div>
    </AuthContext.Provider>
  );
}
