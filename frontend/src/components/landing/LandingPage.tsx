"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import API_BASE from "@/config/api";
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
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--border-subtle)]">
        <div className="mx-auto flex h-14 max-w-5xl items-center px-6">
          <span className="text-sm font-semibold text-[var(--foreground)]">
            PromptArena
          </span>
        </div>
      </header>

      <main className="mx-auto flex max-w-md flex-col px-6 py-16">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
            AI creative battles
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">
            Create or join a room, submit one prompt per round, and compete in
            realtime. The host locks submissions and picks a winner.
          </p>
        </div>

        <Card padding="lg">
          <label className="block text-xs font-medium text-[var(--muted-foreground)]">
            Display name
          </label>
          <Input
            className="mt-1.5"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="How others see you"
          />

          {user && (
            <p className="mt-3 text-xs text-[var(--muted)]">
              Signed in as{" "}
              <span className="text-[var(--foreground)]">{user.display_name}</span>
              <button
                type="button"
                onClick={() => logout()}
                className="ml-2 text-[var(--accent)] hover:underline"
              >
                Switch user
              </button>
            </p>
          )}

          {sessionNotice && (
            <Alert variant="warning" className="mt-4">
              {sessionNotice}
            </Alert>
          )}

          {(actionError || authError) && (
            <Alert variant="error" className="mt-4">
              {actionError || authError}
            </Alert>
          )}

          <div className="mt-6 space-y-3">
            <Button
              className="w-full"
              loading={busy === "create" || isLoading}
              onClick={createRoom}
            >
              Create room
            </Button>

            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[var(--border)]" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-[var(--card)] px-2 text-xs text-[var(--muted)]">
                  or join with code
                </span>
              </div>
            </div>

            <Input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Room code"
              maxLength={8}
              className="text-center font-mono tracking-widest"
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
                className="w-full"
                onClick={() => router.push(`/room/${lastRoom}`)}
              >
                Rejoin {lastRoom}
              </Button>
            )}
          </div>
        </Card>

        <p className="mt-6 text-center text-xs text-[var(--muted)]">
          API: {API_BASE}
        </p>
      </main>
    </div>
  );
}
