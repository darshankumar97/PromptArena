"use client";

import { CampaignsSection } from "@/components/room/CampaignsSection";
import { SubmissionForm } from "@/components/room/SubmissionForm";
import { api, ApiRequestError } from "@/lib/api";
import { isSessionExpiredError } from "@/lib/session-expired";
import { canSubmit, isHost } from "@/lib/room-helpers";
import { useAuthStore } from "@/stores/authStore";
import { useRoomStore } from "@/stores/roomStore";
import type { RoomSnapshot } from "@/types";

export function BattleFeed({
  snapshot,
  onRefresh,
}: {
  snapshot: RoomSnapshot;
  onRefresh: () => void;
}) {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.accessToken);
  const setRoomError = useRoomStore((s) => s.setRoomError);
  const setActionLoading = useRoomStore((s) => s.setActionLoading);
  const actionLoading = useRoomStore((s) => s.actionLoading);

  const round = snapshot.current_round;
  const host = isHost(snapshot, user?.id);
  const showForm = canSubmit(snapshot, user);

  const handleScore = async (submissionId: number, score: number) => {
    if (!token) return;
    setActionLoading("score");
    try {
      const res = await api.scoreSubmission(
        token,
        snapshot.room.id,
        submissionId,
        score,
      );
      useRoomStore.getState().applySnapshot(res.snapshot);
    } catch (e) {
      if (isSessionExpiredError(e)) return;
      setRoomError(e instanceof ApiRequestError ? e.message : "Score failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleWinner = async (submissionId: number) => {
    if (!token || !round) return;
    setActionLoading("winner");
    try {
      const res = await api.selectWinner(
        token,
        snapshot.room.id,
        round.id,
        submissionId,
      );
      useRoomStore.getState().applySnapshot(res.snapshot);
    } catch (e) {
      if (isSessionExpiredError(e)) return;
      setRoomError(
        e instanceof ApiRequestError ? e.message : "Could not select winner",
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleRetry = async (submissionId: number) => {
    if (!token) return;
    setActionLoading("retry");
    try {
      const res = await api.retryGeneration(
        token,
        snapshot.room.id,
        submissionId,
      );
      useRoomStore.getState().applySnapshot(res.snapshot);
    } catch (e) {
      if (isSessionExpiredError(e)) return;
      setRoomError(e instanceof ApiRequestError ? e.message : "Retry failed");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-6">
      {round ? (
        <>
          <div className="rounded-xl border border-zinc-800/60 bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 p-6">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Battle theme
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50">
              {round.battle_theme}
            </h2>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-zinc-500">
              <span>Round {round.round_number}</span>
              <span className="capitalize">Round: {round.status}</span>
            </div>
          </div>

          {showForm && (
            <SubmissionForm
              roomId={snapshot.room.id}
              roundId={round.id}
              onSubmitted={onRefresh}
            />
          )}

          {host && snapshot.room.status === "prompting" && (
            <p className="rounded-lg border border-zinc-800/60 bg-zinc-900/30 px-4 py-3 text-sm text-zinc-500">
              You are the host — guide the room and lock submissions when ready.
            </p>
          )}

          <CampaignsSection
            snapshot={snapshot}
            user={user}
            onScore={handleScore}
            onSelectWinner={handleWinner}
            onRetry={handleRetry}
            scoring={actionLoading === "score"}
            selecting={actionLoading === "winner"}
          />
        </>
      ) : (
        <p className="text-sm text-zinc-500">
          Waiting for the host to start the battle…
        </p>
      )}
    </main>
  );
}
