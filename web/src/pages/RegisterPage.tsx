import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { post, ApiError } from "../api";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        email,
        password,
        username,
      };
      // invite code optional; backend enforces requirement when the switch is on
      if (inviteCode.trim()) body.invite_code = inviteCode.trim();
      await post("/api/v1/auth/register", body);
      // Backend sends a 6-digit code to SMTP/mailpit; dev also prints it in server log
      navigate("/verify", { state: { email } });
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.detail : "注册失败，请稍后重试");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-box">
      <h1>注册</h1>
      <form onSubmit={submit}>
        <label>
          用户名
          <input
            required
            minLength={2}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="2-64 字符"
          />
        </label>
        <label>
          邮箱
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </label>
        <label>
          密码
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="至少 8 位"
          />
        </label>
        <label>
          邀请码（可选）
          <input
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder="如果管理员开启了邀请注册"
          />
        </label>
        {err && <div className="form-error">{err}</div>}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? "发送验证码…" : "注册"}
        </button>
      </form>
      <p className="auth-switch">
        已有账号？<Link to="/login">去登录</Link>
      </p>
    </div>
  );
}
