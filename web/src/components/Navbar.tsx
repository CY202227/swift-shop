import { Link } from "react-router-dom";
import { useI18n } from "../i18n";
import type { PromotionBrief, User } from "../types";

// Admin backoffice runs on a separate SPA/dev server (5174 in dev);
// override via env for other deployments, e.g. VITE_ADMIN_URL=https://...
const ADMIN_URL =
  (import.meta as any).env?.VITE_ADMIN_URL ?? "http://127.0.0.1:5174";

export default function Navbar({
  user,
  onLogout,
  shopName,
  promotion,
}: {
  user: User | null;
  onLogout: () => void;
  shopName?: string;
  promotion?: PromotionBrief | null;
}) {
  const { lang, setLang, t } = useI18n();

  return (
    <header className="navbar">
      {promotion && (
        <div className="promo-banner">
          🎉 {promotion.name}
          {" — "}
          {promotion.kind === "percent_off"
            ? t("promo_percent", { p: promotion.value })
            : t("promo_bng1", { n: promotion.value })}
        </div>
      )}
      <div className="container nav-inner">
        <Link to="/" className="brand">
          🃏 {shopName ?? "PTCG Shop"}
        </Link>
        <nav className="nav-links">
          <Link to="/">{t("nav_products")}</Link>
          {user ? (
            <>
              <Link to="/cart">{t("nav_cart")}</Link>
              <Link to="/orders">{t("nav_orders")}</Link>
              {user.role === "admin" || user.role === "super_admin" ? (
                <a
                  href={ADMIN_URL}
                  className="nav-admin-link"
                  title={t("nav_admin_hint")}
                >
                  {t("nav_admin")}
                </a>
              ) : null}
              <Link to="/profile" className="nav-user">
                {user.username}
              </Link>
              <button
                className="btn-link"
                onClick={() => setLang(lang === "zh" ? "en" : "zh")}
                title={lang === "zh" ? "Switch to English" : "切换到中文"}
              >
                {lang === "zh" ? "EN" : "中文"}
              </button>
              <button className="btn-link" onClick={onLogout}>
                {t("nav_logout")}
              </button>
            </>
          ) : (
            <>
              <button
                className="btn-link"
                onClick={() => setLang(lang === "zh" ? "en" : "zh")}
                title={lang === "zh" ? "Switch to English" : "切换到中文"}
              >
                {lang === "zh" ? "EN" : "中文"}
              </button>
              <Link to="/login">{t("nav_login")}</Link>
              <Link to="/register">{t("nav_register")}</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
