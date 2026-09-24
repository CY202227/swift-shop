"""Mock payment provider: full local closed loop, zero external calls.

Flow: /api/v1/payments/mock/pay/{order_no} renders a fake cashier page;
clicking "pay" fires the webhook back into our own API. Webhook signature =
HMAC-SHA256(body, PAYMENT_WEBHOOK_SECRET) so the wire format is identical
to a real gateway and the security code path is actually exercised.
"""
from __future__ import annotations

import hashlib
import hmac
import secrets

from app.core.config import settings
from app.payments.base import PaymentResult, QueryResult, WebhookResult

# In-memory trade registry; dev/demo only. Real providers persist on their side.
Trades: dict[str, dict] = {}


def _sign(payload: bytes) -> str:
    return hmac.new(settings.webhook_secret.encode(), payload, hashlib.sha256).hexdigest()


class MockProvider:
    name = "mock"

    async def create_payment(self, order_no: str, amount_cents: int, subject: str) -> PaymentResult:
        trade_no = f"MOCK-{secrets.token_hex(8)}"
        Trades[trade_no] = {"order_no": order_no, "amount_cents": amount_cents, "paid": False}
        pay_url = f"{settings.BACKEND_PUBLIC_URL}/api/v1/payments/mock/pay/{trade_no}"
        return PaymentResult(ok=True, pay_url=pay_url, provider_trade_no=trade_no, message="mock cashier")

    async def handle_webhook(self, raw_body: bytes, headers: dict[str, str]) -> WebhookResult:
        # Body format: {"trade_no": "...", "paid": true, "event_id": "..."} + X-Mock-Signature
        import json
        try:
            payload = json.loads(raw_body)
        except Exception:
            return WebhookResult(ok=False, failure="invalid json")

        sign = headers.get("x-mock-signature", "")
        expected = _sign(raw_body)
        if not hmac.compare_digest(sign, expected):
            return WebhookResult(ok=False, failure="bad signature")

        trade_no = str(payload.get("trade_no", ""))
        trade = trades_get(trade_no)
        if trade is None:
            return WebhookResult(ok=False, failure="unknown trade")
        amount = int(payload.get("amount_cents") or trade["amount_cents"])

        paid = bool(payload.get("paid"))
        if paid:
            trade["paid"] = True
        return WebhookResult(
            ok=True,
            provider_trade_no=trade_no,
            paid=paid,
            amount_cents=amount,
            event_id=str(payload.get("event_id") or f"evt-{trade_no}"),
        )

    async def query_payment(self, provider_trade_no: str) -> QueryResult:
        trade = trades_get(provider_trade_no)
        if trade is None:
            return QueryResult(paid=False)
        return QueryResult(paid=bool(trade["paid"]), amount_cents=trade["amount_cents"])


def trades_get(trade_no: str) -> dict | None:
    return trades_dict().get(trade_no)


def trades_dict() -> dict[str, dict]:
    # lazy alias so the module-level name never shadows on reload
    return Trades


REGISTRY_NAME = "mock"
