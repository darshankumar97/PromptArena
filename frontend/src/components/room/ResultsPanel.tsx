"use client";

import { Trophy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { api, ApiRequestError } from "@/lib/api";
import { isSessionExpiredError } from "@/lib/session-expired";
import { isHost } from "@/lib/room-helpers";
import { useAuthStore } from "@/stores/authStore";
import { useRoomStore } from "@/stores/roomStore";
import type { RoomSnapshot, SubmissionSummary, User } from "@/types";

function campaignText(sub: SubmissionSummary): string {
  if (sub.campaign?.campaign_text) return sub.campaign.campaign_text;
  if (sub.ai_output) return sub.ai_output;
  return "";
}

function rankedSubmissions(submissions: SubmissionSummary[]): SubmissionSummary[] {
  return [...submissions]
    .filter((s) => s.score != null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

export function ResultsPanel({
  snapshot,
  user,
}: {
  snapshot: RoomSnapshot;
  user: User | null;
}) {
  const router = useRouter();
  const token = useAuthStore((s) => s.accessToken);
  const setRoomError = useRoomStore((s) => s.setRoomError);
  const [ending, setEnding] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const round = snapshot.current_round;
  if (!round || snapshot.room.status !== "results") return null;

  const host = isHost(snapshot, user?.id);
  const ranked = rankedSubmissions(round.submissions);
  const winner = ranked.find((s) => s.is_winner) ?? ranked[0];
  const iWon = winner?.user_id === user?.id;

  const nameFor = (userId: number) =>
    snapshot.participants.find((p) => p.user_id === userId)?.display_name ??
    `Player ${userId}`;

  const endRoom = async () => {
    if (!token) return;
    setLocalError(null);
    setEnding(true);
    try {
      const res = await api.endRoom(token, snapshot.room.id);
      useRoomStore.getState().applySnapshot(res.snapshot);
      router.replace("/");
    } catch (e) {
      if (isSessionExpiredError(e)) return;
      const msg = e instanceof ApiRequestError ? e.message : "Could not end room";
      setLocalError(msg);
      setRoomError(msg);
    } finally {
      setEnding(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      {winner && (
        <div className="flex items-center gap-3 rounded-md border border-arena-accent/30 bg-arena-accent-subtle p-4">
          <Trophy className="h-5 w-5 shrink-0 text-arena-accent" aria-hidden />
          <p className="text-[17px] font-medium leading-[1.2] text-arena-text-primary">
            Winner: {nameFor(winner.user_id)}
            {iWon && (
              <span className="text-arena-accent"> — You!</span>
            )}
          </p>
          <span className="ml-auto font-mono text-[17px] text-arena-accent">
            {winner.score?.toFixed(1)}
          </span>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {ranked.map((sub, idx) => {
          const rank = idx + 1;
          const isYou = sub.user_id === user?.id;
          const isWinner = sub.is_winner || sub.user_id === round.winner_user_id;
          return (
            <div
              key={sub.user_id}
              className={`relative rounded-md border bg-arena-surface p-5 ${
                isWinner
                  ? "border-arena-border border-l-4 border-l-arena-accent"
                  : "border-arena-border"
              }`}
            >
              {isYou && (
                <Badge
                  variant="default"
                  className="absolute right-4 top-4"
                >
                  You
                </Badge>
              )}
              <div className="flex items-center gap-2 pr-12">
                <Badge variant={rank === 1 ? "winner" : "default"}>
                  #{rank}
                </Badge>
                <span className="text-[15px] font-medium text-arena-text-primary">
                  {nameFor(sub.user_id)}
                </span>
                <span className="ml-auto font-mono text-[15px] text-arena-accent">
                  {sub.score?.toFixed(1)}
                </span>
              </div>

              <div className="my-3 border-t border-arena-border" />

              <p className="text-[15px] leading-[1.7] text-arena-text-primary">
                {campaignText(sub)}
              </p>

              {sub.prompt_text && (
                <div className="mt-4">
                  <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-arena-text-muted">
                    Prompt:
                  </p>
                  <p className="mt-1 text-[13px] italic text-arena-text-secondary">
                    {sub.prompt_text}
                  </p>
                </div>
              )}

              {sub.judge_reason && (
                <div className="mt-4">
                  <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-arena-text-muted">
                    Judge:
                  </p>
                  <p className="mt-1 text-[13px] text-arena-text-secondary">
                    {sub.judge_reason}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="pt-2">
        {localError && (
          <Alert variant="error" className="mb-4">
            {localError}
          </Alert>
        )}
        {host ? (
          <div className="flex justify-end">
            <Button variant="danger" loading={ending} onClick={() => void endRoom()}>
              End Room
            </Button>
          </div>
        ) : (
          <p className="text-center text-[13px] text-arena-text-muted">
            Waiting for host to end the room…
          </p>
        )}
      </div>
    </div>
  );
}
