import { io, Socket } from "socket.io-client";

import API_BASE from "@/config/api";
import {
  handleSessionExpired,
  isUnauthorizedResponse,
} from "@/lib/session-expired";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(API_BASE, {
      autoConnect: false,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 12,
      reconnectionDelay: 800,
    });
  }
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}

const log = (message: string, detail?: unknown) => {
  if (process.env.NODE_ENV !== "production") {
    console.info(`[socket] ${message}`, detail ?? "");
  } else {
    console.info(`[socket] ${message}`);
  }
};

export function connectSocket(): Promise<void> {
  const s = getSocket();
  if (s.connected) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const onConnect = () => {
      log("connected", { id: s.id });
      cleanup();
      resolve();
    };
    const onError = (err: Error) => {
      log("connect_error", err.message);
      cleanup();
      reject(err);
    };
    const cleanup = () => {
      s.off("connect", onConnect);
      s.off("connect_error", onError);
    };
    s.on("connect", onConnect);
    s.on("connect_error", onError);
    s.connect();
  });
}

export function authenticateSocket(accessToken: string): Promise<void> {
  const s = getSocket();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Authentication timed out"));
    }, 10000);

    const onAuth = () => {
      log("authenticated");
      clearTimeout(timeout);
      s.off("error", onErr);
      resolve();
    };
    const onErr = (payload: { code?: string; message?: string }) => {
      const code = payload?.code;
      const message = payload?.message;
      if (isUnauthorizedResponse(401, code, message)) {
        clearTimeout(timeout);
        s.off("authenticated", onAuth);
        handleSessionExpired();
        reject(new Error(message || "Authentication failed"));
        return;
      }
      if (code === "MISSING_TOKEN") {
        clearTimeout(timeout);
        s.off("authenticated", onAuth);
        reject(new Error(message || "Authentication failed"));
      }
    };

    s.once("authenticated", onAuth);
    s.on("error", onErr);
    log("authenticate requested");
    s.emit("authenticate", { access_token: accessToken });
  });
}

export function joinRoomSocket(roomCode: string): void {
  const code = roomCode.toUpperCase();
  log("join_room requested", { room_code: code });
  getSocket().emit("join_room", { room_code: code });
}
