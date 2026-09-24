import { useContext, useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { post, ApiError } from "../api";
import { AuthContext, authFrom } from "../auth";
import { useI18n } from "../i18n";
import type { AuthOut } from "../types";

export default function VerifyPage() {
  const location = useLocation() as { state: { email?: string } | null };
  const [email, setEmail] = useState(location.state?.email ?? "");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const { setUser } = useContext(AuthContext);
  const { t } = useI18n();
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
      setErr(ex instanceof ApiError ? ex.detail : t("verify_failed"));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setErr("");
    setInfo("");
    try {
      await post("/api/v1/auth/resend-code", { email });
      setInfo(t("resend_sent"));
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.detail : t("load_failed"));
    }
  };

  return (
    <div className="auth-box">
      <h1>{t("verify_title")}</h1>
      <p className="auth-hint">{t("verify_hint")}</p>
      <form onSubmit={submit}>
        <label>
          {t("email")}
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          {t("verify_code")}
          <input
            required
            inputMode="numeric"
            pattern="[0-9]*"
            minLength={4}
            maxLength={8}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder={t("verify_code_hint")}
          />
        </label>
        {err && <div className="form-error">{err}</div>}
        {info && <div className="form-info">{info}</div>}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? t("verifying") : t("finish_register")}
        </button>
      </form>
      <p className="auth-switch">
        {t("not_received")}<button className="btn-link" onClick={resend}>{t("resend")}</button>
      </p>
    </div>
  );
}
