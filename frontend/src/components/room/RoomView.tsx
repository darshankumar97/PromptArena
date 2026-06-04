"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";

import { BattleFeed } from "@/components/room/BattleFeed";
import { RoomSidebar } from "@/components/room/RoomSidebar";
import { TopBar } from "@/components/room/TopBar";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
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
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!snapshot && socketStatus !== "authenticated") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--background)] px-6">
        <Spinner size="lg" />
        <p className="text-sm text-[var(--muted-foreground)]">
          Joining room {roomCode}…
        </p>
        {(socketError || roomError) && (
          <div className="w-full max-w-sm space-y-3 text-center">
            <Alert variant="error">{socketError || roomError}</Alert>
            <Link
              href="/"
              className="text-sm text-[var(--accent)] hover:underline"
            >
              Back to home
            </Link>
          </div>
        )}
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[var(--background)]">
        <Spinner />
        <p className="text-sm text-[var(--muted)]">Loading room…</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-[var(--background)]">
      <TopBar snapshot={snapshot} socketStatus={socketStatus} />

      {(roomError || socketError) && (
        <div className="border-b border-[var(--border-subtle)] px-4 py-2 md:px-5">
          <Alert variant="warning">{roomError || socketError}</Alert>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
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
