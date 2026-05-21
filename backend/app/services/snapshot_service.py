from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import joinedload

from app.enums import RoomStatus, RoundStatus, SubmissionStatus
from app.errors import NotFoundError
from app.models import ActivityEvent, Round, Room, Submission
from app.services.room_service import RoomService
from extensions import db


class SnapshotService:
    """Build synchronized room snapshots for REST + Socket.IO."""

    @staticmethod
    def prompts_are_public(room: Room, current: Round | None) -> bool:
        if current is None:
            return False
        return (
            current.status == RoundStatus.COMPLETE
            or room.status == RoomStatus.RESULTS
        )

    @staticmethod
    def build(room_id: int, viewer_user_id: int | None) -> dict:
        """viewer_user_id None => broadcast-safe snapshot (no other players' prompts until public)."""
        room = db.session.scalar(select(Room).where(Room.id == room_id))
        if room is None:
            raise NotFoundError("Room not found", code="ROOM_NOT_FOUND")

        participants = RoomService.list_active_participants(room_id)

        current: Round | None = None
        if room.current_round_id:
            current = db.session.scalar(
                select(Round)
                .options(
                    joinedload(Round.submissions).joinedload(Submission.generation_job),
                )
                .where(Round.id == room.current_round_id)
            )

        revealed = SnapshotService.prompts_are_public(room, current)
        judging_phase = room.status in (RoomStatus.RESOLVING, RoomStatus.RESULTS)

        submissions_out: list[dict] = []
        submitted_count = 0
        if current:
            ordered = sorted(current.submissions, key=lambda s: s.user_id)
            submitted_count = len(ordered)
            broadcast_mode = viewer_user_id is None

            for sub in ordered:
                if revealed:
                    submissions_out.append(
                        SnapshotService._submission_payload(
                            sub,
                            reveal_prompt=True,
                            winner_user_id=current.winner_user_id,
                        )
                    )
                elif sub.status == SubmissionStatus.COMPLETED and judging_phase:
                    submissions_out.append(
                        SnapshotService._submission_payload(
                            sub,
                            reveal_prompt=False,
                            winner_user_id=current.winner_user_id,
                            include_campaign=True,
                        )
                    )
                elif broadcast_mode:
                    entry = SnapshotService._submission_summary(
                        sub, winner_user_id=current.winner_user_id
                    )
                    submissions_out.append(entry)
                else:
                    if sub.user_id == viewer_user_id:
                        submissions_out.append(
                            SnapshotService._submission_payload(
                                sub,
                                reveal_prompt=True,
                                winner_user_id=current.winner_user_id,
                            )
                        )
                    else:
                        entry = SnapshotService._submission_summary(
                            sub, winner_user_id=current.winner_user_id
                        )
                        if sub.status == SubmissionStatus.COMPLETED and judging_phase:
                            entry.update(
                                SnapshotService._campaign_fields(sub),
                            )
                        submissions_out.append(entry)

        current_round_payload = None
        if current:
            current_round_payload = {
                "id": current.id,
                "room_id": current.room_id,
                "round_number": current.round_number,
                "status": current.status.value,
                "battle_theme": current.battle_theme,
                "prompt_deadline": current.prompt_deadline.isoformat()
                if current.prompt_deadline
                else None,
                "winner_user_id": current.winner_user_id,
                "resolved_at": current.resolved_at.isoformat()
                if current.resolved_at
                else None,
                "created_at": current.created_at.isoformat(),
                "submissions": submissions_out,
                "submitted_count": submitted_count,
                "prompts_revealed": revealed,
            }

        cursor = db.session.scalar(
            select(func.max(ActivityEvent.id)).where(ActivityEvent.room_id == room_id)
        )
        activity_cursor = int(cursor or 0)

        return {
            "room": room.to_dict(),
            "participants": [p.to_dict() for p in participants],
            "current_round": current_round_payload,
            "activity_cursor": activity_cursor,
        }

    @staticmethod
    def _submission_summary(sub, *, winner_user_id: int | None) -> dict:
        entry = {
            "user_id": sub.user_id,
            "submitted": True,
            "status": sub.status.value,
            "submission_id": sub.id,
        }
        if sub.score is not None:
            entry["score"] = sub.score
        if winner_user_id is not None and sub.user_id == winner_user_id:
            entry["is_winner"] = True
        if sub.generation_job is not None:
            entry["generation_job"] = sub.generation_job.to_dict()
        return entry

    @staticmethod
    def _campaign_fields(sub) -> dict:
        fields: dict = {}
        campaign = sub.get_ai_output_parsed()
        if campaign is not None:
            fields["campaign"] = campaign
        elif sub.ai_output:
            fields["ai_output"] = sub.ai_output
        return fields

    @staticmethod
    def _submission_payload(
        sub,
        *,
        reveal_prompt: bool,
        winner_user_id: int | None,
        include_campaign: bool = True,
    ) -> dict:
        payload = sub.to_dict(reveal_prompt=reveal_prompt)
        if winner_user_id is not None and sub.user_id == winner_user_id:
            payload["is_winner"] = True
        if not include_campaign:
            payload.pop("campaign", None)
            payload.pop("ai_output", None)
        return payload
