"""FastAPI auth dependencies: current user / admin-only guard."""
from __future__ import annotations

from typing import Annotated

import jwt as pyjwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token
from app.db.base import get_db
from app.models import User

bearer = HTTPBearer(auto_error=False)
DbDep = Annotated[AsyncSession, Depends(get_db)]


def _credentials_error(detail: str = "Invalid or expired credentials") -> HTTPException:
    return HTTPException(status.HTTP_401_UNAUTHORIZED, detail=detail, headers={"WWW-Authenticate": "Bearer"})


async def get_current_user(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    db: DbDep,
) -> User:
    if creds is None:
        raise _credentials_error("Not authenticated")
    try:
        payload = decode_token(creds.credentials)
    except pyjwt.PyJWTError:
        raise _credentials_error()
    if payload.get("type") != "access":
        raise _credentials_error("Wrong token type")

    user = await db.get(User, int(payload["sub"]))
    if user is None or user.status != "active":
        raise _credentials_error("User disabled or removed")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


async def require_admin(user: CurrentUser) -> User:
    if user.role != "admin":
        # 403 (not 401): authenticated but not privileged
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Admin only")
    return user


AdminUser = Annotated[User, Depends(require_admin)]
