"""FastAPI application factory + startup tasks (create tables, seed admin/demo)."""
from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.v1 import api_router
from app.core.config import settings
from app.core.security import hash_password
from app.core.timeutil import utcnow
from app.db.base import Base, engine


DEMO_PRODUCTS = [
    {"name": "机械键盘 87键", "slug": "mech-keyboard-87", "price_cents": 29900,
     "stock": 50, "description": "热插拔轴体，PBT 键帽，三模连接", "status": "active",
     "images": []},
    {"name": "无线鼠标", "slug": "wireless-mouse", "price_cents": 12900,
     "stock": 80, "description": "静音微动，人体工学，Type-C 快充", "status": "active",
     "images": []},
    {"name": "降噪耳机", "slug": "anc-headphones", "price_cents": 89900,
     "stock": 20, "description": "主动降噪 42dB，续航 60 小时", "status": "active",
     "images": []},
    {"name": "USB-C 扩展坞", "slug": "usbc-dock", "price_cents": 35900,
     "stock": 35, "description": "8 合 1，HDMI 4K60，千兆网口", "status": "active",
     "images": []},
]


async def _init_db() -> None:
    """Create tables + seed on first boot. (Alembic introduced when schema stabilizes.)"""
    from app.db.base import AsyncSessionLocal
    from app.models import Product, User
    from sqlalchemy import func, select

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        # --- seed admin account ---
        if not await db.scalar(select(User.id).where(User.role == "admin")):
            db.add(User(
                email=settings.ADMIN_EMAIL.lower(),
                username="admin",
                password_hash=hash_password(settings.ADMIN_DEFAULT_PASSWORD),
                role="admin",
                email_verified=True,
            ))
            await db.flush()

        # --- seed demo products (web storefront preview needs something to show) ---
        if settings.SEED_DEMO_PRODUCTS:
            count = await db.scalar(select(func.count()).select_from(Product))
            if not count:
                for p in DEMO_PRODUCTS:
                    db.add(Product(**p))
                await db.flush()
        await db.commit()


def create_app() -> FastAPI:
    app = FastAPI(
        title=f"{settings.APP_NAME} API",
        version="0.1.0",
        debug=settings.DEBUG,
        docs_url="/docs" if settings.ENV == "dev" else None,
        redoc_url=None,
    )

    # CORS: only the two known frontends (+backend itself for mock pay loop)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.on_event("startup")
    async def _startup() -> None:
        await _init_db()

    app.include_router(api_router, prefix=settings.API_V1_PREFIX)

    # local-disk image serving (dev / single-node prod); s3 backend skips this
    if settings.STORAGE_BACKEND == "local":
        upload_dir = Path(settings.LOCAL_UPLOAD_DIR)
        upload_dir.mkdir(parents=True, exist_ok=True)
        app.mount("/uploads", StaticFiles(directory=str(upload_dir)), name="uploads")
    return app


app = create_app()
