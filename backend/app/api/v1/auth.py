"""Registration / login / Google OAuth / token refresh.

Anti-tampering rules applied here:
- invite requirement decided SERVER-side from system_settings, never from client flags
- invite code consumed atomically in SQL, immune to concurrent replay
- tokens carry role from DB at issue time; every request re-checks DB status
"""
from __future__ import annotations

import hmac
import secrets
from datetime import timedelta

import httpx
import jwt as pyjwt
from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import select, update

from app.core import kv
from app.core.config import settings
from app.core.deps import CurrentUser, DbDep
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    sha256_hex,
    verify_password,
)
from app.core.timeutil import naive_as_utc, utcnow
from app.models import InviteCode, OAuthAccount, RefreshToken, SystemSetting, User
from app.schemas import (
    AuthOut,
    GoogleAuthIn,
    LoginIn,
    RefreshIn,
    RegisterIn,
    ResendCodeIn,
    TokenPair,
    UserOut,
    VerifyEmailIn,
)
from app.services import mailer
from app.services.settings_service import get_setting_bool, set_setting

router = APIRouter(prefix="/auth", tags=["auth"])

CODE_TTL = 600          # 10 min
RESEND_COOLDOWN = 60    # 60s
CODE_KEY = "verify:{email}"
COOLDOWN_KEY = "cd:{email}"
RATE_KEY = "rate:{scope}:{id}"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"


async def _rate_limit(scope: str, identifier: str, limit: int = 10, window: int = 3600) -> None:
    n = await kv.get_kv().incr_with_ttl(RATE_KEY.format(scope=scope, id=identifier), window)
    if n > limit:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many attempts, try later")


async def _check_invite_requirement(db) -> bool:
    return await get_setting_bool(db, "invite_required", default=False)


async def _consume_invite_code(db, code: str) -> InviteCode:
    """Atomic consume; 0 affected rows => invalid/used-up/expired."""
    result = await db.execute(
        update(InviteCode)
        .where(
            InviteCode.code == code,
            InviteCode.status == "active",
            InviteCode.used_count < InviteCode.max_uses,
            (InviteCode.expires_at.is_(None)) | (InviteCode.expires_at > utcnow()),
        )
        .values(used_count=InviteCode.used_count + 1)
        .returning(InviteCode.id)
    )
    row = result.first()
    if row is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid, expired or used-up invite code")
    return await db.get(InviteCode, row[0])


def _issue_tokens(user: User) -> TokenPair:
    access = create_access_token(user.id, user.role)
    nonce = sha256_hex(access)  # bind refresh nonce to access token issuance
    refresh = create_refresh_token(user.id, nonce)
    return TokenPair(access_token=access, refresh_token=refresh)


async def _save_refresh_token(db, user_id: int, refresh_token: str) -> None:
    decode_token(refresh_token)  # validate shape before persisting
    db.add(RefreshToken(
        user_id=user_id,
        token_hash=sha256_hex(refresh_token),
        expires_at=utcnow().replace(microsecond=0) + timedelta(days=settings.REFRESH_TOKEN_DAYS),
    ))


@router.post("/register", status_code=status.HTTP_202_ACCEPTED)
async def register(body: RegisterIn, request: Request, db: DbDep) -> dict:
    """Step 1: validate + send verification code (account not created yet)."""
    client_ip = request.client.host if request.client else "unknown"
    await _rate_limit("register", client_ip, limit=10, window=3600)
    await _rate_limit("register", body.email.lower(), limit=5, window=3600)

    email = body.email.lower()
    if await db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Email already registered")

    # Invite pre-check at step 1 (fail fast); actual consume happens on verify
    if await _check_invite_requirement(db):
        if not body.invite_code:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invite code required")
        ic = await db.scalar(select(InviteCode).where(InviteCode.code == body.invite_code))
        if not ic or ic.status != "active" or ic.used_count >= ic.max_uses or (ic.expires_at and naive_as_utc(ic.expires_at) <= utcnow()):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid, expired or used-up invite code")

    # resend cooldown
    if await kv.get_kv().get(COOLDOWN_KEY.format(email=email)):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, detail="Please wait before resending")

    code = "".join(secrets.choice("0123456789") for _ in range(6))
    await kv.get_kv().set(CODE_KEY.format(email=email), f"{code}|{hash_password(body.password)}|{body.username}|{body.invite_code or ''}", ttl_seconds=CODE_TTL)
    await kv.get_kv().set(COOLDOWN_KEY.format(email=email), "1", ttl_seconds=RESEND_COOLDOWN)

    mailer.send_verification_code(email, code)
    return {"detail": "Verification code sent", "email": email}


