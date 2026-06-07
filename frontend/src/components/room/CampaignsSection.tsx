"use client";

import { CampaignCard, ResolvingSkeleton } from "@/components/room/CampaignCard";
import {
  campaignsEmptyCopy,
  hasJudgeableSubmissions,
  isHost,
} from "@/lib/room-helpers";
import type { RoomSnapshot, User } from "@/types";

export function CampaignsSection({
  snapshot,
  user,
  onScore,
  onSelectWinner,
  onRetry,
  scoring,
  selecting,
}: {
  snapshot: RoomSnapshot;
  user: User | null;
  onScore?: (submissionId: number, score: number) => void;
  onSelectWinner?: (submissionId: number) => void;
  onRetry?: (submissionId: number) => void;
  scoring?: boolean;
  selecting?: boolean;
}) {
  const round = snapshot.current_round!;
  const host = isHost(snapshot, user?.id);
  const submittedCount = round.submitted_count;
  const allowJudging =
    host &&
    snapshot.room.status === "resolving" &&
    hasJudgeableSubmissions(snapshot);

  if (
    snapshot.room.status === "resolving" &&
    round.submissions.length > 0 &&
    !hasJudgeableSubmissions(snapshot)
  ) {
    return <ResolvingSkeleton />;
  }

  if (round.submissions.length === 0) {
    const copy = campaignsEmptyCopy(snapshot.room.status, submittedCount);
    return (
      <div className="rounded-md border border-arena-border bg-arena-surface p-6 text-center">
        <p className="text-[15px] font-medium text-arena-text-secondary">
          {copy.title}
        </p>
        <p className="mx-auto mt-2 max-w-md text-[13px] text-arena-text-muted">
          {copy.description}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {round.submissions.map((sub) => (
        <CampaignCard
          key={sub.user_id}
          submission={sub}
          participants={snapshot.participants}
          roomStatus={snapshot.room.status}
          isHost={host}
          onScore={allowJudging ? onScore : undefined}
          onSelectWinner={allowJudging ? onSelectWinner : undefined}
          onRetry={onRetry && sub.user_id === user?.id ? onRetry : undefined}
          scoring={scoring}
          selecting={selecting}
        />
      ))}
    </div>
  );
}
