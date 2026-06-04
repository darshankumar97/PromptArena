"use client";

import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import type { Participant, RoomSnapshot } from "@/types";

export function ParticipantList({
  snapshot,
  currentUserId,
}: {
  snapshot: RoomSnapshot;
  currentUserId?: number;
}) {
  const winnerId = snapshot.current_round?.winner_user_id;

  return (
    <ul className="flex flex-col gap-1.5">
      {snapshot.participants.map((p) => (
        <ParticipantRow
          key={p.id}
          participant={p}
          isYou={p.user_id === currentUserId}
          isWinner={p.user_id === winnerId}
        />
      ))}
    </ul>
  );
}

function ParticipantRow({
  participant,
  isYou,
  isWinner,
}: {
  participant: Participant;
  isYou: boolean;
  isWinner: boolean;
}) {
  const online = participant.connection_status === "online";

  return (
    <li
      className={cn(
        "flex items-center justify-between gap-2 rounded-md border px-3 py-2",
        isYou
          ? "border-[var(--border)] bg-[var(--card-elevated)]"
          : "border-[var(--border-subtle)] bg-[var(--card)]",
      )}
    >
      <div className="min-w-0">
        <p className="truncate text-sm text-[var(--foreground)]">
          {participant.display_name ?? `Player ${participant.user_id}`}
          {isYou && (
            <span className="ml-1 text-xs text-[var(--muted)]">(you)</span>
          )}
        </p>
        <div className="mt-1 flex flex-wrap gap-1">
          {participant.role === "host" && <Badge variant="host">Host</Badge>}
          {isWinner && <Badge variant="winner">Winner</Badge>}
        </div>
      </div>
      <Badge variant={online ? "online" : "offline"} className="shrink-0">
        {online ? "Online" : "Away"}
      </Badge>
    </li>
  );
}
