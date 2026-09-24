"""Pydantic schemas (request/response DTOs). Strict: unknown fields rejected."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

PasswordType = Literal  # re-export convenience


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")


# ---------- Auth ----------
class RegisterIn(ORMModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    username: str = Field(min_length=2, max_length=64, pattern=r"^[\w\u4e00-\u9fa5-]+$")
    invite_code: str | None = None


class VerifyEmailIn(ORMModel):
    email: EmailStr
    code: str = Field(min_length=4, max_length=8)


class ResendCodeIn(ORMModel):
    email: EmailStr


class LoginIn(ORMModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)


class GoogleAuthIn(ORMModel):
    code: str = Field(min_length=10)
    invite_code: str | None = None


class RefreshIn(ORMModel):
    refresh_token: str = Field(min_length=20)


class TokenPair(ORMModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserOut(ORMModel):
    id: int
    email: EmailStr
    username: str
    avatar_url: str | None
    role: str
    status: str
    email_verified: bool
    created_at: datetime


class AuthOut(TokenPair):
    user: UserOut


# ---------- Products ----------
class ProductOut(ORMModel):
    id: int
    name: str
    slug: str
    description: str | None
    price_cents: int
    stock: int
    images: list
    status: str
    discount_percent: int = 0
    created_at: datetime


class ProductPageOut(ORMModel):
    items: list[ProductOut]
    total: int
    page: int
    pages: int


class ProductAdminIn(ORMModel):
    name: str = Field(min_length=1, max_length=128)
    slug: str = Field(min_length=1, max_length=128, pattern=r"^[a-z0-9-]+$")
    description: str | None = None
    price_cents: int = Field(ge=1, le=10_000_000_00)
    stock: int = Field(ge=0)
    images: list[str] = Field(default_factory=list, max_length=9)


class ProductPatchIn(ORMModel):
    name: str | None = Field(default=None, min_length=1, max_length=128)
    slug: str | None = Field(default=None, min_length=1, max_length=128, pattern=r"^[a-z0-9-]+$")
    description: str | None = None
    price_cents: int | None = Field(default=None, ge=1)
    stock: int | None = Field(default=None, ge=0)
    images: list[str] | None = Field(default=None, max_length=9)
    discount_percent: int | None = Field(default=None, ge=0, le=100)


# ---------- Cart ----------
class CartAddIn(ORMModel):
    product_id: int = Field(ge=1)
    qty: int = Field(ge=1, le=99)


class CartPatchIn(ORMModel):
    qty: int = Field(ge=1, le=99)


class CartItemOut(ORMModel):
    id: int
    product_id: int
    name: str
    slug: str
    price_cents: int
    stock: int
    images: list
    qty: int
    subtotal_cents: int
    product_discount_percent: int = 0
    effective_unit_cents: int = 0   # after product% + promotion% (pre buy-N-free, pre personal%)


class PromotionBrief(ORMModel):
    id: int
    name: str
    kind: str   # percent_off | buy_n_get_1
    value: int  # percent, or N for buy-N-get-1


class CartOut(ORMModel):
    items: list[CartItemOut]
    total_cents: int            # final: after promotion + personal discount
    subtotal_cents: int = 0    # after promotion, before personal discount
    user_discount_percent: int = 0
    user_discount_cents: int = 0
    promotion: PromotionBrief | None = None


# ---------- Orders ----------
class OrderCreateIn(ORMModel):
    # items chosen server-side from the user's cart; client totals are ignored
    note: str | None = Field(default=None, max_length=255)


class OrderItemOut(ORMModel):
    product_id: int
    title: str
    unit_price_cents: int
    qty: int


class OrderOut(ORMModel):
    id: int
    order_no: str
    status: str
    total_cents: int
    paid_at: datetime | None
    created_at: datetime
    items: list[OrderItemOut]


class OrderPageOut(ORMModel):
    items: list[OrderOut]
    total: int
    page: int
    pages: int


class PayIn(ORMModel):
    provider: str = "mock"  # adapter registry decides what is actually supported


class PayOut(ORMModel):
    payment_id: int
    provider: str
    status: str
    pay_url: str | None
    order_no: str


# ---------- Invites ----------
class InviteCreateIn(ORMModel):
    count: int = Field(default=1, ge=1, le=100)
    max_uses: int = Field(default=1, ge=1, le=10_000)
    expires_days: int | None = Field(default=None, ge=1, le=365)
    remark: str | None = Field(default=None, max_length=255)


class InviteOut(ORMModel):
    id: int
    code: str
    max_uses: int
    used_count: int
    expires_at: datetime | None
    status: str
    remark: str | None
    created_at: datetime


class InvitePageOut(ORMModel):
    items: list[InviteOut]
    total: int


class InviteRevokeIn(ORMModel):
    status: Literal["active", "revoked"]


# ---------- Settings ----------
class SettingsOut(ORMModel):
    invite_required: bool
    shop_name: str = "PTCG Shop"
    promotion: "PromotionBrief | None" = None


class SettingsPatchIn(ORMModel):
    invite_required: bool | None = None
    shop_name: str | None = Field(default=None, min_length=1, max_length=64)


# ---------- Admin users ----------
class AdminUserOut(ORMModel):
    id: int
    email: EmailStr
    username: str
    role: str
    status: str
    discount_percent: int = 0
    invite_code_id: int | None
    created_at: datetime


class UserPatchIn(ORMModel):
    status: Literal["active", "disabled"] | None = None
    role: Literal["user", "admin", "super_admin"] | None = None
    discount_percent: int | None = Field(default=None, ge=0, le=99)


# ---------- Promotions (super_admin) ----------
class PromotionIn(ORMModel):
    name: str = Field(min_length=1, max_length=128)
    kind: Literal["percent_off", "buy_n_get_1"]
    value: int = Field(ge=1, le=100)
    ends_days: int | None = Field(default=None, ge=1, le=365)


class PromotionOut(ORMModel):
    id: int
    name: str
    kind: str
    value: int
    status: str
    starts_at: datetime
    ends_at: datetime | None
    created_at: datetime


# ---------- Revenue (super_admin) ----------
class RevenuePoint(ORMModel):
    date: str          # YYYY-MM-DD
    revenue_cents: int


class RevenueOut(ORMModel):
    # realized = paid orders; expected = pending_payment orders (预估但未落账)
    realized_cents: int       # sum(paid orders.total)
    expected_cents: int       # sum(pending_payment orders.total)
    currency: str = "CNY"
    series: list[RevenuePoint]  # realized revenue per day (last 30 days)


class AdminOrderOut(ORMModel):
    id: int
    order_no: str
    user_id: int
    user_email: str | None = None
    status: str
    total_cents: int
    paid_at: datetime | None
    created_at: datetime
    items: list[OrderItemOut]


# ---------- Stats ----------
class DashboardOut(ORMModel):
    users_total: int
    products_total: int
    products_active: int
    orders_total: int
    orders_paid: int
    revenue_cents: int
    pending_payment: int
