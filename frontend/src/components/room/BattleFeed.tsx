"use client";

import { CampaignsSection } from "@/components/room/CampaignsSection";
import { SubmissionForm } from "@/components/room/SubmissionForm";
import { Card } from "@/components/ui/Card";
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
    <main className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4 md:p-6">
      {round ? (
        <>
          <Card padding="lg">
            <p className="text-xs font-medium text-[var(--muted)]">Battle theme</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-[var(--foreground)]">
              {round.battle_theme}
            </h2>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-[var(--muted)]">
              <span>Round {round.round_number}</span>
              <span className="capitalize">{round.status}</span>
            </div>
          </Card>

          {showForm && (
            <SubmissionForm
              roomId={snapshot.room.id}
              roundId={round.id}
              onSubmitted={onRefresh}
            />
          )}

          {host && snapshot.room.status === "prompting" && (
            <p className="text-sm text-[var(--muted-foreground)]">
              You are the host. Lock submissions when players are ready.
            </p>
          )}

          <div className="space-y-4">
            <h2 className="text-xs font-medium text-[var(--muted)]">Campaigns</h2>
            <CampaignsSection
              snapshot={snapshot}
              user={user}
              onScore={handleScore}
              onSelectWinner={handleWinner}
              onRetry={handleRetry}
              scoring={actionLoading === "score"}
              selecting={actionLoading === "winner"}
            />
          </div>
        </>
      ) : (
        <Card padding="lg" className="text-center">
          <p className="text-sm text-[var(--muted-foreground)]">
            Waiting for the host to start the round.
          </p>
        </Card>
      )}
    </main>
  );
}
