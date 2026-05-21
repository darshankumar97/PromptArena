"use client";

import { activityLabel } from "@/lib/room-helpers";
import type { ActivityEvent } from "@/types";

export function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="px-1 text-xs leading-relaxed text-zinc-600">
        Activity will appear here as the battle unfolds.
      </p>
    );
  }

  return (
    <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto pr-1">
      {[...events].reverse().map((event) => (
        <li
          key={event.id}
          className="rounded-lg border border-zinc-800/60 bg-zinc-900/40 px-2.5 py-2"
        >
          <p className="text-xs text-zinc-300">
            {activityLabel(event.event_type, event.payload)}
          </p>
          <p className="mt-0.5 text-[10px] text-zinc-600">
            {new Date(event.created_at).toLocaleTimeString()}
          </p>
        </li>
      ))}
    </ul>
  );
}
