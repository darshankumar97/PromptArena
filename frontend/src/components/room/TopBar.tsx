"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { roomPhaseDisplay } from "@/lib/room-helpers";
import { cn } from "@/lib/cn";
import type { RoomSnapshot } from "@/types";
import type { SocketStatus } from "@/stores/socketStore";

const socketLabels: Record<SocketStatus, string> = {
  idle: "Offline",
  connecting: "Connecting",
  connected: "Connected",
  authenticated: "Live",
  error: "Error",
};

export function TopBar({
  snapshot,
  socketStatus,
}: {
  snapshot: RoomSnapshot | null;
  socketStatus: SocketStatus;
}) {
  const room = snapshot?.room;
  const phase = roomPhaseDisplay(snapshot);
  const online = snapshot?.participants.filter(
    (p) => p.connection_status === "online",
  ).length;

  const isLive = socketStatus === "authenticated";

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--background)] px-4 md:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href="/"
          className="shrink-0 text-sm font-semibold text-[var(--foreground)] hover:text-[var(--muted-foreground)]"
        >
          PromptArena
        </Link>
        {room && (
          <>
            <span className="hidden text-[var(--border)] sm:inline">/</span>
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate font-mono text-sm text-[var(--muted-foreground)]">
                {room.code}
              </span>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(room.code)}
                className="shrink-0 text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                Copy
              </button>
            </div>
          </>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {room && (
          <Badge variant={phase.badgeVariant}>{phase.label}</Badge>
        )}
        <span className="hidden text-xs text-[var(--muted)] sm:inline">
          {online}/{snapshot?.participants.length ?? 0} online
        </span>
        <span
          className={cn(
            "flex items-center gap-1.5 text-xs",
            isLive
              ? "text-emerald-500"
              : socketStatus === "error"
                ? "text-red-400"
                : "text-[var(--muted)]",
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              isLive
                ? "bg-emerald-500"
                : socketStatus === "connecting"
                  ? "bg-amber-500"
                  : "bg-zinc-600",
            )}
          />
          {socketLabels[socketStatus]}
        </span>
      </div>
    </header>
  );
}
