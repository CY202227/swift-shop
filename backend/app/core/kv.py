"""KV abstraction: verification codes / cooldowns / rate limits.

Backends: memory (default, dev) and pg (durable). Redis can be added later
by implementing the same interface — zero business-code changes.
"""
from __future__ import annotations

import asyncio
import secrets
import time
from typing import Protocol

from app.core.config import settings


class KVError(Exception):
    pass


class BaseKV(Protocol):
    async def get(self, key: str) -> str | None: ...
    async def set(self, key: str, value: str, ttl_seconds: int | None = None) -> None: ...
    async def delete(self, key: str) -> None: ...
    async def incr_with_ttl(self, key: str, ttl_seconds: int) -> int:
        """Increment counter; first increment sets TTL. Returns new value."""
        ...


class MemoryKV:
    """In-process store. Single-worker dev default; values lost on restart."""

    def __init__(self) -> None:
        self._data: dict[str, tuple[str, float | None]] = {}  # key -> (value, expire_ts)
        self._lock = asyncio.Lock()

    def _alive(self, key: str) -> bool:
        item = self._data.get(key)
        if item is None:
            return False
        _, exp = item
        if exp is not None and exp <= time.time():
            self._data.pop(key, None)
            return False
        return True

    async def get(self, key: str) -> str | None:
        async with self._lock:
            if self._alive(key):
                return self._data[key][0]
            return None

    async def set(self, key: str, value: str, ttl_seconds: int | None = None) -> None:
        async with self._lock:
            exp = time.time() + ttl_seconds if ttl_seconds else None
            self._data[key] = (value, exp)

    async def delete(self, key: str) -> None:
        async with self._lock:
            self._data.pop(key, None)

    async def incr_with_ttl(self, key: str, ttl_seconds: int) -> int:
        async with self._lock:
            if self._alive(key):
                val, exp = self._data[key]
                val = str(int(val) + 1)
                self._data[key] = (val, exp)
            else:
                self._data[key] = ("1", time.time() + ttl_seconds)
            return int(self._data[key][0])


class PgKV:
    """Durable KV on a Postgres table (kv_store). Same semantics, survives restarts."""

    def __init__(self) -> None:
        from sqlalchemy import text
        from app.db.base import engine
        self._text = text
        self._engine = engine

    async def _exec(self, stmt, params: dict):
        from sqlalchemy.ext.asyncio import AsyncConnection
        async with self._engine.connect() as conn:  # type: AsyncConnection
            return await conn.execute(stmt, params)

    async def get(self, key: str) -> str | None:
        # delete-expired inline, then read
        await self._exec(self._text("DELETE FROM kv_store WHERE expires_at IS NOT NULL AND expires_at <= now()"), {})
        row = (await self._exec(self._text("SELECT value FROM kv_store WHERE key = :k"), {"k": key})).first()
        return row[0] if row else None

    async def set(self, key: str, value: str, ttl_seconds: int | None = None) -> None:
        await self._exec(
            self._text(
                "INSERT INTO kv_store (key, value, expires_at)"
                " VALUES (:k, :v, CASE WHEN :ttl IS NULL THEN NULL ELSE now() + make_interval(secs => :ttl) END)"
                " ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, expires_at = EXCLUDED.expires_at"
            ),
            {"k": key, "v": value, "ttl": ttl_seconds},
        )

    async def delete(self, key: str) -> None:
        await self._exec(self._text("DELETE FROM kv_store WHERE key = :k"), {"k": key})

    async def incr_with_ttl(self, key: str, ttl_seconds: int) -> int:
        await self.set(key, "0", ttl_seconds) if not await self.get(key) else None
        row = (await self._exec(self._text("UPDATE kv_store SET value = (COALESCE(value,'0')::int + 1)::text WHERE key = :k RETURNING value"), {"k": key})).first()
        return int(row[0])


_kv: BaseKV | None = None


def get_kv() -> BaseKV:
    global _kv
    if _kv is None:
        if settings.KV_BACKEND == "pg":
            _kv = PgKV()
        else:
            _kv = MemoryKV()
    return _kv


async def generate_code(prefix: str, length: int = 6, digits: bool = True) -> str:
    """Random numeric/digit code, e.g. email verification code."""
    if digits:
        return "".join(secrets.choice("0123456789") for _ in range(length))
    alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
    return prefix + "".join(secrets.choice(alphabet) for _ in range(length))
