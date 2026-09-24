"""Admin: revenue analytics — super_admin only.

预计收入 (expected revenue) = paid orders realized + pending_payment orders
expected to convert. Also exposes a 30-day daily realized-revenue series for
the curve chart on the admin dashboard.
"""
from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import DbDep, SuperAdminUser
from app.core.timeutil import utcnow
from app.models import Order
from app.schemas import RevenueOut, RevenuePoint

router = APIRouter(prefix="/admin/stats", tags=["admin-stats"])


@router.get("/revenue", response_model=RevenueOut)
async def revenue(db: DbDep, sup: SuperAdminUser) -> RevenueOut:
    # realized: fully paid orders
    realized = (
        await db.scalar(
            select(func.coalesce(func.sum(Order.total_cents), 0)).where(Order.status == "paid")
        )
        or 0
    )
    # expected-but-not-yet-cashed: orders awaiting payment
    pending = (
        await db.scalar(
            select(func.coalesce(func.sum(Order.total_cents), 0)).where(Order.status == "pending_payment")
        )
        or 0
    )

    # 30-day daily series of realized revenue for the curve chart
    since = utcnow() - timedelta(days=30)
    rows = (
        await db.execute(
            select(
                func.strftime("%Y-%m-%d", Order.paid_at),
                func.sum(Order.total_cents),
            )
            .where(Order.status == "paid", Order.paid_at >= since)
            .group_by(func.strftime("%Y-%m-%d", Order.paid_at))
            .order_by(func.strftime("%Y-%m-%d", Order.paid_at))
        )
    ).all()

    series = [RevenuePoint(date=d, revenue_cents=int(c or 0)) for d, c in rows]
    return RevenueOut(
        realized_cents=int(realized),
        expected_cents=int(pending),
        series=series,
    )
