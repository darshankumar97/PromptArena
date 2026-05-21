"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";

import { BattleFeed } from "@/components/room/BattleFeed";
import { RoomSidebar } from "@/components/room/RoomSidebar";
import { TopBar } from "@/components/room/TopBar";
import { useRoomSession } from "@/hooks/useRoomSession";
import { api } from "@/lib/api";
import { saveLastRoomCode } from "@/lib/auth-storage";
import { useAuthStore } from "@/stores/authStore";
import { useRoomStore } from "@/stores/roomStore";
import { useSocketStore } from "@/stores/socketStore";

export function RoomView({ roomCode }: { roomCode: string }) {
  const router = useRouter();
  const hydrate = useAuthStore((s) => s.hydrate);
  const hydrated = useAuthStore((s) => s.hydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);

  const snapshot = useRoomStore((s) => s.snapshot);
  const activity = useRoomStore((s) => s.activity);
  const roomError = useRoomStore((s) => s.roomError);
  const socketStatus = useSocketStore((s) => s.status);
  const socketError = useSocketStore((s) => s.lastError);

  const { refreshPersonalSnapshot } = useRoomSession(roomCode);

  const onRefresh = useCallback(async () => {
    const roomId = useRoomStore.getState().snapshot?.room.id;
    const token = useAuthStore.getState().accessToken;
    if (roomId && token) {
      await refreshPersonalSnapshot(roomId);
    }
  }, [refreshPersonalSnapshot]);

  useEffect(() => {
    saveLastRoomCode(roomCode);
    hydrate();
  }, [hydrate, roomCode]);

  useEffect(() => {
    if (hydrated && !accessToken) {
      router.replace("/");
    }
  }, [hydrated, accessToken, router]);

  useEffect(() => {
    if (!accessToken || !snapshot?.room.id) return;
    api
      .joinRoom(accessToken, snapshot.room.id)
      .then(({ snapshot: s }) => useRoomStore.getState().applySnapshot(s))
      .catch(() => {});
  }, [accessToken, snapshot?.room.id]);

  if (!hydrated || !accessToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-400" />
      </div>
    );
  }

  if (!snapshot && socketStatus !== "authenticated") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 px-6">
        <span className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-400" />
        <p className="text-sm text-zinc-500">Joining room {roomCode}…</p>
        {(socketError || roomError) && (
          <div className="max-w-md rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-center text-sm text-red-300">
            {socketError || roomError}
            <Link href="/" className="mt-2 block text-indigo-400 hover:underline">
              Back to home
            </Link>
          </div>
        )}
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-500">
        Loading room…
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-zinc-950">
      <TopBar snapshot={snapshot} socketStatus={socketStatus} />

      {(roomError || socketError) && (
        <div className="border-b border-amber-500/20 bg-amber-500/5 px-5 py-2 text-center text-xs text-amber-200/90">
          {roomError || socketError}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <RoomSidebar
          snapshot={snapshot}
          activity={activity}
          currentUserId={user?.id}
          onRefresh={onRefresh}
        />
        <BattleFeed snapshot={snapshot} onRefresh={onRefresh} />
      </div>
    </div>
  );
}
