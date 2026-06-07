"use client";

import { Check, Crown } from "lucide-react";

import { cn } from "@/lib/cn";
import type { Participant, RoomSnapshot } from "@/types";

export function ParticipantList({
  snapshot,
  currentUserId,
}: {
  snapshot: RoomSnapshot;
  currentUserId?: number;
}) {
  const round = snapshot.current_round;
  const submittedIds = new Set(
    round?.submissions.filter((s) => s.submitted).map((s) => s.user_id) ?? [],
  );

  return (
    <ul className="flex flex-col">
      {snapshot.participants.map((p) => (
        <ParticipantRow
          key={p.id}
          participant={p}
          isYou={p.user_id === currentUserId}
          hasSubmitted={submittedIds.has(p.user_id)}
        />
      ))}
    </ul>
  );
}

function ParticipantRow({
  participant,
  isYou,
  hasSubmitted,
}: {
  participant: Participant;
  isYou: boolean;
  hasSubmitted: boolean;
}) {
  const online = participant.connection_status === "online";
  const name =
    participant.display_name ?? `Player ${participant.user_id}`;

  return (
    <li className="flex h-8 items-center gap-2">
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          online ? "bg-arena-success" : "bg-arena-text-muted",
        )}
        aria-hidden
      />
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[13px]",
          isYou ? "text-arena-text-primary" : "text-arena-text-secondary",
        )}
      >
        {name}
      </span>
      {participant.role === "host" && (
        <Crown className="h-3 w-3 shrink-0 text-arena-accent" aria-label="Host" />
      )}
      {hasSubmitted && (
        <Check className="h-3 w-3 shrink-0 text-arena-accent" aria-label="Submitted" />
      )}
    </li>
  );
}
