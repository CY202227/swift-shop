"""Application settings loaded from environment variables (.env)."""
from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- App ---
    APP_NAME: str = "Shop"
    ENV: str = "dev"          # dev | prod
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"

    # --- Database (default: local sqlite so the app boots with zero infra;
    #     production overrides with PostgreSQL URL from .env) ---
    DATABASE_URL: str = "sqlite+aiosqlite:///./shop_dev.db"

    # --- KV abstraction (verification codes, cooldowns) ---
    KV_BACKEND: str = "memory"   # memory | pg | redis(reserved)

    # --- Security ---
    JWT_SECRET: str = "dev-only-secret-change-me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_MIN: int = 30
    REFRESH_TOKEN_DAYS: int = 14
    BACKEND_PUBLIC_URL: str = "http://localhost:8000"

    # --- Frontend origins ---
    FRONTEND_URL: str = "http://localhost:5173"    # web SPA
    ADMIN_URL: str = "http://localhost:5174"      # admin SPA (may move to its own domain)
    # comma-separated string, parsed via property below
    CORS_ORIGINS_STR: str = "http://localhost:5173,http://localhost:5174,http://localhost:8000"

    # --- Mail (dev -> mailpit at localhost:1025) ---
    SMTP_HOST: str = "localhost"
    SMTP_PORT: int = 1025
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    MAIL_FROM: str = "no-reply@shop.local"
    MAIL_FROM_NAME: str = "Shop"

    # --- Object storage: local disk (default) or S3/MinIO ---
    STORAGE_BACKEND: str = "local"   # local | s3
    LOCAL_UPLOAD_DIR: str = "./uploads"
    S3_ENDPOINT: str = "http://localhost:9000"
    S3_ACCESS_KEY: str = "minioadmin"
    S3_SECRET_KEY: str = "minioadmin"
    S3_BUCKET: str = "shop"
    S3_PUBLIC_URL: str = "http://localhost:9000/shop"

    # --- Google OAuth ---
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:5173/oauth/google/callback"

    # --- Payment adapter layer ---
    PAYMENT_PROVIDER: str = "mock"           # mock | stripe | alipay | wechat
    PAYMENT_CURRENCY: str = "CNY"
    PAYMENT_WEBHOOK_SECRET: str = ""         # falls back to JWT_SECRET at runtime

    # --- Seed data (first boot) ---
    ADMIN_EMAIL: str = "admin@shop-dev.com"
    ADMIN_DEFAULT_PASSWORD: str = "Admin#12345"
    SEED_DEMO_PRODUCTS: bool = True

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS_STR.split(",") if o.strip()]

    @property
    def webhook_secret(self) -> str:
        return self.PAYMENT_WEBHOOK_SECRET or self.JWT_SECRET


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
