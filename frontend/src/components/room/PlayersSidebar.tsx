"use client";

import Link from "next/link";
import { Eye } from "lucide-react";

import { ParticipantList } from "@/components/room/ParticipantList";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { roomPhaseDisplay } from "@/lib/room-helpers";
import { useRoomStore } from "@/stores/roomStore";
import type { RoomSnapshot } from "@/types";

export function PlayersSidebar({
  snapshot,
  currentUserId,
  className,
}: {
  snapshot: RoomSnapshot;
  currentUserId?: number;
  className?: string;
}) {
  const room = snapshot.room;
  const round = snapshot.current_round;
  const phase = roomPhaseDisplay(snapshot);
  const spectatorCount = useRoomStore((s) => s.spectatorCount);

  return (
    <aside
      className={cn(
        "flex h-full w-60 shrink-0 flex-col border-r border-arena-border bg-arena-surface",
        className,
      )}
    >
      <div className="flex flex-1 flex-col overflow-y-auto p-4">
        <p className="font-mono text-[13px] text-arena-text-muted">{room.code}</p>
        {round && (
          <p className="mt-2 text-[15px] font-medium leading-[1.4] text-arena-text-primary">
            {round.battle_theme}
          </p>
        )}
        {!round && room.status === "lobby" && (
          <p className="mt-2 text-[15px] text-arena-text-secondary">
            Waiting to start
          </p>
        )}
        <div className="mt-3">
          <Badge variant={phase.badgeVariant}>{phase.label}</Badge>
        </div>

        <div className="my-4 border-t border-arena-border" />

        <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.06em] text-arena-text-muted">
          Players
        </p>
        <ParticipantList snapshot={snapshot} currentUserId={currentUserId} />

        {spectatorCount > 0 && (
          <>
            <div className="my-4 border-t border-arena-border" />
            <p className="flex items-center gap-2 text-[12px] text-arena-text-muted">
              <Eye className="h-3 w-3" aria-hidden />
              {spectatorCount} watching
            </p>
          </>
        )}
      </div>

      <div className="border-t border-arena-border p-4">
        <Link href="/">
          <Button variant="ghost" className="w-full">
            Leave Room
          </Button>
        </Link>
      </div>
    </aside>
  );
}
