"use client";

import {
  CheckCircle,
  Lock,
  Swords,
  Trophy,
  UserMinus,
  UserPlus,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { activityLabel } from "@/lib/room-helpers";
import { cn } from "@/lib/cn";
import type { ActivityEvent } from "@/types";

const eventStyles: Record<
  string,
  { icon: LucideIcon; className: string }
> = {
  player_joined: { icon: UserPlus, className: "text-arena-success" },
  player_left: { icon: UserMinus, className: "text-arena-text-muted" },
  round_started: { icon: Swords, className: "text-arena-accent" },
  prompt_submitted: {
    icon: CheckCircle,
    className: "text-arena-text-secondary",
  },
  round_locked: { icon: Lock, className: "text-arena-warning" },
  winner_announced: { icon: Trophy, className: "text-arena-accent" },
  room_ended: { icon: X, className: "text-arena-danger" },
};

function EventIcon({ eventType }: { eventType: string }) {
  const style = eventStyles[eventType] ?? {
    icon: CheckCircle,
    className: "text-arena-text-muted",
  };
  const Icon = style.icon;
  return <Icon className={cn("h-3 w-3 shrink-0", style.className)} />;
}

export function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="px-4 py-8 text-[13px] leading-[1.6] text-arena-text-muted">
        Events from the room will show up here.
      </p>
    );
  }

  return (
    <ul className="flex flex-col overflow-y-auto">
      {[...events].reverse().map((event) => (
        <li
          key={event.id}
          className="animate-feed-in min-h-11 border-b border-arena-border/40 px-4 py-3"
        >
          <div className="flex items-start gap-3">
            <EventIcon eventType={event.event_type} />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] leading-[1.4] text-arena-text-primary">
                {activityLabel(event.event_type, event.payload)}
              </p>
              <p className="mt-1 text-[11px] text-arena-text-muted">
                {new Date(event.created_at).toLocaleTimeString()}
              </p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
