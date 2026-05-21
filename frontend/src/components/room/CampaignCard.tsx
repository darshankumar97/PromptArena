"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { participantName, submissionId } from "@/lib/room-helpers";
import type {
  Participant,
  RoomStatus,
  SubmissionSummary,
} from "@/types";

const jobLabels: Record<string, string> = {
  queued: "Queued",
  running: "Generating…",
  completed: "Ready",
  failed: "Failed",
  timed_out: "Timed out",
};

export function CampaignCard({
  submission,
  participants,
  roomStatus,
  isHost,
  onScore,
  onSelectWinner,
  onRetry,
  scoring,
  selecting,
}: {
  submission: SubmissionSummary;
  participants: Participant[];
  roomStatus: RoomStatus;
  isHost: boolean;
  onScore?: (submissionId: number, score: number) => void;
  onSelectWinner?: (submissionId: number) => void;
  onRetry?: (submissionId: number) => void;
  scoring?: boolean;
  selecting?: boolean;
}) {
  const name = participantName(participants, submission.user_id);
  const job = submission.generation_job;
  const campaign = submission.campaign;
  const sid = submissionId(submission);
  const canJudge =
    isHost &&
    roomStatus === "resolving" &&
    submission.status === "completed" &&
    !!campaign;
  const canRetry =
    !!onRetry &&
    (submission.status === "failed" || job?.status === "failed" || job?.status === "timed_out");

  return (
    <article
      className={cn(
        "rounded-xl border p-5 transition-all duration-300",
        submission.is_winner
          ? "border-violet-500/40 bg-gradient-to-br from-violet-500/10 to-zinc-900/80 shadow-lg shadow-violet-950/20"
          : "border-zinc-800/80 bg-zinc-900/40",
      )}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">{name}</h3>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Badge variant="default">{submission.status}</Badge>
            {job && (
              <Badge
                variant={
                  job.status === "completed"
                    ? "results"
                    : job.status === "failed"
                      ? "finished"
                      : "prompting"
                }
              >
                {jobLabels[job.status] ?? job.status}
              </Badge>
            )}
            {submission.is_winner && <Badge variant="winner">Winner</Badge>}
            {submission.score != null && (
              <Badge variant="results">{submission.score}/10</Badge>
            )}
          </div>
        </div>
      </div>

      {submission.status === "processing" && !campaign && (
        <div className="flex items-center gap-3 rounded-lg bg-zinc-800/40 px-4 py-6">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-400/30 border-t-indigo-400" />
          <p className="text-sm text-zinc-400">AI is crafting the campaign…</p>
        </div>
      )}

      {job?.status === "failed" && (
        <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3">
          <p className="text-sm text-red-300">
            {job.error_message || "Generation failed"}
          </p>
          {onRetry && sid && (
            <Button
              variant="secondary"
              className="mt-3"
              onClick={() => onRetry(sid)}
            >
              Retry generation
            </Button>
          )}
        </div>
      )}

      {campaign ? (
        <div className="space-y-3">
          <h4 className="text-xl font-semibold tracking-tight text-zinc-50">
            {campaign.title}
          </h4>
          <p className="text-sm font-medium text-indigo-300/90">
            {campaign.tagline}
          </p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-400">
            {campaign.campaign_text}
          </p>
        </div>
      ) : (
        !job?.status?.includes("running") &&
        submission.status !== "processing" && (
          <p className="text-sm text-zinc-600">Waiting for campaign output…</p>
        )
      )}

      {submission.prompt_text && (
        <details className="mt-4 border-t border-zinc-800/60 pt-3">
          <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-400">
            View prompt
          </summary>
          <p className="mt-2 text-sm italic text-zinc-500">
            {submission.prompt_text}
          </p>
        </details>
      )}

      {canJudge && sid && (
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-zinc-800/60 pt-4">
          <span className="text-xs text-zinc-500">Host score:</span>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <button
              key={n}
              type="button"
              disabled={scoring}
              onClick={() => onScore?.(sid, n)}
              className={cn(
                "h-8 w-8 rounded-md text-xs font-medium transition",
                submission.score === n
                  ? "bg-indigo-500 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700",
              )}
            >
              {n}
            </button>
          ))}
          <Button
            variant="primary"
            className="ml-auto"
            loading={selecting}
            onClick={() => onSelectWinner?.(sid)}
          >
            Select winner
          </Button>
        </div>
      )}
    </article>
  );
}
