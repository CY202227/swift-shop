"""Payment provider abstraction.

Business code (orders, webhooks) only ever sees PaymentProvider. Adding a real
gateway later = one new file + PAYMENT_PROVIDER=<name> in .env. Nothing else changes.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol

from fastapi import HTTPException


@dataclass
class PaymentResult:
    ok: bool
    pay_url: str | None = None          # redirect / QR URL for the buyer
    provider_trade_no: str | None = None
    message: str = ""


@dataclass
class WebhookResult:
    ok: bool                        # signature valid & event recognized
    provider_trade_no: str | None = None
    paid: bool = False              # True => mark order paid
    amount_cents: int | None = None
    event_id: str | None = None     # for idempotency
    failure: str = ""


@dataclass
class QueryResult:
    paid: bool
    amount_cents: int | None = None


class PaymentProvider(Protocol):
    name: str = "abstract"

    async def create_payment(self, order_no: str, amount_cents: int, subject: str) -> PaymentResult:
        """Create a payment on the gateway; return buyer-facing URL."""
        ...

    async def handle_webhook(self, raw_body: bytes, headers: dict[str, str]) -> WebhookResult:
        """Verify gateway signature; translate event into internal semantics."""
        ...

    async def query_payment(self, provider_trade_no: str) -> QueryResult:
        """Active status query (reconciliation fallback when webhooks are missed)."""
        ...


def get_provider(name: str) -> PaymentProvider:
    """Factory; registry lives in app.payments.__init__."""
    from app.payments import REGISTRY
    provider = REGISTRY.get(name)
    if provider is None:
        raise HTTPException(400, f"Unsupported payment provider: {name}")
    return provider
