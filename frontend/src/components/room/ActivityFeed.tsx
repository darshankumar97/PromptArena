"use client";

import { activityLabel } from "@/lib/room-helpers";
import type { ActivityEvent } from "@/types";

export function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="text-xs leading-relaxed text-[var(--muted)]">
        Events from the room will show up here.
      </p>
    );
  }

  return (
    <ul className="flex max-h-56 flex-col gap-1.5 overflow-y-auto lg:max-h-72">
      {[...events].reverse().map((event) => (
        <li
          key={event.id}
          className="rounded-md border border-[var(--border-subtle)] bg-[var(--card)] px-2.5 py-2"
        >
          <p className="text-xs text-[var(--muted-foreground)]">
            {activityLabel(event.event_type, event.payload)}
          </p>
          <p className="mt-0.5 text-[10px] text-[var(--muted)]">
            {new Date(event.created_at).toLocaleTimeString()}
          </p>
        </li>
      ))}
    </ul>
  );
}
