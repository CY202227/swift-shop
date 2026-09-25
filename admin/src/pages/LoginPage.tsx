import { useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Alert, Button, Card, Form, Input, Typography } from "antd";
import { post, saveTokens } from "../api";
import { useAdminI18n } from "../i18n";
import type { AuthOut, AdminUser } from "../types";

export default function LoginPage({ onLogin }: { onLogin: (u: AdminUser) => void }) {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const location = useLocation() as { state: { from?: string } | null };
  const { t, lang, setLang } = useAdminI18n();

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setErr("");
    setBusy(true);
    try {
      const out = await post<AuthOut>("/api/v1/auth/login", {
        email: String(fd.get("email")),
        password: String(fd.get("password")),
      });
      if (out.user.role !== "admin" && out.user.role !== "super_admin") {
        setErr(t("login_not_admin"));
        return;
      }
      saveTokens({ access: out.access_token, refresh: out.refresh_token });
      onLogin(out.user);
      navigate(location.state?.from ?? "/dashboard", { replace: true });
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : t("login_failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f0f2f5",
      }}
    >
      <Card title={<Typography.Title level={4} style={{ margin: 0 }}>{t("login_title")}</Typography.Title>} style={{ width: 360 }}>
        {/* language toggle available even before signing in */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <Button size="small" onClick={() => setLang(lang === "zh" ? "en" : "zh")}>
            {lang === "zh" ? "EN" : "中文"}
          </Button>
        </div>
        {err && <Alert type="error" message={err} showIcon style={{ marginBottom: 16 }} />}
        <Form layout="vertical" onSubmitCapture={submit}>
          <Form.Item label={t("login_email")} name="email" rules={[{ required: true, message: t("login_email_required") }]}>
            <Input name="email" type="email" placeholder="admin@example.com" />
          </Form.Item>
          <Form.Item label={t("login_password")} name="password" rules={[{ required: true, message: t("login_pwd_required") }]}>
            <Input.Password name="password" placeholder={t("login_pwd_hint")} />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={busy}>
            {t("login_submit")}
          </Button>
        </Form>
      </Card>
    </div>
  );
}
