"""System settings service: admin-controlled switches persisted in DB."""
from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import SystemSetting


async def get_setting_bool(db: AsyncSession, key: str, default: bool = False) -> bool:
    row = await db.get(SystemSetting, key)
    if row is None:
        return default
    return bool(row.value)


async def set_setting(db: AsyncSession, key: str, value) -> None:
    row = await db.get(SystemSetting, key)
    if row is None:
        db.add(SystemSetting(key=key, value=value))
    else:
        row.value = value
