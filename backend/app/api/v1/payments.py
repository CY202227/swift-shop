"""Payment webhook endpoint + mock cashier page.

Webhook security (applies to real gateways identically):
- signature verified against raw body by the provider adapter
- (provider, event_id) unique index => duplicate deliveries are no-ops
- order marked paid exactly once; success not trusted from client state
"""
from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import HTMLResponse
from sqlalchemy import select, update

from app.core.deps import DbDep
from app.core.timeutil import utcnow
from app.models import Order, Payment
from app.payments import REGISTRY, get_provider

router = APIRouter(prefix="/payments", tags=["payments"])


@router.post("/webhook/{provider_name}")
async def payment_webhook(provider_name: str, request: Request, db: DbDep) -> dict:
    provider = get_provider(provider_name)
    raw = await request.body()
    headers = {k.lower(): v for k, v in request.headers.items()}
    result = await provider.handle_webhook(raw, headers)

    if not result.ok or not result.provider_trade_no:
        return {"received": True, "ignored": result.failure or "unrecognized event"}

    payment = await db.scalar(
        select(Payment).where(
            Payment.provider == provider.name,
            Payment.provider_trade_no == result.provider_trade_no,
        )
    )
    if payment is None:
        return {"received": True, "ignored": "unknown trade"}

    # Idempotency: first event_id wins; duplicates exit early
    if result.event_id and payment.provider_event_id and result.event_id != payment.provider_event_id:
        return {"received": True, "ignored": "stale event"}
    if payment.status == "succeeded":
        return {"received": True, "ignored": "already processed"}

    # Amount check: gateway-reported amount must equal the payable snapshot
    # stored at order time. A mismatch means tampered/partial payment —
    # never mark paid, keep the raw payload for investigation.
    if result.paid and result.amount_cents != payment.amount_cents:
        payment.raw_payload = json.loads(raw.decode("utf-8", errors="replace") or "{}")
        payment.status = "failed"
        payment.provider_event_id = result.event_id
        await db.flush()
        return {"received": True, "ignored": "amount mismatch, order stays unpaid"}

    payment.raw_payload = json.loads(raw.decode("utf-8", errors="replace") or "{}")
    payment.provider_event_id = result.event_id

    if result.paid:
        # Guarded transition: only pending orders may flip to paid (exactly once)
        res = await db.execute(
            update(Order)
            .where(
                Order.id == payment.order_id,
                Order.status == "pending_payment",
            )
            .values(status="paid", paid_at=utcnow())
        )
        if res.rowcount:
            payment.status = "succeeded"
            await db.execute(
                update(Payment).where(Payment.id == payment.id, Payment.provider_event_id.is_(None))
                .values(provider_event_id=result.event_id)
            )
    else:
        payment.status = "failed"
    return {"received": True}


@router.get("/mock/pay/{trade_no}", response_class=HTMLResponse, include_in_schema=False)
async def mock_cashier(trade_no: str, db: DbDep) -> HTMLResponse:
    """Fake cashier page for the mock provider; both pay and fail paths exist."""
    from app.payments.mock import trades_get
    trade = trades_get(trade_no)
    if trade is None:
        return HTMLResponse("<h3>Unknown mock trade</h3>", status_code=404)

    amount_yuan = trade["amount_cents"] / 100
    return HTMLResponse(f"""<!doctype html>
<html><head><meta charset="utf-8"><title>Mock Pay</title>
<style>body{{font-family:sans-serif;display:flex;justify-content:center;padding-top:80px;background:#f3f4f6}}
.card{{background:#fff;padding:32px 40px;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,.08);text-align:center}}
button{{font-size:16px;padding:10px 22px;margin:8px;border-radius:8px;border:0;cursor:pointer}}</style></head>
<body><div class="card">
<h2>Mock 收银台</h2>
<p>订单：{trade['order_no']}</p>
<p style="font-size:28px;font-weight:700">&yen;{amount_yuan:.2f}</p>
<button onclick="pay(true)" style="background:#16a34a;color:#fff">模拟支付成功</button>
<button onclick="pay(false)" style="background:#dc2626;color:#fff">模拟支付失败</button>
<p id="msg" style="color:#666"></p>
</div>
<script>
async function pay(paid) {{
  // Ask backend to build + sign the webhook body; client JS never sees the secret
  const prep = await fetch(`/api/v1/payments/mock/prepay/${"{trade_no}"}?paid=` + paid);
  if (!prep.ok) {{ document.getElementById("msg").textContent = "签名服务不可用"; return; }}
  const {{body, signature}} = await prep.json();
  const resp = await fetch("/api/v1/payments/webhook/mock", {{
    method: "POST", headers: {{"Content-Type": "application/json", "X-Mock-Signature": signature}},
    body: body
  }});
  const data = await resp.json();
  document.getElementById("msg").textContent = data.received ? (paid ? "支付成功，可关闭本页" : "支付失败/未支付") : "回调异常";
}}
</script></body></html>""")


@router.get("/mock/prepay/{trade_no}", include_in_schema=False)
async def mock_prepay(trade_no: str, paid: bool, request: Request) -> dict:
    """Dev-only handshake: backend builds and signs the webhook body for the
    cashier page, so no secret ever reaches client-side JS. Disabled in prod."""
    import hashlib
    import hmac as hmaclib
    import json as jsonlib
    import time as timelib

    from app.core.config import settings
    from app.payments.mock import trades_get

    if settings.ENV == "prod":
        raise HTTPException(404, "Not found")
    trade = trades_get(trade_no)
    if trade is None:
        raise HTTPException(404, "Unknown mock trade")

    body = jsonlib.dumps({
        "trade_no": trade_no,
        "paid": bool(paid),
        "amount_cents": trade["amount_cents"],
        "event_id": f"evt-{trade_no}-{int(timelib.time() * 1000)}",
    }, separators=(",", ":")).encode()
    sig = hmaclib.new(settings.webhook_secret.encode(), body, hashlib.sha256).hexdigest()
    return {"body": body.decode(), "signature": sig}
