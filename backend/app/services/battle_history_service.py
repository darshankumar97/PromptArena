from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import joinedload

from app.enums import RoundStatus
from app.models import Participant, Room, Round, Submission, User
from extensions import db


class BattleHistoryService:
    @staticmethod
    def list_my_battles(user_id: int, *, limit: int = 50) -> list[dict]:
        rows = db.session.scalars(
            select(Round)
            .join(Room, Round.room_id == Room.id)
            .join(Participant, Participant.room_id == Room.id)
            .where(
                Participant.user_id == user_id,
                Participant.left_at.is_(None),
                Round.status == RoundStatus.COMPLETE,
            )
            .options(
                joinedload(Round.room),
                joinedload(Round.submissions).joinedload(Submission.user),
            )
            .order_by(Round.resolved_at.desc())
            .limit(limit)
        ).unique().all()

        seen_rooms: set[int] = set()
        results: list[dict] = []
        for round_ in rows:
            if round_.room_id in seen_rooms:
                continue
            seen_rooms.add(round_.room_id)
            results.append(BattleHistoryService._my_battle_item(round_, user_id))
        return results

    @staticmethod
    def list_admin_battles(*, limit: int = 100) -> list[dict]:
        rows = db.session.scalars(
            select(Round)
            .where(Round.status == RoundStatus.COMPLETE)
            .options(
                joinedload(Round.room),
                joinedload(Round.submissions).joinedload(Submission.user),
            )
            .order_by(Round.resolved_at.desc())
            .limit(limit)
        ).unique().all()

        seen_rooms: set[int] = set()
        results: list[dict] = []
        for round_ in rows:
            if round_.room_id in seen_rooms:
                continue
            seen_rooms.add(round_.room_id)
            results.append(BattleHistoryService._admin_battle_item(round_))
        return results

    @staticmethod
    def list_admin_users(*, limit: int = 200) -> list[dict]:
        users = db.session.scalars(
            select(User).order_by(User.created_at.desc()).limit(limit)
        ).unique().all()
        out: list[dict] = []
        for user in users:
            battle_count = db.session.scalar(
                select(func.count())
                .select_from(Participant)
                .where(Participant.user_id == user.id)
            ) or 0
            wins = db.session.scalar(
                select(func.count()).select_from(Round).where(Round.winner_user_id == user.id)
            ) or 0
            out.append(
                {
                    "id": user.id,
                    "display_name": user.display_name,
                    "is_admin": bool(user.is_admin),
                    "created_at": user.created_at.isoformat(),
                    "battle_count": int(battle_count),
                    "wins": int(wins),
                }
            )
        return out

    @staticmethod
    def _rank_for_user(submissions: list[Submission], user_id: int) -> tuple[float | None, int | None]:
        scored = [s for s in submissions if s.score is not None]
        if not scored:
            return None, None
        ordered = sorted(scored, key=lambda s: (-s.score, s.user_id))
        my_score = next((s.score for s in scored if s.user_id == user_id), None)
        ranks = {s.user_id: idx + 1 for idx, s in enumerate(ordered)}
        return my_score, ranks.get(user_id)

    @staticmethod
    def _my_battle_item(round_: Round, user_id: int) -> dict:
        room = round_.room
        submissions = list(round_.submissions)
        my_score, my_rank = BattleHistoryService._rank_for_user(submissions, user_id)
        winner = db.session.get(User, round_.winner_user_id) if round_.winner_user_id else None
        player_count = db.session.scalar(
            select(func.count())
            .select_from(Participant)
            .where(Participant.room_id == room.id)
        ) or 0
        played_at = round_.resolved_at or round_.created_at
        return {
            "room_id": room.id,
            "room_code": room.code,
            "battle_theme": round_.battle_theme,
            "played_at": played_at.isoformat(),
            "my_score": my_score,
            "my_rank": my_rank,
            "total_players": int(player_count),
            "winner_display_name": winner.display_name if winner else "",
            "i_won": round_.winner_user_id == user_id,
            "round_status": round_.status.value,
        }

    @staticmethod
    def _admin_battle_item(round_: Round) -> dict:
        room = round_.room
        submissions = list(round_.submissions)
        scored = sorted(
            [s for s in submissions if s.score is not None],
            key=lambda s: (-s.score, s.user_id),
        )
        ranks = {s.id: idx + 1 for idx, s in enumerate(scored)}
        winner = db.session.get(User, round_.winner_user_id) if round_.winner_user_id else None
        winner_sub = next((s for s in submissions if s.user_id == round_.winner_user_id), None)
        player_count = db.session.scalar(
            select(func.count())
            .select_from(Participant)
            .where(Participant.room_id == room.id)
        ) or 0
        played_at = round_.resolved_at or round_.created_at

        sub_rows = []
        for sub in submissions:
            user = sub.user or db.session.get(User, sub.user_id)
            output = sub.get_ai_output_parsed()
            ai_text = ""
            if output:
                ai_text = output.get("campaign_text") or output.get("raw") or str(output)
            elif sub.ai_output:
                ai_text = sub.ai_output
            sub_rows.append(
                {
                    "display_name": user.display_name if user else f"User {sub.user_id}",
                    "prompt_text": sub.prompt_text,
                    "ai_output": ai_text,
                    "score": sub.score or 0,
                    "judge_reason": sub.judge_reason or "",
                    "rank": ranks.get(sub.id, len(scored) + 1),
                }
            )

        return {
            "room_id": room.id,
            "room_code": room.code,
            "battle_theme": round_.battle_theme,
            "played_at": played_at.isoformat(),
            "total_players": int(player_count),
            "winner_display_name": winner.display_name if winner else "",
            "winner_score": winner_sub.score if winner_sub and winner_sub.score is not None else 0,
            "submissions": sub_rows,
        }
