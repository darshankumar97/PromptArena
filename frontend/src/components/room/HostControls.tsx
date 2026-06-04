"use client";

import { useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { api, ApiRequestError } from "@/lib/api";
import { isSessionExpiredError } from "@/lib/session-expired";
import { hasJudgeableSubmissions } from "@/lib/room-helpers";
import { useAuthStore } from "@/stores/authStore";
import { useRoomStore } from "@/stores/roomStore";
import type { RoomSnapshot } from "@/types";

export function HostControls({
  snapshot,
  onRefresh,
}: {
  snapshot: RoomSnapshot;
  onRefresh: () => void;
}) {
  const token = useAuthStore((s) => s.accessToken);
  const setRoomError = useRoomStore((s) => s.setRoomError);
  const setActionLoading = useRoomStore((s) => s.setActionLoading);
  const actionLoading = useRoomStore((s) => s.actionLoading);

  const [theme, setTheme] = useState("Freestyle creative battle");
  const [localError, setLocalError] = useState<string | null>(null);
  const [confirmZeroLock, setConfirmZeroLock] = useState(false);

  const room = snapshot.room;
  const round = snapshot.current_round;
  const playerCount = snapshot.participants.filter((p) => p.role === "player").length;
  const totalPlayers = snapshot.participants.length;
  const submittedCount = round?.submitted_count ?? 0;
  const judgeable = hasJudgeableSubmissions(snapshot);

  const run = async (key: string, fn: () => Promise<void>) => {
    setLocalError(null);
    setActionLoading(key);
    try {
      await fn();
      onRefresh();
    } catch (e) {
      if (isSessionExpiredError(e)) return;
      const msg = e instanceof ApiRequestError ? e.message : "Action failed";
      setLocalError(msg);
      setRoomError(msg);
    } finally {
      setActionLoading(null);
    }
  };

  const lockRound = async () => {
    if (!token || !round) return;
    await run("lock", async () => {
      const res = await api.lockRound(token, room.id, round.id);
      useRoomStore.getState().applySnapshot(res.snapshot);
    });
    setConfirmZeroLock(false);
  };

  const handleLockClick = () => {
    if (submittedCount === 0) {
      setConfirmZeroLock(true);
      return;
    }
    void lockRound();
  };

  return (
    <>
      <Card>
        <CardHeader
          title="Host controls"
          description="Start rounds and lock submissions when ready."
        />

        {localError && (
          <Alert variant="error" className="mb-4">
            {localError}
          </Alert>
        )}

        {room.status === "lobby" && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-[var(--muted-foreground)]">
                Battle theme
              </label>
              <Input
                className="mt-1.5"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
              />
            </div>
            {totalPlayers < 2 && (
              <Alert variant="warning">
                At least two players are required to start.
              </Alert>
            )}
            <Button
              className="w-full"
              loading={actionLoading === "start"}
              disabled={totalPlayers < 2}
              onClick={() =>
                run("start", async () => {
                  if (!token) return;
                  const res = await api.startRound(token, room.id, theme.trim());
                  useRoomStore.getState().applySnapshot(res.snapshot);
                })
              }
            >
              Start round
            </Button>
          </div>
        )}

        {room.status === "prompting" && round && (
          <div className="space-y-3">
            <p className="text-xs text-[var(--muted-foreground)]">
              {submittedCount} submission{submittedCount === 1 ? "" : "s"}
              {playerCount > 0 && ` · ${playerCount} player${playerCount === 1 ? "" : "s"}`}
            </p>
            <Button
              variant="secondary"
              className="w-full"
              loading={actionLoading === "lock"}
              onClick={handleLockClick}
            >
              Lock submissions
            </Button>
          </div>
        )}

        {room.status === "resolving" && (
          <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
            {submittedCount === 0 || !judgeable
              ? "No campaigns to judge this round."
              : "Score campaigns in the feed, then select a winner."}
          </p>
        )}

        {room.status === "results" && round?.winner_user_id && (
          <Alert variant="success">Round complete — winner selected.</Alert>
        )}
      </Card>

      <ConfirmDialog
        open={confirmZeroLock}
        title="Lock with zero submissions?"
        message={`${submittedCount} participant${submittedCount === 1 ? " has" : "s have"} submitted. Lock anyway and move to judging?`}
        confirmLabel="Lock submissions"
        cancelLabel="Cancel"
        loading={actionLoading === "lock"}
        onConfirm={() => void lockRound()}
        onCancel={() => setConfirmZeroLock(false)}
      />
    </>
  );
}
