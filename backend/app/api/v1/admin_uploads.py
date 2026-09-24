"""Admin: image upload endpoint (single entry, storage-backend decided server-side)."""
from __future__ import annotations

from fastapi import APIRouter, UploadFile, status

from app.core.deps import AdminUser
from app.services.storage import save_image

router = APIRouter(prefix="/admin/uploads", tags=["admin-uploads"])


@router.post("/image", status_code=status.HTTP_201_CREATED)
async def upload_image(file: UploadFile, admin: AdminUser) -> dict:
    url = await save_image(file)
    return {"url": url}
