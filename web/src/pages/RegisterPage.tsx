import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { post, ApiError } from "../api";
import { useI18n } from "../i18n";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const { t } = useI18n();
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
      setErr(ex instanceof ApiError ? ex.detail : t("register_failed_retry"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-box">
      <h1>{t("register")}</h1>
      <form onSubmit={submit}>
        <label>
          {t("username")}
          <input
            required
            minLength={2}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={t("username_hint")}
          />
        </label>
        <label>
          {t("email")}
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </label>
        <label>
          {t("password")}
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("password_hint")}
          />
        </label>
        <label>
          {t("invite_optional")}
          <input
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder={t("invite_placeholder")}
          />
        </label>
        {err && <div className="form-error">{err}</div>}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? t("sending_code") : t("register")}
        </button>
      </form>
      <p className="auth-switch">
        {t("has_account")}<Link to="/login">{t("go_login")}</Link>
      </p>
    </div>
  );
}
