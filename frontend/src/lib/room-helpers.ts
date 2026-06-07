import { isDeadlineActive } from "@/lib/deadline";
import type {
  Participant,
  ParticipantRole,
  RoomSnapshot,
  RoomStatus,
  SubmissionSummary,
  User,
} from "@/types";

export function getMyParticipant(
  snapshot: RoomSnapshot | null,
  userId: number | undefined,
): Participant | undefined {
  if (!snapshot || !userId) return undefined;
  return snapshot.participants.find((p) => p.user_id === userId);
}

export function isHost(snapshot: RoomSnapshot | null, userId: number | undefined): boolean {
  const p = getMyParticipant(snapshot, userId);
  return p?.role === "host";
}

export function submissionId(sub: SubmissionSummary): number | undefined {
  return sub.submission_id ?? sub.id;
}

export function phaseLabel(status: RoomStatus): string {
  const labels: Record<RoomStatus, string> = {
    lobby: "Lobby",
    prompting: "Prompting",
    resolving: "Judging",
    results: "Results",
    finished: "Finished",
  };
  return labels[status] ?? status;
}

export function roomPhaseDisplay(snapshot: RoomSnapshot | null): {
  label: string;
  badgeVariant: RoomStatus | "default" | "finished";
} {
  if (!snapshot?.room) {
    return { label: "—", badgeVariant: "default" };
  }

  const status = snapshot.room.status;
  const submittedCount = snapshot.current_round?.submitted_count ?? 0;

  if (status === "resolving" && submittedCount === 0) {
    return { label: "Round ended", badgeVariant: "finished" };
  }

  return { label: phaseLabel(status), badgeVariant: status };
}

export function activityLabel(eventType: string, payload: Record<string, unknown>): string {
  switch (eventType) {
    case "room_created":
      return "Room created";
    case "player_joined":
      return `${payload.display_name ?? "Someone"} joined`;
    case "player_left":
      return `${payload.display_name ?? "Someone"} left`;
    case "round_started":
      return `Round started — ${payload.battle_theme ?? "battle"}`;
    case "prompt_submitted":
      return `${payload.display_name ?? "Player"} submitted a prompt`;
    case "round_locked":
      return "Submissions locked";
    case "round_completed":
      return "Round completed";
    case "submission_scored":
      return `Scored ${payload.score ?? "—"}/10`;
    case "winner_announced":
      return `${payload.display_name ?? "Winner"} won the battle`;
    default:
      return eventType.replace(/_/g, " ");
  }
}

export function participantName(
  participants: Participant[],
  userId: number,
): string {
  return (
    participants.find((p) => p.user_id === userId)?.display_name ?? `Player ${userId}`
  );
}

export function hasJudgeableSubmissions(
  snapshot: RoomSnapshot | null,
): boolean {
  if (!snapshot?.current_round) return false;
  return snapshot.current_round.submissions.some(
    (s) => s.status === "completed" && !!(s.campaign || s.ai_output),
  );
}

export function campaignsEmptyCopy(
  roomStatus: RoomStatus,
  submittedCount: number,
): { title: string; description: string } {
  if (
    (roomStatus === "resolving" || roomStatus === "results") &&
    submittedCount === 0
  ) {
    return {
      title: "No campaigns were submitted this round",
      description:
        "Submissions were locked with zero entries. There is nothing to score or select as winner.",
    };
  }

  if (roomStatus === "prompting" && submittedCount === 0) {
    return {
      title: "Waiting for submissions",
      description:
        "Participants can submit one prompt each while the round is open.",
    };
  }

  if (roomStatus === "resolving" && submittedCount > 0) {
    return {
      title: "Campaigns incoming",
      description:
        "Submissions are locked. Cards appear here as AI generation completes.",
    };
  }

  return {
    title: "No submissions yet",
    description: "Waiting for players to enter the arena.",
  };
}

export function canSubmit(
  snapshot: RoomSnapshot | null,
  user: User | null,
): boolean {
  if (!snapshot || !user) return false;
  const me = getMyParticipant(snapshot, user.id);
  if (!me || me.role === "host") return false;
  if (snapshot.room.status !== "prompting") return false;
  if (!snapshot.current_round || snapshot.current_round.status !== "open") return false;
  if (!isDeadlineActive(snapshot.current_round.prompt_deadline)) return false;
  const already = snapshot.current_round.submissions.some(
    (s) => s.user_id === user.id,
  );
  return !already;
}
