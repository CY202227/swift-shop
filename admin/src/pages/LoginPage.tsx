import { useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Alert, Button, Card, Form, Input, Typography } from "antd";
import { post, saveTokens } from "../api";
import type { AuthOut, AdminUser } from "../types";

export default function LoginPage({ onLogin }: { onLogin: (u: AdminUser) => void }) {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const location = useLocation() as { state: { from?: string } | null };

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
        setErr("该账号不是管理员，无法登录后台");
        return;
      }
      saveTokens({ access: out.access_token, refresh: out.refresh_token });
      onLogin(out.user);
      navigate(location.state?.from ?? "/dashboard", { replace: true });
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "登录失败");
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
      <Card title={<Typography.Title level={4} style={{ margin: 0 }}>管理后台登录</Typography.Title>} style={{ width: 360 }}>
        {err && <Alert type="error" message={err} showIcon style={{ marginBottom: 16 }} />}
        <Form layout="vertical" onSubmitCapture={submit}>
          <Form.Item label="邮箱" name="email" rules={[{ required: true, message: "请输入邮箱" }]}>
            <Input name="email" type="email" placeholder="admin@example.com" />
          </Form.Item>
          <Form.Item label="密码" name="password" rules={[{ required: true, message: "请输入密码" }]}>
            <Input.Password name="password" placeholder="至少 8 位" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={busy}>
            登录
          </Button>
        </Form>
      </Card>
    </div>
  );
}
