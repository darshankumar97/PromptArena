"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";
import { participantName, submissionId } from "@/lib/room-helpers";
import type {
  Participant,
  RoomStatus,
  SubmissionSummary,
} from "@/types";

const jobLabels: Record<string, string> = {
  queued: "Queued",
  running: "Generating",
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
    (submission.status === "failed" ||
      job?.status === "failed" ||
      job?.status === "timed_out");

  return (
    <Card
      className={cn(
        submission.is_winner && "border-[var(--foreground)]/20 bg-[var(--card-elevated)]",
      )}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-[var(--foreground)]">{name}</h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
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
              <Badge variant="default">{submission.score}/10</Badge>
            )}
          </div>
        </div>
      </div>

      {submission.status === "processing" && !campaign && (
        <div className="flex items-center gap-3 rounded-md border border-[var(--border-subtle)] bg-[var(--background)] px-4 py-5">
          <Spinner size="sm" />
          <p className="text-sm text-[var(--muted-foreground)]">
            Generating campaign…
          </p>
        </div>
      )}

      {job?.status === "failed" && (
        <div className="mb-4 rounded-md border border-red-900/50 bg-red-950/20 px-4 py-3">
          <p className="text-sm text-red-300">
            {job.error_message || "Generation failed"}
          </p>
          {onRetry && sid && (
            <Button
              variant="secondary"
              className="mt-3"
              onClick={() => onRetry(sid)}
            >
              Retry
            </Button>
          )}
        </div>
      )}

      {campaign ? (
        <div className="space-y-2">
          <h4 className="text-lg font-semibold text-[var(--foreground)]">
            {campaign.title}
          </h4>
          <p className="text-sm font-medium text-[var(--muted-foreground)]">
            {campaign.tagline}
          </p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--muted-foreground)]">
            {campaign.campaign_text}
          </p>
        </div>
      ) : (
        !job?.status?.includes("running") &&
        submission.status !== "processing" && (
          <p className="text-sm text-[var(--muted)]">Waiting for output…</p>
        )
      )}

      {submission.prompt_text && (
        <details className="mt-4 border-t border-[var(--border-subtle)] pt-3">
          <summary className="cursor-pointer text-xs text-[var(--muted)] hover:text-[var(--muted-foreground)]">
            View prompt
          </summary>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            {submission.prompt_text}
          </p>
        </details>
      )}

      {canJudge && sid && (
        <div className="mt-5 border-t border-[var(--border-subtle)] pt-4">
          <p className="mb-3 text-xs font-medium text-[var(--muted)]">Score</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <button
                key={n}
                type="button"
                disabled={scoring}
                onClick={() => onScore?.(sid, n)}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-md text-xs font-medium transition-colors",
                  submission.score === n
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "border border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:bg-[var(--card-elevated)]",
                )}
              >
                {n}
              </button>
            ))}
            <Button
              className="ml-auto"
              loading={selecting}
              onClick={() => onSelectWinner?.(sid)}
            >
              Select winner
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
