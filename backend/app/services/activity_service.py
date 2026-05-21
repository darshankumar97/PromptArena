from __future__ import annotations

from sqlalchemy import select

from app.enums import ActivityEventType
from app.models import ActivityEvent
from extensions import db


class ActivityService:
    @staticmethod
    def log(
        *,
        room_id: int,
        event_type: ActivityEventType,
        payload: dict | None = None,
        round_id: int | None = None,
        actor_user_id: int | None = None,
        commit: bool = False,
    ) -> ActivityEvent:
        event = ActivityEvent.build(
            room_id=room_id,
            event_type=event_type,
            payload=payload,
            round_id=round_id,
            actor_user_id=actor_user_id,
        )
        db.session.add(event)
        if commit:
            db.session.commit()
        return event

    @staticmethod
    def list_for_room(
        room_id: int,
        *,
        after_id: int = 0,
        limit: int = 50,
    ) -> list[ActivityEvent]:
        query = (
            db.session.query(ActivityEvent)
            .filter(ActivityEvent.room_id == room_id, ActivityEvent.id > after_id)
            .order_by(ActivityEvent.id.asc())
            .limit(min(limit, 100))
        )
        return query.all()

    @staticmethod
    def latest_for_room(room_id: int) -> ActivityEvent | None:
        return db.session.scalar(
            select(ActivityEvent)
            .where(ActivityEvent.room_id == room_id)
            .order_by(ActivityEvent.id.desc())
            .limit(1)
        )
