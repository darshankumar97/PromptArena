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
    <ul className="flex flex-col gap-2">
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
        "flex items-center justify-between rounded-lg border px-3 py-2.5 transition-colors",
        isYou
          ? "border-indigo-500/30 bg-indigo-500/5"
          : "border-zinc-800/80 bg-zinc-900/30",
      )}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-zinc-200">
          {participant.display_name ?? `Player ${participant.user_id}`}
          {isYou && (
            <span className="ml-1.5 text-xs font-normal text-zinc-500">(you)</span>
          )}
        </p>
        <div className="mt-1 flex flex-wrap gap-1">
          {participant.role === "host" && <Badge variant="host">Host</Badge>}
          {isWinner && <Badge variant="winner">Winner</Badge>}
        </div>
      </div>
      <Badge variant={online ? "online" : "offline"}>
        {online ? "Online" : "Away"}
      </Badge>
    </li>
  );
}
