import { Link } from "react-router-dom";
import { useI18n } from "../i18n";
import type { PromotionBrief, User } from "../types";

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
