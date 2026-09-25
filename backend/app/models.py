"""SQLAlchemy models. All money stored as integer cents to avoid float drift."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.timeutil import utcnow
from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    username: Mapped[str] = mapped_column(String(64), nullable=False)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)  # null for OAuth-only
    avatar_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    role: Mapped[str] = mapped_column(String(16), default="user", nullable=False)  # user | admin | super_admin
    status: Mapped[str] = mapped_column(String(16), default="active", nullable=False)  # active | disabled
    # personal discount granted by an admin (0-99, integer percent), applied on top
    # of product/promotion discounts at checkout
    discount_percent: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    invite_code_id: Mapped[int | None] = mapped_column(ForeignKey("invite_codes.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    oauth_accounts: Mapped[list["OAuthAccount"]] = relationship(back_populates="user")
    orders: Mapped[list["Order"]] = relationship(back_populates="user")


class OAuthAccount(Base):
    __tablename__ = "oauth_accounts"
    __table_args__ = (UniqueConstraint("provider", "provider_user_id", name="uq_oauth_provider_uid"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    provider: Mapped[str] = mapped_column(String(32), nullable=False)  # google
    provider_user_id: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user: Mapped[User] = relationship(back_populates="oauth_accounts")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)  # sha256 of raw token
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class SystemSetting(Base):
    __tablename__ = "system_settings"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[str] = mapped_column(JSON, nullable=False)


class InviteCode(Base):
    __tablename__ = "invite_codes"
    __table_args__ = (
        CheckConstraint("max_uses >= 1", name="ck_invite_max_uses"),
        CheckConstraint("used_count >= 0", name="ck_invite_used_count"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    max_uses: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    used_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="active", nullable=False)  # active | revoked
    remark: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    slug: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    stock: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    images: Mapped[list] = mapped_column(JSON, default=list, nullable=False)  # list of URLs / object keys
    status: Mapped[str] = mapped_column(String(16), default="draft", nullable=False)  # draft|active|retired
    # per-product discount (0-100, integer percent). 0 = no discount.
    # Stacks with an active Promotion as: final = price * (1 - product%) * (1 - promo%)
    discount_percent: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class Promotion(Base):
    """Site-wide campaign created by super_admin (e.g. 20% off everything, or buy-N-get-1)."""
    __tablename__ = "promotions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    kind: Mapped[str] = mapped_column(String(16), default="percent_off", nullable=False)  # percent_off | buy_n_get_1
    value: Mapped[int] = mapped_column(Integer, default=0, nullable=False)                # percent for percent_off; N for buy_n_get_1
    status: Mapped[str] = mapped_column(String(16), default="active", nullable=False)     # active | ended
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class CartItem(Base):
    __tablename__ = "cart_items"
    __table_args__ = (UniqueConstraint("user_id", "product_id", name="uq_cart_user_product"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    qty: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_no: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(24), default="pending_payment", nullable=False)
    # money snapshots: subtotal = after product/promotion discounts (incl. buy-N-get-1),
    # discount_cents = extra personal-discount amount, total = subtotal - discount
    subtotal_cents: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    discount_cents: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    promotion_id: Mapped[int | None] = mapped_column(ForeignKey("promotions.id"), nullable=True)
    promotion_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    total_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    # shipping snapshot captured at checkout time (delivery info)
    recipient_name: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    recipient_phone: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    address: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    items: Mapped[list["OrderItem"]] = relationship(back_populates="order", cascade="all, delete-orphan")
    payments: Mapped[list["Payment"]] = relationship(back_populates="order")
    user: Mapped[User] = relationship(back_populates="orders")


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), nullable=False, index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(128), nullable=False)          # snapshot at purchase time
    unit_price_cents: Mapped[int] = mapped_column(Integer, nullable=False)   # snapshot, server-side price
    qty: Mapped[int] = mapped_column(Integer, nullable=False)
    original_price_cents: Mapped[int] = mapped_column(Integer, nullable=False, default=0)  # list price snapshot
    line_total_cents: Mapped[int] = mapped_column(Integer, nullable=False, default=0)     # effective unit * qty

    order: Mapped["Order"] = relationship(back_populates="items")


class Payment(Base):
    __tablename__ = "payments"
    __table_args__ = (Index("ix_payments_provider_event", "provider", "provider_event_id", unique=True),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), nullable=False, index=True)
    provider: Mapped[str] = mapped_column(String(32), nullable=False)          # mock | stripe | ...
    provider_trade_no: Mapped[str | None] = mapped_column(String(128), nullable=True)
    provider_event_id: Mapped[str | None] = mapped_column(String(128), nullable=True)  # webhook idempotency
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(24), default="created", nullable=False)  # created|succeeded|failed
    raw_payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)     # audit original webhook body
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    order: Mapped[Order] = relationship(back_populates="payments")


class ExportLog(Base):
    __tablename__ = "export_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    admin_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    resource: Mapped[str] = mapped_column(String(32), default="orders", nullable=False)
    filters: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    fmt: Mapped[str] = mapped_column(String(8), default="csv", nullable=False)
    row_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class KVStore(Base):
    """Backing table for the PG KV backend (codes / cooldowns / counters)."""

    __tablename__ = "kv_store"

    key: Mapped[str] = mapped_column(String(128), primary_key=True)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
