import { useContext, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { post, ApiError } from "../api";
import { AuthContext, authFrom } from "../auth";
import { useI18n } from "../i18n";
import type { AuthOut } from "../types";

// Google OAuth authorize URL (code flow). Backend GOOGLE_CLIENT_ID drives
// the real client id; empty means the button explains it's not configured.
const GOOGLE_AUTH_URL =
  "https://accounts.google.com/o/oauth2/v2/auth?response_type=code&scope=openid%20email%20profile&access_type=offline";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const { setUser } = useContext(AuthContext);
  const { t } = useI18n();
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
      setErr(ex instanceof ApiError ? ex.detail : t("login_failed_retry"));
    } finally {
      setBusy(false);
    }
  };

  const googleLogin = () => {
    // discover client id from backend public settings at click time
    fetch("/api/v1/public/google-client-id")
      .then((r) => (r.ok ? r.json() : { client_id: "" }))
      .then(({ client_id }) => {
        if (!client_id) {
          setErr(t("google_oauth_hint"));
          return;
        }
        const redirect = `${window.location.origin}/oauth/google/callback`;
        window.location.href = `${GOOGLE_AUTH_URL}&client_id=${encodeURIComponent(client_id)}&redirect_uri=${encodeURIComponent(redirect)}`;
      })
      .catch(() => setErr(t("google_failed")));
  };

  return (
    <div className="auth-box">
      <h1>{t("login")}</h1>
      <form onSubmit={submit}>
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
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("password_hint")}
          />
        </label>
        {err && <div className="form-error">{err}</div>}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? t("logging_in") : t("login")}
        </button>
      </form>
      <div className="auth-divider"><span>or</span></div>
      <button className="btn btn-google btn-block" onClick={googleLogin}>
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34 6 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.2-.1-2.3-.4-3.5z"/>
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34 6 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.6 39.6 16.2 44 24 44z"/>
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C41 35.6 44 30.3 44 24c0-1.2-.1-2.3-.4-3.5z"/>
        </svg>
        {t("google_login")}
      </button>
      <p className="auth-switch">
        {t("no_account")}<Link to="/register">{t("go_register")}</Link>
      </p>
    </div>
  );
}
