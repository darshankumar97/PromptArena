"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { ActivitySidebar } from "@/components/room/ActivitySidebar";
import { BattleFeed } from "@/components/room/BattleFeed";
import { PlayersSidebar } from "@/components/room/PlayersSidebar";
import { RoomMobileBar } from "@/components/room/TopBar";
import { Navbar } from "@/components/layout/Navbar";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { useRoomSession } from "@/hooks/useRoomSession";
import { api } from "@/lib/api";
import { saveLastRoomCode } from "@/lib/auth-storage";
import { useAuthStore } from "@/stores/authStore";
import { useRoomStore } from "@/stores/roomStore";
import { useSocketStore } from "@/stores/socketStore";

function MobileDrawer({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 md:hidden">
      <button
        type="button"
        aria-label="Close panel"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <div className="absolute left-0 top-0 z-50 h-full">{children}</div>
    </div>
  );
}

function MobileDrawerRight({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 md:hidden">
      <button
        type="button"
        aria-label="Close panel"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <div className="absolute right-0 top-0 z-50 h-full">{children}</div>
    </div>
  );
}

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

  const [playersOpen, setPlayersOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);

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
      <div className="flex min-h-screen items-center justify-center bg-arena-bg">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!snapshot && socketStatus !== "authenticated") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-arena-bg px-6">
        <Spinner size="lg" />
        <p className="text-[15px] text-arena-text-secondary">
          Joining room {roomCode}…
        </p>
        {(socketError || roomError) && (
          <div className="w-full max-w-sm space-y-4 text-center">
            <Alert variant="error">{socketError || roomError}</Alert>
            <Link
              href="/"
              className="text-[13px] text-arena-accent hover:text-arena-text-primary"
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
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-arena-bg px-6">
        <Spinner />
        <p className="text-[13px] text-arena-text-muted">Loading room…</p>
        {(socketError || roomError) && (
          <div className="w-full max-w-sm space-y-4 text-center">
            <Alert variant="error">{socketError || roomError}</Alert>
            <Link
              href="/"
              className="text-[13px] text-arena-accent hover:text-arena-text-primary"
            >
              Back to home
            </Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-arena-bg">
      <Navbar />

      {(roomError || socketError) && (
        <div className="border-b border-arena-border px-4 py-2 md:px-6">
          <Alert variant="warning">{roomError || socketError}</Alert>
        </div>
      )}

      <RoomMobileBar
        snapshot={snapshot}
        onOpenPlayers={() => setPlayersOpen(true)}
        onOpenActivity={() => setActivityOpen(true)}
      />

      <div className="flex min-h-0 flex-1">
        <PlayersSidebar
          snapshot={snapshot}
          currentUserId={user?.id}
          className="hidden md:flex"
        />
        <BattleFeed snapshot={snapshot} onRefresh={onRefresh} />
        <ActivitySidebar events={activity} className="hidden md:flex" />
      </div>

      <MobileDrawer open={playersOpen} onClose={() => setPlayersOpen(false)}>
        <PlayersSidebar snapshot={snapshot} currentUserId={user?.id} />
      </MobileDrawer>

      <MobileDrawerRight
        open={activityOpen}
        onClose={() => setActivityOpen(false)}
      >
        <ActivitySidebar events={activity} />
      </MobileDrawerRight>
    </div>
  );
}
