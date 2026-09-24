"""Admin: order list / detail / CSV export (audit-logged)."""
from __future__ import annotations

import csv
import io
from datetime import datetime, timezone

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import AdminUser, DbDep
from app.models import ExportLog, Order, User
from app.schemas import OrderPageOut

router = APIRouter(prefix="/admin/orders", tags=["admin-orders"])


async def _query_orders(db, page: int, size: int, status_filter: str | None, user_id: int | None):
    stmt = select(Order).options(selectinload(Order.items))
    if status_filter:
        stmt = stmt.where(Order.status == status_filter)
    if user_id:
        stmt = stmt.where(Order.user_id == user_id)
    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = (await db.scalars(stmt.order_by(Order.id.desc()).limit(size).offset((page - 1) * size))).all()
    return stmt, total or 0, rows


@router.get("", response_model=OrderPageOut)
async def list_orders(
    db: DbDep, admin: AdminUser,
    page: int = 1, size: int = 10,
    status_filter: str | None = None, user_id: int | None = None,
) -> OrderPageOut:
    _, total, rows = await _query_orders(db, page, size, status_filter, user_id)
    # join emails in one shot (N+1 avoidance)
    uids = {o.user_id for o in rows}
    emails: dict[int, str] = {}
    if uids:
        res = await db.execute(select(User.id, User.email).where(User.id.in_(uids)))
        emails = dict(res.all())  # type: ignore[arg-type]
    # OrderPageOut reuses buyer shape; admin fields ride on AdminOrderOut only in detail
    from app.schemas import OrderOut
    return OrderPageOut(
        items=[OrderOut.model_validate(o) for o in rows],
        total=total, page=page, pages=max(1, -(-(total or 0) // size)),
    )


@router.get("/export", response_model=None)
async def export_orders_csv(
    db: DbDep, admin: AdminUser,
    status_filter: str | None = None, user_id: int | None = None,
) -> StreamingResponse:
    """CSV export of purchase records; every export is audit-logged."""
    _, _, rows = await _query_orders(db, 1, 100_000, status_filter, user_id)
    uids = {o.user_id for o in rows}
    emails: dict[int, str] = {}
    if uids:
        res = await db.execute(select(User.id, User.email).where(User.id.in_(uids)))
        emails = dict(res.all())  # type: ignore[arg-type]

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["order_no", "user_email", "status", "item_title", "unit_price_cents",
                     "qty", "line_total_cents", "order_total_cents", "paid_at", "created_at"])
    for o in rows:
        for it in o.items:
            writer.writerow([
                o.order_no, emails.get(o.user_id, ""), o.status, it.title,
                it.unit_price_cents, it.qty, it.unit_price_cents * it.qty,
                o.total_cents,
                o.paid_at.isoformat() if o.paid_at else "",
                o.created_at.isoformat(),
            ])

    db.add(ExportLog(
        admin_id=admin.id, resource="orders", fmt="csv", row_count=len(rows),
        filters={"status": status_filter, "user_id": user_id},
    ))
    await db.flush()
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="orders_{stamp}.csv"'},
    )
