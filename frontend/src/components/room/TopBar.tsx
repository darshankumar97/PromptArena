"use client";

import { Button } from "@/components/ui/Button";
import type { RoomSnapshot } from "@/types";

export function RoomMobileBar({
  snapshot,
  onOpenPlayers,
  onOpenActivity,
}: {
  snapshot: RoomSnapshot;
  onOpenPlayers: () => void;
  onOpenActivity: () => void;
}) {
  const playerCount = snapshot.participants.length;

  return (
    <div className="flex items-center gap-2 border-b border-arena-border px-4 py-2 md:hidden">
      <Button variant="ghost" className="text-[13px]" onClick={onOpenPlayers}>
        Players ({playerCount})
      </Button>
      <Button variant="ghost" className="text-[13px]" onClick={onOpenActivity}>
        Activity
      </Button>
    </div>
  );
}
