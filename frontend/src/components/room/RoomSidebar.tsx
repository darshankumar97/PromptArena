"use client";



import { ActivityFeed } from "@/components/room/ActivityFeed";

import { HostControls } from "@/components/room/HostControls";

import { ParticipantList } from "@/components/room/ParticipantList";

import { isHost } from "@/lib/room-helpers";

import type { ActivityEvent, RoomSnapshot } from "@/types";



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

    <aside className="flex w-80 shrink-0 flex-col gap-5 overflow-y-auto border-r border-zinc-800/80 bg-zinc-950/40 p-4">

      <section>

        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">

          Participants

        </h2>

        <ParticipantList snapshot={snapshot} currentUserId={currentUserId} />

      </section>



      {host && <HostControls snapshot={snapshot} onRefresh={onRefresh} />}



      <section className="flex min-h-0 flex-1 flex-col">

        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">

          Live activity

        </h2>

        <ActivityFeed events={activity} />

      </section>

    </aside>

  );

}


