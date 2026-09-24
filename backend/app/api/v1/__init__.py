"""V1 route aggregation."""
from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import (
    admin_dashboard,
    admin_invites,
    admin_orders,
    admin_products,
    admin_uploads,
    admin_users,
    auth,
    cart,
    orders,
    payments,
    products,
)

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(products.router)
api_router.include_router(cart.router)
api_router.include_router(orders.router)
api_router.include_router(payments.router)
api_router.include_router(admin_products.router)
api_router.include_router(admin_invites.router)
api_router.include_router(admin_users.router)
api_router.include_router(admin_orders.router)
api_router.include_router(admin_dashboard.router)
api_router.include_router(admin_uploads.router)
