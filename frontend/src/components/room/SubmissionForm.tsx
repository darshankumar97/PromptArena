"use client";

import { useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
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
    <Card>
      <CardHeader
        title="Your prompt"
        description="One submission per round. AI generation starts after you submit."
      />
      <Textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={4}
        placeholder="Describe the campaign you want the AI to create…"
      />
      {localError && (
        <Alert variant="error" className="mt-3">
          {localError}
        </Alert>
      )}
      <Button
        className="mt-4"
        loading={actionLoading === "submit"}
        disabled={!prompt.trim()}
        onClick={submit}
      >
        Submit prompt
      </Button>
    </Card>
  );
}
