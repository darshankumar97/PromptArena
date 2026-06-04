"use client";

import { ActivityFeed } from "@/components/room/ActivityFeed";
import { HostControls } from "@/components/room/HostControls";
import { ParticipantList } from "@/components/room/ParticipantList";
import { isHost } from "@/lib/room-helpers";
import type { ActivityEvent, RoomSnapshot } from "@/types";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-xs font-medium text-[var(--muted)]">{children}</h2>
  );
}

export function RoomSidebar({
  snapshot,
  activity,
  currentUserId,
  onRefresh,
}: {
  snapshot: RoomSnapshot;
  activity: ActivityEvent[];
  currentUserId?: number;
  onRefresh: () => void;
}) {
  const host = isHost(snapshot, currentUserId);

  return (
    <aside className="flex w-full shrink-0 flex-col gap-6 overflow-y-auto border-b border-[var(--border-subtle)] bg-[var(--background)] p-4 lg:w-72 lg:border-b-0 lg:border-r xl:w-80">
      <section>
        <SectionTitle>Participants</SectionTitle>
        <ParticipantList snapshot={snapshot} currentUserId={currentUserId} />
      </section>

      {host && <HostControls snapshot={snapshot} onRefresh={onRefresh} />}

      <section className="flex min-h-0 flex-1 flex-col lg:min-h-[12rem]">
        <SectionTitle>Activity</SectionTitle>
        <ActivityFeed events={activity} />
      </section>
    </aside>
  );
}
