"use client";

import { ActivityFeed } from "@/components/room/ActivityFeed";
import { cn } from "@/lib/cn";
import type { ActivityEvent } from "@/types";

export function ActivitySidebar({
  events,
  className,
}: {
  events: ActivityEvent[];
  className?: string;
}) {
  return (
    <aside
      className={cn(
        "flex h-full w-[280px] shrink-0 flex-col border-l border-arena-border bg-arena-surface",
        className,
      )}
    >
      <p className="px-4 py-4 text-[11px] font-medium uppercase tracking-[0.06em] text-arena-text-muted">
        Activity
      </p>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ActivityFeed events={events} />
      </div>
    </aside>
  );
}
