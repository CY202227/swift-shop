"""Admin: product CRUD + publish/unpublish (上下架)."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select

from app.core.deps import AdminUser, DbDep
from app.models import OrderItem, Product
from app.schemas import ProductAdminIn, ProductOut, ProductPageOut, ProductPatchIn, SettingsPatchIn

router = APIRouter(prefix="/admin/products", tags=["admin-products"])


@router.get("", response_model=ProductPageOut)
async def list_products(db: DbDep, admin: AdminUser, page: int = 1, size: int = 10, status_filter: str | None = None, search: str | None = None) -> ProductPageOut:
    stmt = select(Product)
    if status_filter:
        stmt = stmt.where(Product.status == status_filter)
    if search:
        stmt = stmt.where(Product.name.icontains(f"%{search}%"))
    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    items = (await db.scalars(stmt.order_by(Product.id.desc()).limit(size).offset((page - 1) * size))).all()
    return ProductPageOut(items=[ProductOut.model_validate(p) for p in items], total=total or 0, page=page, pages=max(1, -(-(total or 0) // size)))


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
async def create_product(body: ProductAdminIn, db: DbDep, admin: AdminUser) -> ProductOut:
    dup = await db.scalar(select(Product.id).where(Product.slug == body.slug))
    if dup:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Slug already exists")
    p = Product(**body.model_dump(), status="draft")
    db.add(p)
    await db.flush()
    return ProductOut.model_validate(p)


@router.patch("/{product_id}", response_model=ProductOut)
async def update_product(product_id: int, body: ProductPatchIn, db: DbDep, admin: AdminUser) -> ProductOut:
    p = await db.get(Product, product_id)
    if p is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Product not found")
    data = body.model_dump(exclude_unset=True)
    if "slug" in data and data["slug"] != p.slug:
        dup = await db.scalar(select(Product.id).where(Product.slug == data["slug"]))
        if dup:
            raise HTTPException(status.HTTP_409_CONFLICT, detail="Slug already exists")
    for k, v in data.items():
        setattr(p, k, v)
    await db.flush()
    return ProductOut.model_validate(p)


@router.delete("/{product_id}")
async def delete_product(product_id: int, db: DbDep, admin: AdminUser) -> dict:
    p = await db.get(Product, product_id)
    if p is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Product not found")
    used = await db.scalar(select(func.count()).select_from(OrderItem).where(OrderItem.product_id == product_id))
    if used:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Product has order history; unpublish instead of delete")
    await db.delete(p)
    return {"detail": "deleted"}


@router.post("/{product_id}/publish", response_model=ProductOut)
async def publish(product_id: int, db: DbDep, admin: AdminUser) -> ProductOut:
    """上架: draft/retired -> active."""
    p = await db.get(Product, product_id)
    if p is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Product not found")
    if p.status == "active":
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Already published")
    p.status = "active"
    await db.flush()
    return ProductOut.model_validate(p)


@router.post("/{product_id}/unpublish", response_model=ProductOut)
async def unpublish(product_id: int, db: DbDep, admin: AdminUser) -> ProductOut:
    """下架: active -> retired. Existing orders keep their snapshots."""
    p = await db.get(Product, product_id)
    if p is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Product not found")
    if p.status != "active":
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Not currently published")
    p.status = "retired"
    await db.flush()
    return ProductOut.model_validate(p)