@router.post("/verify-email", response_model=AuthOut)
async def verify_email(body: VerifyEmailIn, db: DbDep) -> AuthOut:
    """Step 2: check code -> create user -> tokens."""
    email = body.email.lower()
    raw = await kv.get_kv().get(CODE_KEY.format(email=email))
    if not raw:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Code expired or not requested")
    code, pw_hash, username, invite_code = (raw.split("|") + ["", "", "", ""])[:4]

    # Brute-force guard: 6-digit code with no attempt cap is enumerable
    # inside its TTL. 5 wrong tries burn the code entirely.
    attempts_key = f"vatt:{email}"
    attempts = await kv.get_kv().incr_with_ttl(attempts_key, CODE_TTL)
    if attempts > 5:
        await kv.get_kv().delete(CODE_KEY.format(email=email))
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many attempts, request a new code")
    if not hmac.compare_digest(str(code), str(body.code)):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Wrong verification code")

    invite = None
    if await _check_invite_requirement(db):
        if not invite_code:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invite code required")
        invite = await _consume_invite_code(db, invite_code)

    user = User(email=email, username=username, password_hash=pw_hash, email_verified=True, invite_code_id=invite.id if invite else None)
    db.add(user)
    await db.flush()
    await kv.get_kv().delete(CODE_KEY.format(email=email))

    pair = _issue_tokens(user)
    await _save_refresh_token(db, user.id, pair.refresh_token)
    return AuthOut(access_token=pair.access_token, refresh_token=pair.refresh_token, user=UserOut.model_validate(user))


@router.post("/resend-code", status_code=status.HTTP_202_ACCEPTED)
async def resend_code(body: ResendCodeIn, request: Request, db: DbDep) -> dict:
    client_ip = request.client.host if request.client else "unknown"
    await _rate_limit("resend", client_ip, limit=5, window=3600)
    raw = await kv.get_kv().get(CODE_KEY.format(email=body.email.lower()))
    if not raw:
        # Do not reveal whether the email is pending; generic message
        return {"detail": "If a pending registration exists, a new code was sent"}
    if await kv.get_kv().get(COOLDOWN_KEY.format(email=body.email.lower())):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, detail="Please wait before resending")
    code, pw_hash, username, invite_code = (raw.split("|") + ["", "", "", ""])[:4]
    new_code = "".join(secrets.choice("0123456789") for _ in range(6))
    await kv.get_kv().set(CODE_KEY.format(email=body.email.lower()), f"{new_code}|{pw_hash}|{username}|{invite_code}", ttl_seconds=CODE_TTL)
    await kv.get_kv().set(COOLDOWN_KEY.format(email=body.email.lower()), "1", ttl_seconds=RESEND_COOLDOWN)
    mailer.send_verification_code(body.email.lower(), new_code)
    return {"detail": "If a pending registration exists, a new code was sent"}


@router.post("/login", response_model=AuthOut)
async def login(body: LoginIn, request: Request, db: DbDep) -> AuthOut:
    client_ip = request.client.host if request.client else "unknown"
    await _rate_limit("login", client_ip, limit=20, window=900)
    await _rate_limit("login", body.email.lower(), limit=10, window=900)

    user = await db.scalar(select(User).where(User.email == body.email.lower()))
    generic = HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Wrong email or password")
    if user is None or not verify_password(body.password, user.password_hash or ""):
        raise generic
    if user.status != "active":
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Account disabled")

    pair = _issue_tokens(user)
    await _save_refresh_token(db, user.id, pair.refresh_token)
    return AuthOut(access_token=pair.access_token, refresh_token=pair.refresh_token, user=UserOut.model_validate(user))


