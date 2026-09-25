"""Orders + checkout. Anti-tamper core:
- order amount recomputed server-side from DB product prices (client totals ignored)
- stock deducted with a single conditional UPDATE (no oversell under concurrency)
- pay/initiate only allowed by the order owner; status transitions guarded
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentUser, DbDep
from app.core.timeutil import utcnow
from app.models import CartItem, Order, OrderItem, Payment, Product
from app.payments import get_provider
from app.schemas import OrderCreateIn, OrderOut, OrderPageOut, PayIn, PayOut
from app.services.pricing import apply_user_discount, compute_line_total, compute_unit_price, get_active_promotion

router = APIRouter(prefix="/orders", tags=["orders"])


def _gen_order_no() -> str:
    import secrets
    return datetime.now(timezone.utc).strftime("%Y%m%d") + "-" + secrets.token_hex(4).upper()


@router.post("", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
async def create_order(body: OrderCreateIn, user: CurrentUser, db: DbDep) -> OrderOut:
    # 1) Load the user's cart joined with live products
    rows = (
        await db.execute(
            select(CartItem, Product)
            .join(Product, CartItem.product_id == Product.id)
            .where(CartItem.user_id == user.id)
            .order_by(CartItem.id)
        )
    ).all()
    if not rows:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Cart is empty")

    # 2) Validate availability; compute total SERVER-side via pricing engine
    promotion = await get_active_promotion(db)
    subtotal = 0
    plan: list[tuple[int, str, int, int, int]] = []  # (product_id, title, unit_price, qty, line_total)
    for ci, p in rows:
        if p.status != "active":
            raise HTTPException(status.HTTP_409_CONFLICT, detail=f"Product '{p.name}' is no longer on sale")
        if ci.qty > p.stock:
            raise HTTPException(status.HTTP_409_CONFLICT, detail=f"Insufficient stock for '{p.name}'")
        unit = compute_unit_price(p, promotion)
        line = compute_line_total(unit, ci.qty, promotion)
        subtotal += line
        plan.append((p.id, p.name, unit, ci.qty, line))

    user_disc = apply_user_discount(subtotal, user)
    total = subtotal - user_disc

    order = Order(
        order_no=_gen_order_no(), user_id=user.id, total_cents=total,
        subtotal_cents=subtotal, discount_cents=user_disc,
        promotion_id=promotion.id if promotion else None,
        promotion_name=promotion.name if promotion else None,
        # shipping snapshot from the checkout form; stored on the order
        recipient_name=body.recipient_name.strip(),
        recipient_phone=body.recipient_phone.strip(),
        address=body.address.strip(),
    )
    db.add(order)
    await db.flush()

    # 3) Atomic conditional stock deduction; 0 rows updated => someone bought first
    for product_id, title, unit_price, qty, line_total in plan:
        res = await db.execute(
            update(Product)
            .where(Product.id == product_id, Product.stock >= qty)
            .values(stock=Product.stock - qty)
        )
        if res.rowcount == 0:
            raise HTTPException(status.HTTP_409_CONFLICT, detail=f"Stock changed for '{title}', please retry")
        db.add(OrderItem(
            order_id=order.id, product_id=product_id, title=title,
            unit_price_cents=unit_price, qty=qty,
            original_price_cents=(await db.get(Product, product_id)).price_cents,
            line_total_cents=line_total,
        ))

    # 4) Clear the cart
    for ci, _ in rows:
        await db.delete(ci)
    await db.flush()

    # Re-fetch order with items eagerly loaded; order.items would lazy-load
    # inside Pydantic validation and blow up with MissingGreenlet in async.
    order = await db.scalar(
        select(Order).options(selectinload(Order.items)).where(Order.id == order.id)
    )
    return OrderOut.model_validate(order)


@router.get("", response_model=OrderPageOut)
async def my_orders(user: CurrentUser, db: DbDep, page: int = 1, size: int = 10) -> OrderPageOut:
    base = select(Order).where(Order.user_id == user.id)
    total = await db.scalar(select(func.count()).select_from(base.subquery()))
    orders = (
        await db.scalars(
            base.options(selectinload(Order.items))
            .order_by(Order.id.desc())
            .limit(size)
            .offset((page - 1) * size)
        )
    ).all()
    return OrderPageOut(items=[OrderOut.model_validate(o) for o in orders], total=total or 0, page=page, pages=max(1, -(-(total or 0) // size)))


async def _owned_order(db, user_id: int, order_id: int) -> Order:
    # Eager-load items for all downstream validation/serialization
    o = await db.scalar(
        select(Order).options(selectinload(Order.items)).where(Order.id == order_id)
    )
    if o is None or o.user_id != user_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Order not found")
    return o


@router.get("/{order_id}", response_model=OrderOut)
async def order_detail(order_id: int, user: CurrentUser, db: DbDep) -> OrderOut:
    o = await _owned_order(db, user.id, order_id)
    return OrderOut.model_validate(o)


@router.post("/{order_id}/pay", response_model=PayOut)
async def pay(order_id: int, body: PayIn, user: CurrentUser, db: DbDep) -> PayOut:
    o = await _owned_order(db, user.id, order_id)
    if o.status != "pending_payment":
        raise HTTPException(status.HTTP_409_CONFLICT, detail=f"Order status is '{o.status}', cannot pay")

    provider = get_provider(body.provider)
    result = await provider.create_payment(
        order_no=o.order_no, amount_cents=o.total_cents, subject=f"Order {o.order_no}"
    )
    if not result.ok:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail=result.message or "Payment gateway error")

    db.add(Payment(
        order_id=o.id, provider=provider.name,
        provider_trade_no=result.provider_trade_no,
        amount_cents=o.total_cents, status="created",
    ))
    await db.flush()
    return PayOut(
        payment_id=0, provider=provider.name, status="created",
        pay_url=result.pay_url, order_no=o.order_no,
    )


@router.post("/{order_id}/cancel", response_model=OrderOut)
async def cancel_order(order_id: int, user: CurrentUser, db: DbDep) -> OrderOut:
    o = await _owned_order(db, user.id, order_id)
    if o.status != "pending_payment":
        raise HTTPException(status.HTTP_409_CONFLICT, detail=f"Order status is '{o.status}', cannot cancel")

    # Return stock for every item, then mark cancelled
    for item in o.items:
        product = await db.get(Product, item.product_id)
        if product is not None:
            product.stock += item.qty
    o.status = "cancelled"
    o.cancelled_at = utcnow()
    await db.flush()

    # Re-fetch with items loaded for serialization
    o = await db.scalar(
        select(Order).options(selectinload(Order.items)).where(Order.id == o.id)
    )
    return OrderOut.model_validate(o)
