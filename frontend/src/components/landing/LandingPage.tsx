"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Navbar } from "@/components/layout/Navbar";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { api, ApiRequestError } from "@/lib/api";
import { loadLastRoomCode, markJoinIntent } from "@/lib/auth-storage";
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
      markJoinIntent(room.code);
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
      markJoinIntent(code);
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
      <div className="flex min-h-screen items-center justify-center bg-arena-bg">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-arena-bg">
      <Navbar showBattlesLink />

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-12 md:px-6">
        <div className="mb-12 text-center">
          <h1 className="text-[22px] font-medium leading-[1.2] text-arena-text-primary">
            Prompt<span className="text-arena-accent">Arena</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xs text-[15px] text-arena-text-secondary">
            Compete. Prompt. Win.
          </p>
        </div>

        <div className="mb-8 w-full max-w-2xl">
          <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.06em] text-arena-text-muted">
            Display name
          </label>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="How others see you"
          />
          {user && (
            <p className="mt-3 text-[13px] text-arena-text-muted">
              Signed in as{" "}
              <span className="text-arena-text-primary">{user.display_name}</span>
              <button
                type="button"
                onClick={() => logout()}
                className="ml-2 text-arena-accent hover:text-arena-text-primary"
              >
                Switch user
              </button>
            </p>
          )}
        </div>

        {(sessionNotice || actionError || authError) && (
          <div className="mb-8 w-full max-w-2xl space-y-3">
            {sessionNotice && (
              <Alert variant="warning">{sessionNotice}</Alert>
            )}
            {(actionError || authError) && (
              <Alert variant="error">{actionError || authError}</Alert>
            )}
          </div>
        )}

        <div className="grid w-full max-w-2xl gap-4 md:grid-cols-2">
          <Card padding="lg">
            <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.06em] text-arena-text-muted">
              Host a battle
            </p>
            <p className="mb-6 text-[13px] text-arena-text-secondary">
              Create a room and invite others with your code. Set the battle
              theme when you start the round.
            </p>
            <Button
              className="w-full"
              loading={busy === "create" || isLoading}
              onClick={createRoom}
            >
              Create Room →
            </Button>
          </Card>

          <Card padding="lg">
            <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.06em] text-arena-text-muted">
              Join a battle
            </p>
            <Input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Room code"
              maxLength={8}
              className="mb-4 text-center font-mono tracking-[0.2em]"
            />
            <Button
              className="w-full"
              loading={busy === "join"}
              onClick={joinRoom}
            >
              Join Room →
            </Button>
            {lastRoom && (
              <Button
                variant="ghost"
                className="mt-2 w-full"
                onClick={() => {
                  markJoinIntent(lastRoom);
                  router.push(`/room/${lastRoom}`);
                }}
              >
                Rejoin {lastRoom}
              </Button>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}
