"""Cart endpoints. Prices/stock in responses are always recomputed from DB.

Discount display rules (mirrors pricing engine):
- effective_unit_cents = price after product% + promotion%
- promotion buy_n_get_1: cart shows the campaign; savings apply at line level
- total_cents = subtotal - user personal discount (granted by admin)
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.core.deps import CurrentUser, DbDep
from app.models import CartItem, Product
from app.schemas import CartAddIn, CartItemOut, CartOut, CartPatchIn, PromotionBrief
from app.services.pricing import apply_user_discount, compute_unit_price, get_active_promotion

router = APIRouter(prefix="/cart", tags=["cart"])


async def _get_cart(db, user) -> CartOut:
    rows = await db.execute(
        select(CartItem, Product)
        .join(Product, CartItem.product_id == Product.id)
        .where(CartItem.user_id == user.id, Product.status == "active")
        .order_by(CartItem.id)
    )
    promotion = await get_active_promotion(db)
    items = []
    subtotal = 0
    for ci, p in rows.all():
        eff = compute_unit_price(p, promotion)
        # line subtotal uses effective price; buy-N-get-1 savings show up at checkout
        subtotal += eff * ci.qty
        items.append(CartItemOut(
            id=ci.id, product_id=p.id, name=p.name, slug=p.slug,
            price_cents=p.price_cents, stock=p.stock, images=p.images,
            qty=ci.qty, subtotal_cents=eff * ci.qty,
            product_discount_percent=p.discount_percent,
            effective_unit_cents=eff,
        ))
    user_disc = apply_user_discount(subtotal, user)
    return CartOut(
        items=items,
        subtotal_cents=subtotal,
        user_discount_percent=user.discount_percent,
        user_discount_cents=user_disc,
        promotion=PromotionBrief.model_validate(promotion) if promotion else None,
        total_cents=subtotal - user_disc,
    )


@router.get("", response_model=CartOut)
async def get_cart(user: CurrentUser, db: DbDep) -> CartOut:
    return await _get_cart(db, user)


@router.post("", response_model=CartOut, status_code=status.HTTP_201_CREATED)
async def add_to_cart(body: CartAddIn, user: CurrentUser, db: DbDep) -> CartOut:
    p = await db.get(Product, body.product_id)
    if p is None or p.status != "active":
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Product not available")
    if p.stock < body.qty:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Insufficient stock")

    existing = await db.scalar(
        select(CartItem).where(CartItem.user_id == user.id, CartItem.product_id == body.product_id)
    )
    if existing:
        new_qty = existing.qty + body.qty
        if new_qty > 99 or new_qty > p.stock:
            raise HTTPException(status.HTTP_409_CONFLICT, detail="Quantity exceeds stock/limit")
        existing.qty = new_qty
    else:
        db.add(CartItem(user_id=user.id, product_id=body.product_id, qty=body.qty))
    await db.flush()
    return await _get_cart(db, user)


@router.patch("/{item_id}", response_model=CartOut)
async def update_qty(item_id: int, body: CartPatchIn, user: CurrentUser, db: DbDep) -> CartOut:
    ci = await db.scalar(select(CartItem).where(CartItem.id == item_id, CartItem.user_id == user.id))
    if ci is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Cart item not found")
    p = await db.get(Product, ci.product_id)
    if p is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Product no longer exists")
    if p.status != "active" or body.qty > p.stock:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Product off-shelf or insufficient stock")
    ci.qty = body.qty
    await db.flush()
    return await _get_cart(db, user)


@router.delete("/{item_id}", response_model=CartOut)
async def remove_item(item_id: int, user: CurrentUser, db: DbDep) -> CartOut:
    ci = await db.scalar(select(CartItem).where(CartItem.id == item_id, CartItem.user_id == user.id))
    if ci is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Cart item not found")
    await db.delete(ci)
    await db.flush()
    return await _get_cart(db, user)


@router.delete("", response_model=CartOut)
async def clear_cart(user: CurrentUser, db: DbDep) -> CartOut:
    rows = await db.scalars(select(CartItem).where(CartItem.user_id == user.id))
    for ci in rows.all():
        await db.delete(ci)
    await db.flush()
    return await _get_cart(db, user)
