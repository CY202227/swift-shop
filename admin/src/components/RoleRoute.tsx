import type { ReactNode } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Button, Result } from "antd";
import { useAdminI18n } from "../i18n";
import { useAuth } from "../auth";

/**
 * Route-level role guard. Unlike a menu filter (which only hides links),
 * this blocks the *element* from mounting when a regular admin opens a
 * super-only URL directly — the page component never renders, so its data
 * requests never fire (no wasted 403s, no error-banner flash).
 *
 * The backend still enforces the real permission split; this is UX so a
 * mis-guessed URL dies politely instead of half-loading.
 */
export default function RoleRoute({
  superOnly,
  children,
}: {
  superOnly: boolean;
  children: ReactNode;
}) {
  const { user } = useAuth();
  const { t } = useAdminI18n();
  const navigate = useNavigate();

  if (!superOnly || user?.role === "super_admin") return <>{children}</>;

  return (
    <Result
      status="403"
      title="403"
      subTitle={t("guard_super_only")}
      extra={
        <Button type="primary" onClick={() => navigate("/dashboard")}>
          {t("guard_back_dashboard")}
        </Button>
      }
    />
  );
}
