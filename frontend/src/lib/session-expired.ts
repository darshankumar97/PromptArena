import { clearAuth } from "@/lib/auth-storage";

const MESSAGE_KEY = "pa_session_expired_message";

export const SESSION_EXPIRED_MESSAGE =
  "Session expired. Please rejoin the arena.";

let handling = false;

export function isUnauthorizedResponse(
  status: number,
  code?: string,
  message?: string,
): boolean {
  if (status === 401) return true;
  const normalizedCode = (code || "").toUpperCase();
  if (
    normalizedCode === "TOKEN_EXPIRED" ||
    normalizedCode === "INVALID_TOKEN" ||
    normalizedCode === "UNAUTHORIZED"
  ) {
    return true;
  }
  const text = (message || "").toLowerCase();
  return text.includes("expired") || text.includes("invalid token");
}

export function isSessionExpiredError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { status?: number; code?: string; message?: string };
  if (typeof err.status !== "number") return false;
  return isUnauthorizedResponse(err.status, err.code, err.message);
}

export function consumeSessionExpiredMessage(): string | null {
  if (typeof window === "undefined") return null;
  const message = sessionStorage.getItem(MESSAGE_KEY);
  if (message) sessionStorage.removeItem(MESSAGE_KEY);
  return message;
}

export function handleSessionExpired(): void {
  if (typeof window === "undefined" || handling) return;
  handling = true;

  clearAuth();
  sessionStorage.setItem(MESSAGE_KEY, SESSION_EXPIRED_MESSAGE);

  void import("@/stores/authStore").then(({ useAuthStore }) => {
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      error: null,
    });
  });

  void import("@/lib/socket").then(({ disconnectSocket }) => {
    disconnectSocket();
  });

  if (window.location.pathname !== "/") {
    window.location.replace("/");
    return;
  }

  handling = false;
}
