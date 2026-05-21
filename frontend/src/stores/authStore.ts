import { create } from "zustand";

import { api, ApiRequestError } from "@/lib/api";
import { clearAuth, loadStoredAuth, saveAuth } from "@/lib/auth-storage";
import {
  handleSessionExpired,
  isSessionExpiredError,
} from "@/lib/session-expired";
import type { User } from "@/types";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  hydrated: boolean;
  isLoading: boolean;
  error: string | null;

  hydrate: () => Promise<void>;
  login: (displayName: string) => Promise<void>;
  logout: () => void;
  ensureToken: () => string | null;
  setError: (error: string | null) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  hydrated: false,
  isLoading: false,
  error: null,

  setError: (error) => set({ error }),

  hydrate: async () => {
    const stored = loadStoredAuth();
    if (!stored.accessToken) {
      set({ hydrated: true });
      return;
    }
    try {
      const { user } = await api.me(stored.accessToken);
      set({
        user,
        accessToken: stored.accessToken,
        refreshToken: stored.refreshToken,
        hydrated: true,
        error: null,
      });
      if (stored.refreshToken) {
        saveAuth(stored.accessToken, stored.refreshToken, user);
      }
    } catch (e) {
      if (isSessionExpiredError(e)) {
        handleSessionExpired();
      } else {
        clearAuth();
      }
      set({
        user: null,
        accessToken: null,
        refreshToken: null,
        hydrated: true,
      });
    }
  },

  login: async (displayName) => {
    set({ isLoading: true, error: null });
    try {
      const tokens = await api.register(displayName.trim());
      saveAuth(tokens.access_token, tokens.refresh_token, tokens.user);
      set({
        user: tokens.user,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        isLoading: false,
      });
    } catch (e) {
      const message =
        e instanceof ApiRequestError ? e.message : "Could not sign in";
      set({ isLoading: false, error: message });
      throw e;
    }
  },

  logout: () => {
    clearAuth();
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      error: null,
    });
  },

  ensureToken: () => get().accessToken,
}));