@router.post("/google", response_model=AuthOut)
async def google_auth(body: GoogleAuthIn, request: Request, db: DbDep) -> AuthOut:
    """Exchange Google authorization code for session; bind/create local account."""
    client_ip = request.client.host if request.client else "unknown"
    await _rate_limit("google", client_ip, limit=20, window=900)

    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, detail="Google login not configured")

    async with httpx.AsyncClient(timeout=10) as client:
        token_resp = await client.post(GOOGLE_TOKEN_URL, data={
            "code": body.code,
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "redirect_uri": settings.GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code",
        })
        if token_resp.status_code != 200:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Google code exchange failed")
        access_token = token_resp.json().get("access_token")
        info_resp = await client.get(GOOGLE_USERINFO_URL, headers={"Authorization": f"Bearer {access_token}"})
    if info_resp.status_code != 200:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Failed to fetch Google profile")
    info = info_resp.json()
    g_sub, g_email = str(info.get("sub", "")), str(info.get("email", "")).lower()
    if not g_sub or not g_email:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Google profile incomplete")

    oauth = await db.scalar(select(OAuthAccount).where(OAuthAccount.provider == "google", OAuthAccount.provider_user_id == g_sub))
    if oauth:
        user = await db.get(User, oauth.user_id)
        if user is None or user.status != "active":
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Account disabled")
    else:
        user = await db.scalar(select(User).where(User.email == g_email))
        if user is None:
            # New account via Google; invite rules apply identically
            if await _check_invite_requirement(db):
                if not body.invite_code:
                    raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invite code required")
                invite = await _consume_invite_code(db, body.invite_code)
                user = User(email=g_email, username=info.get("name") or g_email.split("@")[0],
                            avatar_url=info.get("picture"), email_verified=True, invite_code_id=invite.id)
            else:
                user = User(email=g_email, username=info.get("name") or g_email.split("@")[0],
                            avatar_url=info.get("picture"), email_verified=True)
            db.add(user)
            await db.flush()
        db.add(OAuthAccount(user_id=user.id, provider="google", provider_user_id=g_sub))
        await db.flush()

    pair = _issue_tokens(user)
    await _save_refresh_token(db, user.id, pair.refresh_token)
    return AuthOut(access_token=pair.access_token, refresh_token=pair.refresh_token, user=UserOut.model_validate(user))


@router.post("/refresh", response_model=TokenPair)
async def refresh(body: RefreshIn, db: DbDep) -> TokenPair:
    try:
        payload = decode_token(body.refresh_token)
    except pyjwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    if payload.get("type") != "refresh":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Wrong token type")

    from app.core.timeutil import naive_as_utc  # noqa: F811  (kept for clarity)
    token_hash = sha256_hex(body.refresh_token)
    stored = await db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    now = utcnow()
    if stored is None or stored.revoked_at is not None or naive_as_utc(stored.expires_at) <= now:
        # Reuse of a revoked/rotated token => possible theft; kill all user sessions
        if stored is not None and stored.revoked_at is not None:
            await db.execute(
                update(RefreshToken).where(RefreshToken.user_id == stored.user_id).values(revoked_at=now)
            )
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Refresh token revoked")

    user = await db.get(User, stored.user_id)
    if user is None or user.status != "active":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="User disabled")

    # Rotate: revoke old, issue new pair
    stored.revoked_at = now
    pair = _issue_tokens(user)
    await _save_refresh_token(db, user.id, pair.refresh_token)
    return pair


@router.post("/logout")
async def logout(body: RefreshIn, db: DbDep) -> dict:
    token_hash = sha256_hex(body.refresh_token)
    stored = await db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    if stored and stored.revoked_at is None:
        stored.revoked_at = utcnow()
    return {"detail": "Logged out"}


@router.get("/me", response_model=UserOut)
async def me(user: CurrentUser) -> UserOut:
    return UserOut.model_validate(user)
