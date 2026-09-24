"""Plain-text SMTP mailer. Dev target: mailpit (localhost:1025); prod: real provider."""
from __future__ import annotations

import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings


def _send(to_email: str, subject: str, html: str) -> None:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{settings.MAIL_FROM_NAME} <{settings.MAIL_FROM}>"
    msg["To"] = to_email
    msg.attach(MIMEText(html, "html", "utf-8"))

    # Synchronous send; at this traffic level (<1 mail/sec) blocking is fine.
    # If it ever becomes a bottleneck, switch to aiosmtplib or a background task.
    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as smtp:
        if settings.SMTP_USER:
            smtp.starttls()
            smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        smtp.sendmail(settings.MAIL_FROM, [to_email], msg.as_string())


def send_verification_code(to_email: str, code: str) -> None:
    html = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2>Shop 注册验证码</h2>
      <p>你的验证码是：</p>
      <p style="font-size:32px;font-weight:700;letter-spacing:8px">{code}</p>
      <p style="color:#888">10 分钟内有效。如非本人操作请忽略本邮件。</p>
    </div>
    """
    try:
        _send(to_email, "【Shop】邮箱验证码", html)
    except Exception:
        # Swallow SMTP errors in dev (mailpit may be down); codes still work via logs
        import logging
        logging.getLogger("shop.mail").warning("SMTP send failed for %s (dev: check mailpit)", to_email, exc_info=True)
        print(f"[mail:dev] verification code for {to_email}: {code}")
