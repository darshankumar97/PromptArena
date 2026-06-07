"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Navbar } from "@/components/layout/Navbar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { loadStoredAuth } from "@/lib/auth-storage";
import {
  ApiRequestError,
  getAdminBattles,
  getAdminUsers,
  grantAdmin,
} from "@/lib/api";
import { cn } from "@/lib/cn";
import type { AdminBattle, AdminUser } from "@/types";

type Tab = "battles" | "users";

function formatPlayedAt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("battles");
  const [token, setToken] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [battles, setBattles] = useState<AdminBattle[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);

  const loadBattles = useCallback(async (accessToken: string) => {
    const data = await getAdminBattles(accessToken);
    setBattles(data);
  }, []);

  const loadUsers = useCallback(async (accessToken: string) => {
    const data = await getAdminUsers(accessToken);
    setUsers(data);
  }, []);

  const load = useCallback(async () => {
    const { accessToken } = loadStoredAuth();
    if (!accessToken) {
      router.replace("/");
      return;
    }
    setToken(accessToken);
    setLoading(true);
    setError(null);
    setDenied(false);
    try {
      await loadBattles(accessToken);
      await loadUsers(accessToken);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) {
        setDenied(true);
      } else if (e instanceof ApiRequestError && e.status === 401) {
        router.replace("/");
      } else {
        setError(
          e instanceof ApiRequestError ? e.message : "Couldn't load admin data",
        );
      }
    } finally {
      setLoading(false);
    }
  }, [loadBattles, loadUsers, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const onGrant = async (userId: number) => {
    if (!token) return;
    try {
      await grantAdmin(token, userId);
      await loadUsers(token);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "Grant failed");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-arena-bg">
        <Spinner size="lg" />
      </div>
    );
  }

  if (denied) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-arena-bg px-6">
        <p className="text-[15px] text-arena-text-primary">
          Access denied. Admins only.
        </p>
        <Link
          href="/"
          className="text-[13px] text-arena-accent hover:text-arena-text-primary"
        >
          Back home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-arena-bg">
      <Navbar
        title={
          <span className="text-[15px] font-medium text-arena-text-primary">
            Admin
          </span>
        }
        showBattlesLink={false}
      />

      <main className="mx-auto max-w-[1200px] px-4 pb-16 pt-12 md:px-6">
        <h1 className="text-[22px] font-medium leading-[1.2] text-arena-text-primary">
          Admin
        </h1>
        <p className="mt-2 text-[15px] text-arena-text-muted">
          Internal overview
        </p>

        <div className="mt-8 border-b border-arena-border">
          <div className="flex gap-6">
            {(["battles", "users"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  "border-b-2 pb-3 text-[15px] leading-none transition-colors duration-150",
                  tab === t
                    ? "border-arena-accent font-medium text-arena-text-primary"
                    : "border-transparent text-arena-text-secondary hover:text-arena-text-primary",
                )}
              >
                {t === "battles" ? "Battle History" : "Users"}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="mt-4 text-[15px] text-arena-danger">{error}</p>
        )}

        {tab === "battles" && (
          <div className="mt-6 overflow-x-auto rounded-md border border-arena-border bg-arena-surface">
            {battles.length === 0 ? (
              <p className="p-6 text-[15px] text-arena-text-secondary">
                No completed battles.
              </p>
            ) : (
              <div>
                {battles.map((b) => {
                  const isExpanded = expanded === b.room_id;
                  return (
                    <div
                      key={b.room_id}
                      className="border-b border-arena-border/60 last:border-0"
                    >
                      <button
                        type="button"
                        className="grid w-full min-w-[640px] grid-cols-[auto_1fr_1fr_1fr_1fr_1fr] items-center gap-4 px-4 py-3 text-left hover:bg-arena-elevated/50"
                        onClick={() =>
                          setExpanded(isExpanded ? null : b.room_id)
                        }
                      >
                        <ChevronRight
                          className={cn(
                            "h-4 w-4 shrink-0 text-arena-text-muted transition-transform duration-150",
                            isExpanded && "rotate-90",
                          )}
                          aria-hidden
                        />
                        <span className="text-[15px] text-arena-text-primary">
                          {b.battle_theme}
                        </span>
                        <span className="text-[15px] text-arena-text-secondary">
                          {formatPlayedAt(b.played_at)}
                        </span>
                        <span className="text-[15px] text-arena-text-secondary">
                          {b.winner_display_name}
                        </span>
                        <span className="font-mono text-[15px] text-arena-text-primary">
                          {b.winner_score.toFixed(1)}
                        </span>
                        <span className="font-mono text-[15px] text-arena-text-primary">
                          {b.total_players}
                        </span>
                      </button>
                      {isExpanded && (
                        <div className="border-t border-arena-border bg-arena-bg pl-10 pr-4 py-4">
                          <table className="w-full text-left">
                            <thead>
                              <tr className="border-b border-arena-border">
                                <th className="pb-2 pr-4 text-[11px] font-medium uppercase tracking-[0.06em] text-arena-text-muted">
                                  Rank
                                </th>
                                <th className="pb-2 pr-4 text-[11px] font-medium uppercase tracking-[0.06em] text-arena-text-muted">
                                  Player
                                </th>
                                <th className="pb-2 pr-4 text-[11px] font-medium uppercase tracking-[0.06em] text-arena-text-muted">
                                  Score
                                </th>
                                <th className="pb-2 pr-4 text-[11px] font-medium uppercase tracking-[0.06em] text-arena-text-muted">
                                  Prompt
                                </th>
                                <th className="pb-2 text-[11px] font-medium uppercase tracking-[0.06em] text-arena-text-muted">
                                  Reason
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {b.submissions.map((s) => (
                                <tr
                                  key={`${b.room_id}-${s.display_name}-${s.rank}`}
                                  className="h-12 border-b border-arena-border/60"
                                >
                                  <td className="py-2 pr-4 font-mono text-[15px]">
                                    #{s.rank}
                                  </td>
                                  <td className="py-2 pr-4 text-[15px]">
                                    {s.display_name}
                                  </td>
                                  <td className="py-2 pr-4 font-mono text-[15px]">
                                    {s.score.toFixed(1)}
                                  </td>
                                  <td
                                    className="max-w-[200px] truncate py-2 pr-4 text-[13px] text-arena-text-secondary"
                                    title={s.prompt_text}
                                  >
                                    {s.prompt_text.slice(0, 80)}
                                    {s.prompt_text.length > 80 ? "…" : ""}
                                  </td>
                                  <td className="py-2 text-[13px] text-arena-text-secondary">
                                    {s.judge_reason}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "users" && (
          <div className="mt-6 overflow-x-auto rounded-md border border-arena-border bg-arena-surface">
            <table className="w-full min-w-[560px] text-left">
              <thead>
                <tr className="border-b border-arena-border">
                  <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.06em] text-arena-text-muted">
                    Display Name
                  </th>
                  <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.06em] text-arena-text-muted">
                    Battles
                  </th>
                  <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.06em] text-arena-text-muted">
                    Wins
                  </th>
                  <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.06em] text-arena-text-muted">
                    Admin Status
                  </th>
                  <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.06em] text-arena-text-muted">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className="h-12 border-b border-arena-border/60 hover:bg-arena-elevated/50"
                  >
                    <td className="px-4 text-[15px] text-arena-text-primary">
                      {u.display_name}
                    </td>
                    <td className="px-4 font-mono text-[15px]">
                      {u.battle_count}
                    </td>
                    <td className="px-4 font-mono text-[15px]">{u.wins}</td>
                    <td className="px-4">
                      {u.is_admin ? (
                        <Badge variant="winner">Admin</Badge>
                      ) : (
                        <span className="text-[13px] text-arena-text-muted">
                          User
                        </span>
                      )}
                    </td>
                    <td className="px-4">
                      {!u.is_admin && (
                        <Button
                          variant="secondary"
                          className="h-7 text-[13px]"
                          onClick={() => void onGrant(u.id)}
                        >
                          Grant Admin
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
