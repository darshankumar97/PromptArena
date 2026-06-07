"use client";

import { CampaignsSection } from "@/components/room/CampaignsSection";
import { HostControls } from "@/components/room/HostControls";
import { ResultsPanel } from "@/components/room/ResultsPanel";
import { SubmissionForm } from "@/components/room/SubmissionForm";
import { CountdownTimer } from "@/components/CountdownTimer";
import { Alert } from "@/components/ui/Alert";
import { isDeadlineActive } from "@/lib/deadline";
import { api, ApiRequestError } from "@/lib/api";
import { isSessionExpiredError } from "@/lib/session-expired";
import { canSubmit, isHost } from "@/lib/room-helpers";
import { useAuthStore } from "@/stores/authStore";
import { useRoomStore } from "@/stores/roomStore";
import type { RoomSnapshot } from "@/types";

function WaitingDot() {
  return (
    <span
      className="inline-block h-2 w-2 animate-waiting-dot rounded-full bg-arena-accent"
      aria-hidden
    />
  );
}

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
  const room = snapshot.room;

  const mySubmission = round?.submissions.find((s) => s.user_id === user?.id);
  const hasSubmitted = Boolean(mySubmission?.submitted);

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

  if (snapshot.room.status === "results" && round) {
    return (
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 md:p-6">
        <ResultsPanel snapshot={snapshot} user={user} />
      </main>
    );
  }

  const showTimer =
    snapshot.room.status === "prompting" &&
    round?.prompt_deadline &&
    isDeadlineActive(round.prompt_deadline);

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="flex items-start justify-between gap-4 border-b border-arena-border px-4 py-4 md:px-6">
        <h1 className="text-[22px] font-medium leading-[1.2] text-arena-text-primary">
          {round?.battle_theme ?? "Battle Room"}
        </h1>
        {showTimer && round?.prompt_deadline && (
          <CountdownTimer deadline={round.prompt_deadline} />
        )}
      </div>

      <div className="flex flex-1 flex-col items-center px-4 py-8 md:px-6">
        {room.status === "lobby" && !round && (
          <div className="flex w-full max-w-md flex-col items-center text-center">
            <p className="font-mono text-[30px] font-medium tracking-[0.3em] text-arena-text-primary">
              {room.code}
            </p>
            <p className="mt-3 text-[13px] text-arena-text-muted">
              Share this code to invite players
            </p>
            <div className="my-8 w-full border-t border-arena-border" />
            {host ? (
              <HostControls
                snapshot={snapshot}
                onRefresh={onRefresh}
                variant="center"
              />
            ) : (
              <p className="flex items-center gap-2 text-[13px] text-arena-text-muted">
                <WaitingDot />
                Waiting for host to start…
              </p>
            )}
          </div>
        )}

        {round && room.status !== "lobby" && (
          <div className="w-full max-w-3xl space-y-8">
            {showForm && (
              <SubmissionForm
                roomId={snapshot.room.id}
                roundId={round.id}
                deadline={round.prompt_deadline}
                onSubmitted={onRefresh}
              />
            )}

            {room.status === "prompting" && hasSubmitted && !showForm && (
              <div className="rounded-md border border-arena-success/30 bg-arena-success-subtle p-4 text-center">
                <p className="text-[15px] text-arena-text-primary">
                  Your prompt is in. Waiting for others…
                </p>
                {mySubmission?.prompt_text && (
                  <p className="mt-3 text-[13px] italic text-arena-text-muted">
                    {mySubmission.prompt_text}
                  </p>
                )}
              </div>
            )}

            {room.status === "prompting" &&
              round.prompt_deadline &&
              !isDeadlineActive(round.prompt_deadline) &&
              !showForm &&
              !host &&
              !hasSubmitted && (
                <Alert variant="warning">
                  The submission deadline has passed. Ask the host to lock the
                  round, or create a new room for a fresh battle.
                </Alert>
              )}

            {host && room.status === "prompting" && (
              <HostControls
                snapshot={snapshot}
                onRefresh={onRefresh}
                variant="center"
              />
            )}

            {(room.status === "resolving" ||
              (room.status === "prompting" && round.submissions.length > 0)) && (
              <div className="space-y-4">
                {room.status === "resolving" && (
                  <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-arena-text-muted">
                    Submissions
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
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
