"use client";

import { useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
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
  deadline?: string | null;
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
    <div className="w-full max-w-2xl">
      <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.06em] text-arena-text-muted">
        Your Prompt
      </label>
      <Textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        className="min-h-[160px]"
        placeholder="Describe the campaign you want the AI to create…"
      />
      <p className="mt-2 text-right text-[13px] text-arena-text-muted">
        {prompt.length} characters
      </p>
      {localError && (
        <Alert variant="error" className="mt-4">
          {localError}
        </Alert>
      )}
      <div className="mt-4 flex justify-end">
        <Button
          loading={actionLoading === "submit"}
          disabled={!prompt.trim()}
          onClick={submit}
        >
          Submit Prompt →
        </Button>
      </div>
    </div>
  );
}
