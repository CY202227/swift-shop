"""Admin: user management.

Permission split (per requirements):
- admin: list + view users, grant personal discount (打折)
- super_admin: everything above + disable/ban accounts (封号) + role assignment (指定管理员)
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, or_, select

from app.core.deps import AdminUser, DbDep, SuperAdminUser
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

    # Permission split: only super_admin may assign roles or ban accounts.
    # Regular admins can only adjust the personal discount.
    if "role" in data or "status" in data:
        if admin.role != "super_admin":
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Super admin only: role assignment / banning")
        # super admin cannot demote themselves either (handled above via own-id check)
        # never demote the last remaining super admin; promotions are fine.
        # (also covers self-demotion to "admin", which the own-id guard above
        # does not block). Disabling does not need a guard: only a super admin
        # reaches this branch, and disabling yourself is blocked up top.
        if u.role == "super_admin" and data.get("role", u.role) != "super_admin":
            others = await db.scalar(
                select(func.count()).select_from(User).where(User.role == "super_admin", User.id != u.id)
            )
            if not others:
                raise HTTPException(status.HTTP_409_CONFLICT, detail="Cannot demote the last super admin")

    for k, v in data.items():
        setattr(u, k, v)
    await db.flush()
    return AdminUserOut.model_validate(u)
