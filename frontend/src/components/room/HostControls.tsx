"use client";



import { useState } from "react";



import { Button } from "@/components/ui/Button";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

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

      <section className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-5">

        <h3 className="text-sm font-semibold text-zinc-100">Host controls</h3>

        <p className="mt-1 text-xs text-zinc-500">

          Manage the round lifecycle. Hosts do not submit prompts.

        </p>



        {localError && (

          <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">

            {localError}

          </p>

        )}



        {room.status === "lobby" && (

          <div className="mt-4 space-y-3">

            <label className="block text-xs text-zinc-500">Battle theme</label>

            <input

              value={theme}

              onChange={(e) => setTheme(e.target.value)}

              className="w-full rounded-lg border border-zinc-700/80 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-500/50 focus:outline-none"

            />

            {totalPlayers < 2 && (

              <p className="text-xs text-amber-400/90">

                Need at least 2 players in the room to start.

              </p>

            )}

            <Button

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

          <div className="mt-4 space-y-2">

            <p className="text-xs text-zinc-500">

              {submittedCount} submission

              {submittedCount === 1 ? "" : "s"} received

              {playerCount > 0 && ` · ${playerCount} players`}

            </p>

            <Button

              variant="secondary"

              loading={actionLoading === "lock"}

              onClick={handleLockClick}

            >

              Lock submissions

            </Button>

          </div>

        )}



        {room.status === "resolving" && (

          <p className="mt-4 text-xs text-zinc-400">

            {submittedCount === 0 || !judgeable

              ? "Submissions are closed. No campaigns to judge this round."

              : "Score campaigns and select a winner from the cards in the feed."}

          </p>

        )}



        {room.status === "results" && round?.winner_user_id && (

          <p className="mt-4 text-sm text-emerald-400/90">

            Battle complete. Winner selected.

          </p>

        )}

      </section>



      <ConfirmDialog

        open={confirmZeroLock}

        title="Lock with zero submissions?"

        message={`${submittedCount} participant${submittedCount === 1 ? " has" : "s have"} submitted prompts. Are you sure you want to lock submissions and move to judging?`}

        confirmLabel="Lock submissions"

        cancelLabel="Cancel"

        loading={actionLoading === "lock"}

        onConfirm={() => void lockRound()}

        onCancel={() => setConfirmZeroLock(false)}

      />

    </>

  );

}


