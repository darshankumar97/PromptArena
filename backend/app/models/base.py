from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, func
from sqlalchemy.orm import Mapped, mapped_column

from extensions import db


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def assume_utc(dt: datetime | None) -> datetime | None:
    """SQLite often returns naive datetimes; treat them as UTC for comparisons."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
        server_default=func.now(),
        nullable=False,
    )


class BaseModel(db.Model):
    __abstract__ = True

    id: Mapped[int] = mapped_column(primary_key=True)
