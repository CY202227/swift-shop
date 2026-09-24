"""Admin dashboard: headline stats + recent activity."""
from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import func, select

from app.core.deps import AdminUser, DbDep
from app.models import Order, Product, User
from app.schemas import DashboardOut
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/admin", tags=["admin-dashboard"])


async def _count(db: AsyncSession, stmt) -> int:
    return (await db.scalar(stmt)) or 0


@router.get("/dashboard", response_model=DashboardOut, tags=["admin-dashboard"])
async def dashboard(db: DbDep, admin: AdminUser) -> DashboardOut:
    users_total = await _count(db, select(func.count()).select_from(User))
    products_total = await _count(db, select(func.count()).select_from(Product))
    products_active = await _count(db, select(func.count()).select_from(Product).where(Product.status == "active"))
    orders_total = await _count(db, select(func.count()).select_from(Order))
    orders_paid = await _count(db, select(func.count()).select_from(Order).where(Order.status == "paid"))
    revenue = await _count(
        db,
        select(func.coalesce(func.sum(Order.total_cents), 0)).where(Order.status == "paid"),
    )
    pending_payment = await _count(
        db, select(func.count()).select_from(Order).where(Order.status == "pending_payment")
    )
    return DashboardOut(
        users_total=users_total, products_total=products_total, products_active=products_active,
        orders_total=orders_total, orders_paid=orders_paid,
        revenue_cents=int(revenue), pending_payment=pending_payment,
    )
