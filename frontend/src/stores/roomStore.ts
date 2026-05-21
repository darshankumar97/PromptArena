import { create } from "zustand";

import type { ActivityEvent, RoomSnapshot } from "@/types";

const MAX_ACTIVITY = 80;

interface RoomState {
  snapshot: RoomSnapshot | null;
  activity: ActivityEvent[];
  roomError: string | null;
  actionLoading: string | null;

  applySnapshot: (snapshot: RoomSnapshot) => void;
  appendActivity: (event: ActivityEvent) => void;
  setActivity: (events: ActivityEvent[]) => void;
  setRoomError: (error: string | null) => void;
  setActionLoading: (key: string | null) => void;
  reset: () => void;
}

export const useRoomStore = create<RoomState>((set, get) => ({
  snapshot: null,
  activity: [],
  roomError: null,
  actionLoading: null,

  applySnapshot: (snapshot) => set({ snapshot, roomError: null }),

  appendActivity: (event) => {
    const { activity } = get();
    if (activity.some((e) => e.id === event.id)) return;
    const next = [...activity, event].slice(-MAX_ACTIVITY);
    set({ activity: next });
  },

  setActivity: (events) => set({ activity: events.slice(-MAX_ACTIVITY) }),

  setRoomError: (roomError) => set({ roomError }),

  setActionLoading: (actionLoading) => set({ actionLoading }),

  reset: () =>
    set({
      snapshot: null,
      activity: [],
      roomError: null,
      actionLoading: null,
    }),
}));
