"""Shared time helpers: timezone-aware UTC datetime + naive/aware normalization.

Why naive_as_utc exists: SQLite ignores DateTime(timezone=True) and always
returns naive datetimes, while utcnow() returns aware ones. Comparing the
two raises TypeError("can't compare offset-naive and offset-aware
datetimes"). Every Python-level comparison against DB values must go
through naive_as_utc().
"""
from __future__ import annotations

from datetime import datetime, timezone


def utcnow() -> datetime:
    # SQLAlchemy DateTime(timezone=True) needs aware datetimes
    return datetime.now(timezone.utc)


def naive_as_utc(dt: datetime) -> datetime:
    """Assume naive datetimes (SQLite reads) are UTC; make them aware."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt
