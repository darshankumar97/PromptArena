"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
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
  return (
    <div
      className={cn(
        "rounded-md border border-arena-border bg-arena-surface p-5",
        submission.is_winner && "border-arena-border-strong",
      )}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-[15px] font-medium text-arena-text-primary">
            {name}
          </h3>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="default">{submission.status}</Badge>
            {job && (
              <Badge
                variant={
                  job.status === "completed"
                    ? "success"
                    : job.status === "failed"
                      ? "failed"
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
        <div className="flex items-center gap-3 rounded border border-arena-border bg-arena-bg px-4 py-5">
          <Spinner size="sm" />
          <p className="text-[15px] text-arena-text-secondary">
            Generating campaign…
          </p>
        </div>
      )}

      {job?.status === "failed" && (
        <div className="mb-4 rounded border border-arena-danger/30 bg-arena-danger-subtle px-4 py-3">
          <p className="text-[15px] text-arena-danger">
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
          <h4 className="text-[17px] font-medium leading-[1.2] text-arena-text-primary">
            {campaign.title}
          </h4>
          <p className="text-[13px] text-arena-text-secondary">
            {campaign.tagline}
          </p>
          <p className="whitespace-pre-wrap text-[15px] leading-[1.6] text-arena-text-primary">
            {campaign.campaign_text}
          </p>
        </div>
      ) : (
        !job?.status?.includes("running") &&
        submission.status !== "processing" && (
          <p className="text-[13px] text-arena-text-muted">Waiting for output…</p>
        )
      )}

      {submission.prompt_text && (
        <details className="mt-4 border-t border-arena-border pt-3">
          <summary className="cursor-pointer text-[11px] font-medium uppercase tracking-[0.06em] text-arena-text-muted hover:text-arena-text-secondary">
            View prompt
          </summary>
          <p className="mt-2 text-[13px] italic text-arena-text-secondary">
            {submission.prompt_text}
          </p>
        </details>
      )}

      {canJudge && sid && (
        <div className="mt-5 border-t border-arena-border pt-4">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.06em] text-arena-text-muted">
            Score
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <button
                key={n}
                type="button"
                disabled={scoring}
                onClick={() => onScore?.(sid, n)}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded text-[13px] font-medium",
                  submission.score === n
                    ? "bg-arena-accent text-white"
                    : "border border-arena-border bg-arena-surface text-arena-text-secondary hover:border-arena-border-strong hover:bg-arena-elevated",
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
    </div>
  );
}

export function ResolvingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="skeleton-shimmer h-48 rounded-md border border-arena-border"
          />
        ))}
      </div>
      <p className="text-center text-[13px] text-arena-text-muted">
        AI is judging submissions…
      </p>
    </div>
  );
}
