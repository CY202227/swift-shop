"""Admin: user management (list / disable / role)."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, or_, select

from app.core.deps import AdminUser, DbDep
from app.models import User
from app.schemas import AdminUserOut, UserPatchIn

router = APIRouter(prefix="/admin/users", tags=["admin-users"])


@router.get("")
async def list_users(db: DbDep, admin: AdminUser, page: int = 1, size: int = 10, search: str | None = None) -> dict:
    stmt = select(User)
    if search:
        like = f"%{search}%"
        stmt = stmt.where(or_(User.email.icontains(like), User.username.icontains(like)))
    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = (await db.scalars(stmt.order_by(User.id.desc()).limit(size).offset((page - 1) * size))).all()
    return {
        "items": [AdminUserOut.model_validate(u).model_dump() for u in rows],
        "total": total or 0, "page": page,
        "pages": max(1, -(-(total or 0) // size)),
    }


@router.patch("/{user_id}", response_model=AdminUserOut)
async def patch_user(user_id: int, body: UserPatchIn, db: DbDep, admin: AdminUser) -> AdminUserOut:
    u = await db.get(User, user_id)
    if u is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="User not found")
    # Guard: cannot demote/disable your own admin account (lockout protection)
    if u.id == admin.id and (body.role == "user" or body.status == "disabled"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Cannot demote/disable yourself")
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(u, k, v)
    await db.flush()
    return AdminUserOut.model_validate(u)
