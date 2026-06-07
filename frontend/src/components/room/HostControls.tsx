"use client";

import { useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { api, ApiRequestError } from "@/lib/api";
import { isSessionExpiredError } from "@/lib/session-expired";
import { hasJudgeableSubmissions } from "@/lib/room-helpers";
import { useAuthStore } from "@/stores/authStore";
import { useRoomStore } from "@/stores/roomStore";
import type { RoomSnapshot } from "@/types";

const THEME_SUGGESTIONS = [
  "Rebrand McDonald's for Gen-Z",
  "Pitch a startup in a haunted house",
  "Write a Netflix show about sentient AI",
] as const;

export function HostControls({
  snapshot,
  onRefresh,
  variant = "sidebar",
}: {
  snapshot: RoomSnapshot;
  onRefresh: () => void;
  variant?: "sidebar" | "center";
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
      if (
        e instanceof ApiRequestError &&
        e.code === "INVALID_ROOM_STATE" &&
        e.status === 409
      ) {
        await onRefresh();
      }
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

  const isCenter = variant === "center";

  return (
    <>
      <div className={isCenter ? "w-full max-w-md" : ""}>
        {localError && (
          <Alert variant="error" className="mb-4">
            {localError}
          </Alert>
        )}

        {room.status === "lobby" && (
          <div className="space-y-4">
            {!isCenter && (
              <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-arena-text-muted">
                Host controls
              </p>
            )}
            <div>
              <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.06em] text-arena-text-muted">
                Battle theme
              </label>
              <Input
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                placeholder="e.g. Write the most insane luxury perfume campaign..."
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="mr-2 text-[11px] text-arena-text-muted">
                  Try:
                </span>
                {THEME_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setTheme(suggestion)}
                    className="inline-flex h-7 cursor-pointer items-center rounded-sm border border-arena-border bg-arena-surface px-3 text-[12px] text-arena-text-secondary transition-colors duration-150 hover:border-arena-border-strong hover:text-arena-text-primary"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
            {totalPlayers < 2 && (
              <Alert variant="warning">
                At least two players are required to start.
              </Alert>
            )}
            <Button
              className={isCenter ? "w-full" : "w-full"}
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
              Start Round →
            </Button>
          </div>
        )}

        {room.status === "prompting" && round && (
          <div className="space-y-4">
            <p className="text-[13px] text-arena-text-secondary">
              {submittedCount} submission{submittedCount === 1 ? "" : "s"}
              {playerCount > 0 &&
                ` · ${playerCount} player${playerCount === 1 ? "" : "s"}`}
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
          <p className="text-[13px] leading-[1.6] text-arena-text-secondary">
            {submittedCount === 0 || !judgeable
              ? "No campaigns to judge this round."
              : "Score campaigns below, then select a winner."}
          </p>
        )}

        {room.status === "results" && round?.winner_user_id && (
          <Alert variant="success">Round complete — winner selected.</Alert>
        )}
      </div>

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
