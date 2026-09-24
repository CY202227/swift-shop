"""Pricing engine: single source of truth for discount arithmetic.

Discount stacking order (server-side, client never sends totals):
    line = price * (1 - product%)           # per-product discount column
    line = line * (1 - promotion%)          # active percent_off campaign
    buy_n_get_1: for every (n+1) units of a line, 1 unit is free (uses ceil math)
    order.subtotal = sum(lines)
    order.discount_cents = subtotal * user% # personal discount granted by admin
    order.total = subtotal - discount_cents
"""
from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Promotion, Product, User


async def get_active_promotion(db: AsyncSession) -> Promotion | None:
    """Return the single active promotion (percent_off or buy_n_get_1), if any."""
    from sqlalchemy import select
    from app.core.timeutil import naive_as_utc, utcnow

    promos = (
        await db.scalars(
            select(Promotion)
            .where(Promotion.status == "active")
            .order_by(Promotion.id.desc())
            .limit(1)
        )
    ).all()
    now = utcnow()
    for p in promos:
        # SQLite returns naive datetimes — normalize before comparing with utcnow()
        if p.starts_at and naive_as_utc(p.starts_at) > now:
            continue
        if p.ends_at and naive_as_utc(p.ends_at) < now:
            continue
        return p
    return None


def compute_unit_price(product: Product, promotion: Promotion | None) -> int:
    """Unit price after product % and promotion % (before buy-N-get-1 math)."""
    price = product.price_cents
    if product.discount_percent:
        price = price * (100 - product.discount_percent) // 100
    if promotion is not None and promotion.kind == "percent_off" and promotion.value:
        price = price * (100 - promotion.value) // 100
    return max(1, price)


def compute_line_total(unit_price: int, qty: int, promotion: Promotion | None) -> int:
    """Line total; buy_n_get_1 makes every (n+1)-th unit free via integer math."""
    if promotion is not None and promotion.kind == "buy_n_get_1" and promotion.value >= 1:
        n = promotion.value  # buy N get 1: every group of (N+1) charges only N
        free = qty // (n + 1)
        chargeable = qty - free
        return unit_price * chargeable
    return unit_price * qty


def apply_user_discount(subtotal: int, user: User) -> int:
    """Order-level personal discount (cents). 0 if user has none."""
    if user.discount_percent:
        return subtotal * user.discount_percent // 100
    return 0
