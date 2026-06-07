import type { User } from "@/types";

const ACCESS = "pa_access_token";
const REFRESH = "pa_refresh_token";
const USER = "pa_user";
const LAST_ROOM = "pa_last_room";
const JOIN_INTENT = "pa_join_intent";

export function markJoinIntent(roomCode: string): void {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(JOIN_INTENT, roomCode.toUpperCase());
  }
}

export function consumeJoinIntent(roomCode: string): boolean {
  if (typeof window === "undefined") return false;
  const code = roomCode.toUpperCase();
  const intent = sessionStorage.getItem(JOIN_INTENT);
  if (intent === code) {
    sessionStorage.removeItem(JOIN_INTENT);
    return true;
  }
  return false;
}

export function saveLastRoomCode(code: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(LAST_ROOM, code.toUpperCase());
  }
}

export function loadLastRoomCode(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LAST_ROOM);
}

export function loadStoredAuth(): {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
} {
  if (typeof window === "undefined") {
    return { accessToken: null, refreshToken: null, user: null };
  }
  const accessToken = localStorage.getItem(ACCESS);
  const refreshToken = localStorage.getItem(REFRESH);
  const raw = localStorage.getItem(USER);
  let user: User | null = null;
  if (raw) {
    try {
      user = JSON.parse(raw) as User;
    } catch {
      user = null;
    }
  }
  return { accessToken, refreshToken, user };
}

export function saveAuth(
  accessToken: string,
  refreshToken: string,
  user: User,
): void {
  localStorage.setItem(ACCESS, accessToken);
  localStorage.setItem(REFRESH, refreshToken);
  localStorage.setItem(USER, JSON.stringify(user));
}

export function clearAuth(): void {
  localStorage.removeItem(ACCESS);
  localStorage.removeItem(REFRESH);
  localStorage.removeItem(USER);
}
