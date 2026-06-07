"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Navbar } from "@/components/layout/Navbar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { loadStoredAuth } from "@/lib/auth-storage";
import { getMyBattles } from "@/lib/api";
import { ApiRequestError } from "@/lib/api";
import type { BattleHistoryItem } from "@/types";

function formatPlayedAt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function SkeletonRows() {
  return (
    <div className="space-y-0">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="skeleton-shimmer h-12 border-b border-arena-border/60"
        />
      ))}
    </div>
  );
}

export default function BattlesPage() {
  const router = useRouter();
  const [battles, setBattles] = useState<BattleHistoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { accessToken } = loadStoredAuth();
    if (!accessToken) {
      router.replace("/");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getMyBattles(accessToken);
      setBattles(data);
    } catch (e) {
      setError(
        e instanceof ApiRequestError ? e.message : "Couldn't load battle history",
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    if (!battles?.length) {
      return { played: 0, wins: 0, winRate: "0%" };
    }
    const wins = battles.filter((b) => b.i_won).length;
    const played = battles.length;
    const winRate = `${Math.round((wins / played) * 100)}%`;
    return { played, wins, winRate };
  }, [battles]);

  return (
    <div className="min-h-screen bg-arena-bg">
      <Navbar showBattlesLink={false} />

      <main className="mx-auto max-w-[960px] px-4 pb-16 pt-12 md:px-6">
        <h1 className="text-[22px] font-medium leading-[1.2] text-arena-text-primary">
          My Battles
        </h1>
        <p className="mt-2 text-[15px] text-arena-text-muted">
          Your competitive history
        </p>

        <div className="mb-8 mt-8 grid grid-cols-3 gap-3">
          {[
            { label: "Battles played", value: stats.played },
            { label: "Wins", value: stats.wins },
            { label: "Win rate", value: stats.winRate },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-md border border-arena-border bg-arena-surface p-4"
            >
              <p className="font-mono text-[22px] font-medium text-arena-text-primary">
                {stat.value}
              </p>
              <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.06em] text-arena-text-muted">
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto rounded-md border border-arena-border bg-arena-surface">
          {loading && <SkeletonRows />}

          {!loading && error && (
            <div className="space-y-4 p-8 text-center">
              <p className="text-[15px] text-arena-danger">{error}</p>
              <Button variant="secondary" onClick={() => void load()}>
                Retry
              </Button>
            </div>
          )}

          {!loading && !error && battles?.length === 0 && (
            <p className="p-8 text-center text-[15px] text-arena-text-secondary">
              You haven&apos;t played any battles yet.{" "}
              <Link href="/" className="text-arena-accent hover:text-arena-text-primary">
                Join a room
              </Link>{" "}
              to start.
            </p>
          )}

          {!loading && !error && battles && battles.length > 0 && (
            <table className="w-full min-w-[640px] text-left">
              <thead>
                <tr className="border-b border-arena-border">
                  <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.06em] text-arena-text-muted">
                    Theme
                  </th>
                  <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.06em] text-arena-text-muted">
                    Date
                  </th>
                  <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.06em] text-arena-text-muted">
                    Score
                  </th>
                  <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.06em] text-arena-text-muted">
                    Rank
                  </th>
                  <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.06em] text-arena-text-muted">
                    Winner
                  </th>
                  <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.06em] text-arena-text-muted">
                    Result
                  </th>
                </tr>
              </thead>
              <tbody>
                {battles.map((b) => (
                  <tr
                    key={`${b.room_id}-${b.played_at}`}
                    className="h-12 border-b border-arena-border/60 hover:bg-arena-elevated/50"
                  >
                    <td className="px-4 text-[15px] text-arena-text-primary">
                      {b.battle_theme}
                    </td>
                    <td className="px-4 text-[15px] text-arena-text-secondary">
                      {formatPlayedAt(b.played_at)}
                    </td>
                    <td className="px-4 font-mono text-[15px] text-arena-text-primary">
                      {b.my_score != null ? b.my_score.toFixed(1) : "—"}
                    </td>
                    <td className="px-4 font-mono text-[15px] text-arena-text-primary">
                      {b.my_rank != null ? `#${b.my_rank}` : "—"}
                    </td>
                    <td className="px-4 text-[15px] text-arena-text-secondary">
                      {b.winner_display_name}
                    </td>
                    <td className="px-4">
                      <Badge variant={b.i_won ? "success" : "lost"}>
                        {b.i_won ? "Won" : "Lost"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
