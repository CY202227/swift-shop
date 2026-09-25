"""Admin: order list / detail / CSV export (audit-logged).

Buyer email and shipping snapshot (recipient/phone/address) are attached
to every order row so the backoffice can actually fulfil shipments, and
the CSV export carries the same fields.
"""
from __future__ import annotations

import csv
import io
from datetime import datetime, timezone

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.core.deps import AdminUser, DbDep
from app.models import ExportLog, Order, User
from app.schemas import OrderOut, OrderPageOut

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


async def _buyer_emails(db, rows) -> dict[int, str]:
    """Resolve buyer emails in one query (avoid N+1)."""
    uids = {o.user_id for o in rows}
    if not uids:
        return {}
    res = await db.execute(select(User.id, User.email).where(User.id.in_(uids)))
    return dict(res.all())  # type: ignore[arg-type]


def _order_out_with_buyer(o: Order, email: str) -> OrderOut:
    out = OrderOut.model_validate(o)
    out.user_email = email
    return out


@router.get("", response_model=OrderPageOut)
async def list_orders(
    db: DbDep, admin: AdminUser,
    page: int = 1, size: int = 10,
    status_filter: str | None = None, user_id: int | None = None,
) -> OrderPageOut:
    _, total, rows = await _query_orders(db, page, size, status_filter, user_id)
    emails = await _buyer_emails(db, rows)
    return OrderPageOut(
        items=[_order_out_with_buyer(o, emails.get(o.user_id, "")) for o in rows],
        total=total, page=page, pages=max(1, -(-(total or 0) // size)),
    )


@router.get("/export", response_model=None)
async def export_orders_csv(
    db: DbDep, admin: AdminUser,
    status_filter: str | None = None, user_id: int | None = None,
) -> StreamingResponse:
    """CSV export of purchase records incl. shipping info; audit-logged."""
    _, _, rows = await _query_orders(db, 1, 100_000, status_filter, user_id)
    emails = await _buyer_emails(db, rows)

    buf = io.StringIO()
    writer = csv.writer(buf)
    # utf-8 BOM so Excel opens Chinese text correctly
    buf.write("\ufeff")
    writer.writerow([
        "order_no", "user_email", "status",
        "recipient_name", "recipient_phone", "address",
        "item_title", "unit_price_cents", "qty", "line_total_cents",
        "order_subtotal_cents", "order_discount_cents", "order_total_cents",
        "paid_at", "created_at",
    ])
    for o in rows:
        # one CSV row per order item; shipping fields repeat per row so
        # fulfilment can work from a single row
        for it in o.items:
            writer.writerow([
                o.order_no, emails.get(o.user_id, ""), o.status,
                o.recipient_name, o.recipient_phone, o.address,
                it.title, it.unit_price_cents, it.qty,
                # snapshot line total (honours buy-N-get-1), NOT unit*qty
                it.line_total_cents if it.line_total_cents else it.unit_price_cents * it.qty,
                o.subtotal_cents, o.discount_cents, o.total_cents,
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
