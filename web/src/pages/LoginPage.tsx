import { useContext, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { post, ApiError } from "../api";
import { AuthContext, authFrom } from "../auth";
import type { AuthOut } from "../types";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const { setUser } = useContext(AuthContext);
  const navigate = useNavigate();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const out = (await post("/api/v1/auth/login", { email, password })) as AuthOut;
      setUser(authFrom(out));
      navigate("/");
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.detail : "登录失败，请稍后重试");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-box">
      <h1>登录</h1>
      <form onSubmit={submit}>
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
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="至少 8 位"
          />
        </label>
        {err && <div className="form-error">{err}</div>}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? "登录中…" : "登录"}
        </button>
      </form>
      <p className="auth-switch">
        还没有账号？<Link to="/register">去注册</Link>
      </p>
    </div>
  );
}
