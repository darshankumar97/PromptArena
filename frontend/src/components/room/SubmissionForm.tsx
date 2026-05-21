"use client";



import { useState } from "react";



import { Button } from "@/components/ui/Button";

import { api, ApiRequestError } from "@/lib/api";

import { isSessionExpiredError } from "@/lib/session-expired";

import { useAuthStore } from "@/stores/authStore";

import { useRoomStore } from "@/stores/roomStore";



export function SubmissionForm({

  roomId,

  roundId,

  onSubmitted,

}: {

  roomId: number;

  roundId: number;

  onSubmitted: () => void;

}) {

  const token = useAuthStore((s) => s.accessToken);

  const setRoomError = useRoomStore((s) => s.setRoomError);

  const setActionLoading = useRoomStore((s) => s.setActionLoading);

  const actionLoading = useRoomStore((s) => s.actionLoading);



  const [prompt, setPrompt] = useState("");

  const [localError, setLocalError] = useState<string | null>(null);



  const submit = async () => {

    if (!token || !prompt.trim()) return;

    setLocalError(null);

    setActionLoading("submit");

    try {

      await api.submitPrompt(token, roomId, roundId, prompt.trim());

      setPrompt("");

      onSubmitted();

    } catch (e) {

      if (isSessionExpiredError(e)) return;

      const msg =

        e instanceof ApiRequestError ? e.message : "Submit failed";

      setLocalError(msg);

      setRoomError(msg);

    } finally {

      setActionLoading(null);

    }

  };



  return (

    <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-5">

      <h3 className="text-sm font-semibold text-zinc-100">Your battle prompt</h3>

      <p className="mt-1 text-xs text-zinc-500">

        One prompt per round. Generation starts immediately after submit.

      </p>

      <textarea

        value={prompt}

        onChange={(e) => setPrompt(e.target.value)}

        rows={4}

        placeholder="Describe the campaign you want the AI to create…"

        className="mt-4 w-full resize-none rounded-lg border border-zinc-700/80 bg-zinc-950/80 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/30"

      />

      {localError && (

        <p className="mt-2 text-xs text-red-400">{localError}</p>

      )}

      <Button

        className="mt-4"

        loading={actionLoading === "submit"}

        disabled={!prompt.trim()}

        onClick={submit}

      >

        Submit prompt

      </Button>

    </div>

  );

}


