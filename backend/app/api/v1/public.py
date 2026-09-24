"""Public shop settings: banner/name/promotion info consumed by storefronts.

Unauthenticated readers: web SPA hero, Pages facade, language detection.
Includes the active promotion so any storefront can render the campaign banner.
"""
from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import DbDep
from app.schemas import PromotionBrief, SettingsOut
from app.services.pricing import get_active_promotion
from app.services.settings_service import get_setting, get_setting_bool

router = APIRouter(prefix="/public", tags=["public-settings"])


@router.get("/settings", response_model=SettingsOut)
async def public_settings(db: DbDep) -> SettingsOut:
    """Shop name + invite requirement + active campaign for any visitor."""
    # Public payload is a fixed allowlist — never dump the whole settings table
    promo = await get_active_promotion(db)
    return SettingsOut(
        invite_required=await get_setting_bool(db, "invite_required", default=False),
        shop_name=await get_setting(db, "shop_name", default="PTCG Shop"),
        promotion=PromotionBrief.model_validate(promo) if promo else None,
    )


@router.get("/google-client-id")
async def google_client_id() -> dict:
    """Client id is public by OAuth design; safe to expose for the login button."""
    return {"client_id": settings.GOOGLE_CLIENT_ID or ""}
