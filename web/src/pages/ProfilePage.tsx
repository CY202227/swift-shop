import { useContext } from "react";
import { AuthContext } from "../auth";
import { useI18n } from "../i18n";
import { fmtTime } from "../format";

export default function ProfilePage() {
  const { user } = useContext(AuthContext);
  const { t } = useI18n();
  if (!user) return null;

  const roleText =
    user.role === "super_admin"
      ? t("role_super_admin")
      : user.role === "admin"
        ? t("role_admin")
        : t("role_user");

  return (
    <div className="auth-box wide">
      <h1>{t("profile_title")}</h1>
      <table className="table">
        <tbody>
          <tr>
            <th>{t("username")}</th>
            <td>{user.username}</td>
          </tr>
          <tr>
            <th>{t("email")}</th>
            <td>
              {user.email}
              {user.email_verified ? (
                <span className="badge paid">{t("email_verified")}</span>
              ) : (
                <span className="badge cancelled">{t("email_unverified")}</span>
              )}
            </td>
          </tr>
          <tr>
            <th>{t("role_label")}</th>
            <td>{roleText}</td>
          </tr>
          {(user.discount_percent ?? 0) > 0 && (
            <tr>
              <th>{t("member_discount")}</th>
              <td>{user.discount_percent}%</td>
            </tr>
          )}
          <tr>
            <th>{t("registered_at")}</th>
            <td>{fmtTime(user.created_at)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
