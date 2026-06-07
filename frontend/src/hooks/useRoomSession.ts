"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { api } from "@/lib/api";
import { consumeJoinIntent } from "@/lib/auth-storage";
import {
  handleSessionExpired,
  isUnauthorizedResponse,
} from "@/lib/session-expired";
import {
  authenticateSocket,
  connectSocket,
  disconnectSocket,
  getSocket,
  bindSpectatorListener,
  joinRoomSocket,
} from "@/lib/socket";
import { useAuthStore } from "@/stores/authStore";
import { useRoomStore } from "@/stores/roomStore";
import { useSocketStore } from "@/stores/socketStore";
import type { ActivityEvent, RoomSnapshot } from "@/types";

const log = (message: string, detail?: unknown) => {
  if (process.env.NODE_ENV !== "production") {
    console.info(`[room-session] ${message}`, detail ?? "");
  } else {
    console.info(`[room-session] ${message}`);
  }
};

export function useRoomSession(roomCode: string) {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const applySnapshot = useRoomStore((s) => s.applySnapshot);
  const appendActivity = useRoomStore((s) => s.appendActivity);
  const setActivity = useRoomStore((s) => s.setActivity);
  const setRoomError = useRoomStore((s) => s.setRoomError);
  const resetRoom = useRoomStore((s) => s.reset);
  const setSocketStatus = useSocketStore((s) => s.setStatus);
  const setSocketError = useSocketStore((s) => s.setError);
  const resetSocket = useSocketStore((s) => s.reset);

  const roomIdRef = useRef<number | null>(null);

  const refreshPersonalSnapshot = useCallback(
    async (roomId: number) => {
      const token = useAuthStore.getState().accessToken;
      if (!token) return;
      try {
        const { snapshot } = await api.getSnapshot(token, roomId);
        applySnapshot(snapshot);
      } catch {
        // personal snapshot optional; room broadcast is authoritative
      }
    },
    [applySnapshot],
  );

  useEffect(() => {
    if (!accessToken || !roomCode) return;

    let cancelled = false;

    const setup = async () => {
      resetRoom();
      setSocketStatus("connecting");
      setRoomError(null);
      log("setup started", { roomCode });

      try {
        consumeJoinIntent(roomCode);

        const ensureParticipantViaRest = async () => {
          log("rest join requested", { roomCode });
          const { snapshot } = await api.joinRoomByCode(accessToken, roomCode);
          if (cancelled) return;
          log("rest join acknowledged", { roomId: snapshot.room.id });
          applySnapshot(snapshot);
          roomIdRef.current = snapshot.room.id;
        };

        await connectSocket();
        if (cancelled) return;

        setSocketStatus("connected");
        await authenticateSocket(accessToken);
        if (cancelled) return;

        setSocketStatus("authenticated");

        try {
          await ensureParticipantViaRest();
        } catch (e) {
          log("rest join failed", e instanceof Error ? e.message : e);
          if (!cancelled) {
            const message =
              e instanceof Error ? e.message : "Could not join room via API";
            setRoomError(message);
          }
        }
        if (cancelled) return;

        const socket = getSocket();
        bindSpectatorListener(socket);

        socket.on("room_snapshot", (payload: RoomSnapshot) => {
          log("room_snapshot received", { roomId: payload.room.id });
          applySnapshot(payload);
          roomIdRef.current = payload.room.id;
        });

        socket.on("activity", (data: { event: ActivityEvent }) => {
          if (data?.event) appendActivity(data.event);
        });

        socket.on("error", (payload: { code?: string; message?: string }) => {
          if (
            isUnauthorizedResponse(401, payload?.code, payload?.message)
          ) {
            handleSessionExpired();
            return;
          }
          if (payload?.message) setRoomError(payload.message);
        });

        socket.on("connect", async () => {
          setSocketStatus("connecting");
          try {
            await authenticateSocket(accessToken);
            setSocketStatus("authenticated");
            if (roomCode) joinRoomSocket(roomCode);
            const rid = roomIdRef.current;
            if (rid) await refreshPersonalSnapshot(rid);
          } catch (e) {
            setSocketError(
              e instanceof Error ? e.message : "Reconnection failed",
            );
          }
        });

        socket.on("disconnect", () => {
          setSocketStatus("connecting");
        });

        socket.on("submission_saved", () => {
          const rid = roomIdRef.current;
          if (rid) void refreshPersonalSnapshot(rid);
        });

        socket.on("room_ended", () => {
          log("room_ended received");
          router.replace("/");
        });

        joinRoomSocket(roomCode);

        const waitForRoom = async () => {
          for (let i = 0; i < 30; i++) {
            const snap = useRoomStore.getState().snapshot;
            if (snap?.room.id) {
              roomIdRef.current = snap.room.id;
              const { events } = await api.getActivity(
                accessToken,
                snap.room.id,
                0,
              );
              setActivity(events);
              await refreshPersonalSnapshot(snap.room.id);
              log("room state ready", { roomId: snap.room.id, source: "snapshot" });
              return;
            }
            await new Promise((r) => setTimeout(r, 200));
          }
          try {
            await ensureParticipantViaRest();
          } catch {
            // error already surfaced above
          }
          const snap = useRoomStore.getState().snapshot;
          if (snap?.room.id) {
            roomIdRef.current = snap.room.id;
            log("room state ready", { roomId: snap.room.id, source: "rest-fallback" });
            return;
          }
          const message = "Timed out loading room state. Try refreshing again.";
          log("timeout", { roomCode, source: "waitForRoom" });
          setRoomError(message);
        };
        await waitForRoom();
      } catch (e) {
        if (!cancelled) {
          setSocketError(
            e instanceof Error ? e.message : "Could not connect to room",
          );
          setRoomError(
            e instanceof Error ? e.message : "Could not connect to room",
          );
        }
      }
    };

    setup();

    return () => {
      cancelled = true;
      const socket = getSocket();
      socket.off("room_snapshot");
      socket.off("activity");
      socket.off("error");
      socket.off("connect");
      socket.off("disconnect");
      socket.off("submission_saved");
      socket.off("room_ended");
      disconnectSocket();
      resetRoom();
      resetSocket();
      roomIdRef.current = null;
    };
  }, [
    accessToken,
    roomCode,
    applySnapshot,
    appendActivity,
    setActivity,
    setRoomError,
    resetRoom,
    setSocketStatus,
    setSocketError,
    resetSocket,
    refreshPersonalSnapshot,
    router,
  ]);

  return { refreshPersonalSnapshot, roomId: roomIdRef.current };
}
