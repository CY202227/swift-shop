"""Payment provider registry. Add real gateways here as single files."""
from __future__ import annotations

from app.payments.base import PaymentProvider, PaymentResult, QueryResult, WebhookResult, get_provider
from app.payments.mock import MockProvider

REGISTRY: dict[str, PaymentProvider] = {
    "mock": MockProvider(),
    # "stripe": StripeProvider(),      # future: app/payments/stripe.py
    # "alipay": AlipayProvider(),     # future: app/payments/alipay.py
    # "wechat": WechatProvider(),     # future: app/payments/wechat.py
}

__all__ = ["REGISTRY", "PaymentProvider", "PaymentResult", "WebhookResult", "QueryResult", "get_provider"]
