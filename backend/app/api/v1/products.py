"""Public product endpoints: browse active products only."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, or_, select

from app.core.deps import DbDep
from app.models import Product
from app.schemas import ProductOut, ProductPageOut

router = APIRouter(prefix="/products", tags=["products"])


@router.get("", response_model=ProductPageOut)
async def list_products(
    db: DbDep,
    page: int = Query(1, ge=1),
    size: int = Query(12, ge=1, le=48),
    search: str | None = None,
    sort: str = Query("new", pattern="^(new|price_asc|price_desc)$"),
) -> ProductPageOut:
    stmt = select(Product).where(Product.status == "active")
    if search:
        # parameterized via ORM bindings - no string concatenation
        like = f"%{search}%"
        stmt = stmt.where(or_(Product.name.icontains(like), Product.description.icontains(like)))
    order = {
        "new": Product.created_at.desc(),
        "price_asc": Product.price_cents.asc(),
        "price_desc": Product.price_cents.desc(),
    }[sort]

    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    items = (await db.scalars(stmt.order_by(order).limit(size).offset((page - 1) * size))).all()
    return ProductPageOut(
        items=[ProductOut.model_validate(p) for p in items],
        total=total or 0,
        page=page,
        pages=max(1, -(-(total or 0) // size)),
    )


@router.get("/{slug}", response_model=ProductOut)
async def get_product(slug: str, db: DbDep) -> ProductOut:
    # Public detail also restricts to active; drafts/retired are invisible
    p = await db.scalar(select(Product).where(Product.slug == slug, Product.status == "active"))
    if p is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Product not found")
    return ProductOut.model_validate(p)
