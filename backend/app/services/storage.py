"""Image storage: local disk (default) or S3/MinIO via the same interface.

Design: admin uploads product images through ONE endpoint; the backend decides
where bytes live via STORAGE_BACKEND. Switching local->minio->cloud-oss later
is a config change, not a code change.
"""
from __future__ import annotations

import re
import secrets
from datetime import datetime
from pathlib import Path

from fastapi import HTTPException, UploadFile

from app.core.config import settings

ALLOWED_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif"}
MAX_BYTES = 5 * 1024 * 1024  # 5MB

_slug = re.compile(r"[^a-z0-9]+")


def _safe_name(name: str) -> str:
    stem = _slug.sub("-", name.rsplit(".", 1)[0].lower()).strip("-")[:40] or "img"
    return f"{stem}-{secrets.token_hex(4)}"


async def save_image(file: UploadFile) -> str:
    """Validate + persist; returns the public URL path of the stored image."""
    ext = ALLOWED_TYPES.get(file.content_type or "")
    if not ext:
        raise HTTPException(415, f"Unsupported image type: {file.content_type}")
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "Image exceeds 5MB limit")
    if not data:
        raise HTTPException(400, "Empty file")

    now = datetime.utcnow()
    name = _safe_name(file.filename or "img") + ext
    rel = f"{now:%Y/%m}/{name}"

    if settings.STORAGE_BACKEND == "s3":
        _put_s3(rel, data, file.content_type)
        return f"{settings.S3_PUBLIC_URL.rstrip('/')}/{rel}"

    # local disk backend (dev / small deployment)
    root = Path(settings.LOCAL_UPLOAD_DIR)
    target = root / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    return f"/uploads/{rel}"


def _put_s3(key: str, data: bytes, content_type: str) -> None:
    """Upload to MinIO/S3 (boto3 is sync; at this traffic level that's fine)."""
    try:
        import boto3
        from botocore.client import Config
    except ImportError as exc:  # pragma: no cover
        raise HTTPException(501, "S3 backend requires boto3 (pip install boto3)") from exc

    s3 = boto3.client(
        "s3",
        endpoint_url=settings.S3_ENDPOINT,
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY,
        config=Config(signature_version="s3v4"),
        region_name="us-east-1",
    )
    try:
        s3.put_object(Bucket=settings.S3_BUCKET, Key=key, Body=data,
                      ContentType=content_type)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(502, f"S3 upload failed: {exc}") from exc
