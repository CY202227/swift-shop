import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Result, Spin } from "antd";
import type { AdminUser } from "../types";

// Blocks non-admin users even if they hold a valid token
export default function AdminGuard({
  user,
  onLogout,
  children,
}: {
  user: object | null | undefined;
  onLogout: () => void;
  children: ReactNode;
}) {
  if (user === undefined) return <Spin style={{ display: "block", margin: "120px auto" }} />;
  if (user === null) return <Navigate to="/login" replace />;
  const u = user as AdminUser;
  if (u.role !== "admin") {
    return (
      <Result
        status="403"
        title="403"
        subTitle="抱歉，您没有权限访问管理后台。"
      />
    );
  }
  return <>{children}</>;
}
