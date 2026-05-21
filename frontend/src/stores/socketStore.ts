import { create } from "zustand";

export type SocketStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "authenticated"
  | "error";

interface SocketState {
  status: SocketStatus;
  lastError: string | null;
  setStatus: (status: SocketStatus) => void;
  setError: (message: string | null) => void;
  reset: () => void;
}

export const useSocketStore = create<SocketState>((set) => ({
  status: "idle",
  lastError: null,
  setStatus: (status) =>
    set((s) => ({
      status,
      lastError: status === "error" ? s.lastError : null,
    })),
  setError: (lastError) => set({ lastError, status: "error" }),
  reset: () => set({ status: "idle", lastError: null }),
}));
