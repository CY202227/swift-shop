import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Result, Spin } from "antd";
import { useAdminI18n } from "../i18n";
import type { AdminUser } from "../types";

// Blocks non-admin users even if they hold a valid token.
// Both admin and super_admin pass; page-level menus split further by role.
export default function AdminGuard({
  user,
  onLogout,
  children,
}: {
  user: object | null | undefined;
  onLogout: () => void;
  children: ReactNode;
}) {
  const { t } = useAdminI18n();
  if (user === undefined) return <Spin style={{ display: "block", margin: "120px auto" }} />;
  if (user === null) return <Navigate to="/login" replace />;
  const u = user as AdminUser;
  if (u.role !== "admin" && u.role !== "super_admin") {
    return (
      <Result
        status="403"
        title="403"
        subTitle={t("guard_no_permission")}
      />
    );
  }
  return <>{children}</>;
}
