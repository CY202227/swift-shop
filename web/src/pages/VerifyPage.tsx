import { useContext, useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { post, ApiError } from "../api";
import { AuthContext, authFrom } from "../auth";
import type { AuthOut } from "../types";

export default function VerifyPage() {
  const location = useLocation() as { state: { email?: string } | null };
  const [email, setEmail] = useState(location.state?.email ?? "");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const { setUser } = useContext(AuthContext);
  const navigate = useNavigate();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const out = (await post("/api/v1/auth/verify-email", { email, code })) as AuthOut;
      setUser(authFrom(out));
      navigate("/");
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.detail : "验证失败");
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setErr("");
    setInfo("");
    try {
      await post("/api/v1/auth/resend-code", { email });
      setInfo("如该邮箱有待验证注册，验证码已重新发送（60 秒冷却）");
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.detail : "发送失败");
    }
  };

  return (
    <div className="auth-box">
      <h1>邮箱验证</h1>
      <p className="auth-hint">验证码已发送到你的邮箱（开发环境可在 Mailpit 或后端日志查看）</p>
      <form onSubmit={submit}>
        <label>
          邮箱
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          验证码
          <input
            required
            inputMode="numeric"
            pattern="[0-9]*"
            minLength={4}
            maxLength={8}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="6 位数字"
          />
        </label>
        {err && <div className="form-error">{err}</div>}
        {info && <div className="form-info">{info}</div>}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? "验证中…" : "完成注册"}
        </button>
      </form>
      <p className="auth-switch">
        没收到？<button className="btn-link" onClick={resend}>重新发送</button>
      </p>
    </div>
  );
}
