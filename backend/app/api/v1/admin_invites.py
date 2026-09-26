"""Admin: invite codes (生成/批量/作废) + invite_required / shop_name settings.

Permission split (per requirements):
- invite management + settings are super_admin domain
- a regular admin has no business minting invites or renaming the shop
"""
from __future__ import annotations

import secrets
from datetime import timedelta

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select

from app.core.deps import DbDep, SuperAdminUser
from app.core.timeutil import utcnow
from app.models import InviteCode
from app.schemas import InviteCreateIn, InviteOut, InvitePageOut, InviteRevokeIn, SettingsOut, SettingsPatchIn
from app.services.settings_service import get_setting_bool, get_setting, set_setting

router = APIRouter(prefix="/admin", tags=["admin-invites"])

_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"  # no confusing chars (0/O, 1/I/L)


def _gen_code() -> str:
    return "".join(secrets.choice(_ALPHABET) for _ in range(8))


@router.get("/settings", response_model=SettingsOut)
async def read_settings(db: DbDep, sup: SuperAdminUser) -> SettingsOut:
    return SettingsOut(
        invite_required=await get_setting_bool(db, "invite_required", default=False),
        shop_name=await get_setting(db, "shop_name", default="PTCG Shop"),
    )


@router.patch("/settings", response_model=SettingsOut)
async def patch_settings(body: SettingsPatchIn, db: DbDep, sup: SuperAdminUser) -> SettingsOut:
    data = body.model_dump(exclude_unset=True)
    for key, value in data.items():
        await set_setting(db, key, value)
    return SettingsOut(
        invite_required=await get_setting_bool(db, "invite_required", default=False),
        shop_name=await get_setting(db, "shop_name", default="PTCG Shop"),
    )


@router.get("/invite-codes", response_model=InvitePageOut)
async def list_invites(db: DbDep, sup: SuperAdminUser, page: int = 1, size: int = 10) -> InvitePageOut:
    base = select(InviteCode)
    total = await db.scalar(select(func.count()).select_from(base.subquery()))
    rows = (await db.scalars(base.order_by(InviteCode.id.desc()).limit(size).offset((page - 1) * size))).all()
    return InvitePageOut(items=[InviteOut.model_validate(r) for r in rows], total=total or 0)


@router.post("/invite-codes", response_model=list[InviteOut], status_code=status.HTTP_201_CREATED)
async def create_invites(body: InviteCreateIn, db: DbDep, sup: SuperAdminUser) -> list[InviteOut]:
    """Batch generation with per-code max uses / expiry (days) / remark.

    Note: sup (not admin) -- module docstring says invite minting is
    super_admin domain, and the body below already references sup.id;
    an AdminUser param here previously made every POST a 500 (NameError).
    """
    created: list[InviteCode] = []
    for _ in range(body.count):
        code = _gen_code()
        # retry on astronomically unlikely collision
        while await db.scalar(select(InviteCode.id).where(InviteCode.code == code)):
            code = _gen_code()
        ic = InviteCode(
            code=code,
            max_uses=body.max_uses,
            expires_at=utcnow() + timedelta(days=body.expires_days) if body.expires_days else None,
            remark=body.remark,
            created_by=sup.id,
        )
        db.add(ic)
        created.append(ic)
    await db.flush()
    return [InviteOut.model_validate(c) for c in created]


@router.patch("/invite-codes/{invite_id}", response_model=InviteOut)
async def revoke_invite(invite_id: int, body: InviteRevokeIn, db: DbDep, sup: SuperAdminUser) -> InviteOut:
    ic = await db.get(InviteCode, invite_id)
    if ic is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Invite code not found")
    ic.status = body.status
    await db.flush()
    return InviteOut.model_validate(ic)
