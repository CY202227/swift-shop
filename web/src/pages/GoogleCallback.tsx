import { useContext, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { post, ApiError } from "../api";
import { AuthContext, authFrom } from "../auth";
import { useI18n } from "../i18n";
import type { AuthOut } from "../types";

export default function GoogleCallback() {
  const [err, setErr] = useState("");
  const [params] = useSearchParams();
  const { setUser } = useContext(AuthContext);
  const { t } = useI18n();
  const navigate = useNavigate();
  const done = useRef(false); // React 18 double-effect guard

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const code = params.get("code");
    const oauthErr = params.get("error");
    if (oauthErr) {
      setErr(oauthErr === "access_denied" ? t("google_failed") : oauthErr);
      return;
    }
    if (!code) {
      setErr(t("google_failed"));
      return;
    }
    // exchange authorization code for a session via backend
    post("/api/v1/auth/google", { code })
      .then((out) => {
        setUser(authFrom(out as AuthOut));
        navigate("/", { replace: true });
      })
      .catch((e) =>
        setErr(e instanceof ApiError ? e.detail : t("google_failed"))
      );
  }, []);

  return (
    <div className="auth-box">
      <h1>{t("google_redirecting")}</h1>
      {err ? <div className="form-error">{err}</div> : <div className="auth-hint">{t("loading")}</div>}
    </div>
  );
}
