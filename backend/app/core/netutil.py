"""Real-client-IP resolution for rate limiting behind reverse proxies.

Security model
--------------
`request.client.host` is the *direct TCP peer*. Behind nginx/traefik that is
always the proxy, so every visitor shares one rate-limit bucket — and the
bucket caps are effectively per-proxy, not per-attacker.

The fix is X-Forwarded-For, but the header is client-appendable: a hostile
client can send `X-Forwarded-For: 1.2.3.4` and the proxy *appends* the real
IP, yielding `1.2.3.4, <real>`. Positions from the right are written by
proxies we control; positions from the left are attacker-controlled.

`real_client_ip()` therefore takes the entry TRUST_PROXY_DEPTH hops from the
RIGHT. With depth correctly configured (nginx = 1, nginx+CDN = 2) this is
unspoofable: the attacker only controls entries our trusted proxies shift
further left. With depth 0 (direct exposure, dev default) the header is
ignored entirely and the TCP peer is used.
"""
from __future__ import annotations

from fastapi import Request

from app.core.config import settings


def real_client_ip(request: Request) -> str:
    """Rate-limit key IP: unspoofable real client address."""
    depth = settings.TRUST_PROXY_DEPTH
    if depth <= 0:
        # Direct exposure: XFF is client-controlled, must not drive limits
        return request.client.host if request.client else "unknown"

    xff = request.headers.get("x-forwarded-for", "")
    if not xff:
        return request.client.host if request.client else "unknown"

    # "spoofed, spoofed, real" (rightmost entries appended by our proxies)
    hops = [h.strip() for h in xff.split(",") if h.strip()]
    idx = len(hops) - depth  # depth hops from the right
    if idx < 0:
        # Fewer XFF entries than trusted proxies — malformed, fall back safe
        return request.client.host if request.client else "unknown"
    return hops[idx]
