"""Admin: promotions (site-wide campaigns) — super_admin only.

Permission matrix per requirements:
- admin (普通管理员): view orders/users only + grant discounts on users/products
- super_admin: everything above PLUS promotions, product CRUD/publish, invite
  codes, role assignment, bans, shop name, revenue stats
"""
from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.core.deps import DbDep, SuperAdminUser
from app.core.timeutil import utcnow
from app.models import Promotion
from app.schemas import PromotionIn, PromotionOut
from app.services.settings_service import get_setting_bool, set_setting

router = APIRouter(prefix="/admin/promotions", tags=["admin-promotions"])


@router.get("", response_model=list[PromotionOut])
async def list_promotions(db: DbDep, sup: SuperAdminUser) -> list[PromotionOut]:
    rows = (await db.scalars(select(Promotion).order_by(Promotion.id.desc()).limit(100))).all()
    return [PromotionOut.model_validate(p) for p in rows]


@router.post("", response_model=PromotionOut, status_code=status.HTTP_201_CREATED)
async def create_promotion(body: PromotionIn, db: DbDep, sup: SuperAdminUser) -> PromotionOut:
    """Create campaign: percent_off (全场折扣) or buy_n_get_1 (买N送1).

    Creating a new active promotion automatically ends the previous one —
    the pricing engine uses only the latest active campaign.
    """
    # end previous active campaign(s) so only one is live at a time
    prev = (await db.scalars(select(Promotion).where(Promotion.status == "active"))).all()
    for p in prev:
        p.status = "ended"

    promo = Promotion(
        name=body.name, kind=body.kind, value=body.value,
        ends_at=utcnow() + timedelta(days=body.ends_days) if body.ends_days else None,
    )
    db.add(promo)
    await db.flush()
    return PromotionOut.model_validate(promo)


@router.post("/{promotion_id}/end", response_model=PromotionOut)
async def end_promotion(promotion_id: int, db: DbDep, sup: SuperAdminUser) -> PromotionOut:
    p = await db.get(Promotion, promotion_id)
    if p is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Promotion not found")
    if p.status != "active":
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Promotion already ended")
    p.status = "ended"
    await db.flush()
    return PromotionOut.model_validate(p)
