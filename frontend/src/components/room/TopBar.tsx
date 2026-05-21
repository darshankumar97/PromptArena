"use client";



import Link from "next/link";



import { Badge } from "@/components/ui/Badge";

import { roomPhaseDisplay } from "@/lib/room-helpers";

import { cn } from "@/lib/cn";

import type { RoomSnapshot } from "@/types";

import type { SocketStatus } from "@/stores/socketStore";



const socketLabels: Record<SocketStatus, string> = {

  idle: "Offline",

  connecting: "Connecting…",

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



  return (

    <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-800/80 bg-zinc-950/60 px-5 backdrop-blur-md">

      <div className="flex items-center gap-4">

        <Link

          href="/"

          className="text-sm font-semibold tracking-tight text-zinc-100"

        >

          PromptArena

        </Link>

        {room && (

          <div className="flex items-center gap-2">

            <span className="font-mono text-sm text-zinc-400">#{room.code}</span>

            <button

              type="button"

              onClick={() => navigator.clipboard.writeText(room.code)}

              className="text-xs text-zinc-500 transition hover:text-zinc-300"

            >

              Copy

            </button>

          </div>

        )}

      </div>



      <div className="flex items-center gap-3">

        {room && (

          <Badge variant={phase.badgeVariant}>{phase.label}</Badge>

        )}

        <span className="text-xs text-zinc-500">

          {online}/{snapshot?.participants.length ?? 0} online

        </span>

        <span

          className={cn(

            "flex items-center gap-1.5 text-xs font-medium",

            socketStatus === "authenticated"

              ? "text-emerald-400"

              : socketStatus === "error"

                ? "text-red-400"

                : "text-zinc-500",

          )}

        >

          <span

            className={cn(

              "h-2 w-2 rounded-full",

              socketStatus === "authenticated"

                ? "bg-emerald-400 animate-pulse"

                : socketStatus === "connecting"

                  ? "bg-amber-400 animate-pulse"

                  : "bg-zinc-600",

            )}

          />

          {socketLabels[socketStatus]}

        </span>

      </div>

    </header>

  );

}


