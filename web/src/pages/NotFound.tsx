import { Link } from "react-router-dom";
import { useI18n } from "../i18n";

export default function NotFound() {
  const { t } = useI18n();
  return (
    <div className="empty">
      <h1>404</h1>
      <p>{t("not_found_text")}</p>
      <Link to="/" className="btn">
        {t("back_home")}
      </Link>
    </div>
  );
}
