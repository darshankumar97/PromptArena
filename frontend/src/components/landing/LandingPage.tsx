"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { api, ApiRequestError } from "@/lib/api";
import { loadLastRoomCode } from "@/lib/auth-storage";
import { consumeSessionExpiredMessage } from "@/lib/session-expired";
import { useAuthStore } from "@/stores/authStore";

export function LandingPage() {
  const router = useRouter();
  const hydrate = useAuthStore((s) => s.hydrate);
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const hydrated = useAuthStore((s) => s.hydrated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const authError = useAuthStore((s) => s.error);

  const [displayName, setDisplayName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [lastRoom, setLastRoom] = useState<string | null>(null);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);

  useEffect(() => {
    hydrate();
    setLastRoom(loadLastRoomCode());
    setSessionNotice(consumeSessionExpiredMessage());
  }, [hydrate]);

  useEffect(() => {
    if (user?.display_name) setDisplayName(user.display_name);
  }, [user]);

  const ensureAuth = async () => {
    if (accessToken && user) return;
    if (!displayName.trim()) {
      setActionError("Enter a display name");
      throw new Error("name required");
    }
    await login(displayName.trim());
  };

  const createRoom = async () => {
    setActionError(null);
    setBusy("create");
    try {
      await ensureAuth();
      const token = useAuthStore.getState().accessToken!;
      const { room } = await api.createRoom(token);
      router.push(`/room/${room.code}`);
    } catch (e) {
      if (!(e instanceof Error && e.message === "name required")) {
        setActionError(
          e instanceof ApiRequestError ? e.message : "Could not create room",
        );
      }
    } finally {
      setBusy(null);
    }
  };

  const joinRoom = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      setActionError("Enter a room code");
      return;
    }
    setActionError(null);
    setBusy("join");
    try {
      await ensureAuth();
      router.push(`/room/${code}`);
    } catch (e) {
      if (!(e instanceof Error && e.message === "name required")) {
        setActionError(
          e instanceof ApiRequestError ? e.message : "Could not join",
        );
      }
    } finally {
      setBusy(null);
    }
  };

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-400" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -20%, rgb(99 102 241 / 0.25), transparent), radial-gradient(ellipse 60% 40% at 100% 50%, rgb(139 92 246 / 0.12), transparent)",
        }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
        <div className="mb-10 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-indigo-400/80">
            AI Creative Battle Room
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-zinc-50">
            PromptArena
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-500">
            Enter the arena. Submit one prompt. Watch AI campaigns collide in
            realtime. One round. One winner.
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-6 shadow-2xl shadow-black/40 backdrop-blur-sm">
          <label className="block text-xs font-medium text-zinc-500">
            Display name
          </label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your battle name"
            className="mt-2 w-full rounded-lg border border-zinc-700/80 bg-zinc-950/80 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
          />

          {user && (
            <p className="mt-3 text-xs text-zinc-500">
              Signed in as{" "}
              <span className="text-zinc-300">{user.display_name}</span>
              <button
                type="button"
                onClick={() => logout()}
                className="ml-2 text-indigo-400 hover:text-indigo-300"
              >
                Switch user
              </button>
            </p>
          )}

          {sessionNotice && (
            <p className="mt-4 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              {sessionNotice}
            </p>
          )}

          {(actionError || authError) && (
            <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {actionError || authError}
            </p>
          )}

          <div className="mt-6 space-y-3">
            <Button
              className="w-full"
              loading={busy === "create" || isLoading}
              onClick={createRoom}
            >
              Create room
            </Button>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-800" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-zinc-900/50 px-2 text-zinc-600">or join</span>
              </div>
            </div>

            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Room code"
              maxLength={8}
              className="w-full rounded-lg border border-zinc-700/80 bg-zinc-950/80 px-4 py-3 text-center font-mono text-sm tracking-widest text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-500/50 focus:outline-none"
            />
            <Button
              variant="secondary"
              className="w-full"
              loading={busy === "join"}
              onClick={joinRoom}
            >
              Join room
            </Button>

            {lastRoom && (
              <Button
                variant="ghost"
                className="w-full text-zinc-400"
                onClick={() => router.push(`/room/${lastRoom}`)}
              >
                Rejoin last room ({lastRoom})
              </Button>
            )}
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-zinc-600">
          Backend must be running at{" "}
          {process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}
        </p>
      </div>
    </div>
  );
}
