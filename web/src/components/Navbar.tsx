import { Link } from "react-router-dom";
import type { User } from "../types";

export default function Navbar({ user, onLogout }: { user: User | null; onLogout: () => void }) {
  return (
    <header className="navbar">
      <div className="container nav-inner">
        <Link to="/" className="brand">
          🛒 Swift Shop
        </Link>
        <nav className="nav-links">
          <Link to="/">商品</Link>
          {user ? (
            <>
              <Link to="/cart">购物车</Link>
              <Link to="/orders">我的订单</Link>
              <Link to="/profile" className="nav-user">
                {user.username}
              </Link>
              <button className="btn-link" onClick={onLogout}>
                退出
              </button>
            </>
          ) : (
            <>
              <Link to="/login">登录</Link>
              <Link to="/register">注册</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
