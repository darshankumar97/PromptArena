"use client";

import Link from "next/link";
import { useEffect } from "react";

import { loadStoredAuth } from "@/lib/auth-storage";
import { useAuthStore } from "@/stores/authStore";

export function Navbar({
  title,
  showBattlesLink = true,
}: {
  title?: React.ReactNode;
  showBattlesLink?: boolean;
}) {
  const hydrate = useAuthStore((s) => s.hydrate);
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const hasSession = Boolean(accessToken || loadStoredAuth().accessToken);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <header className="h-14 shrink-0 border-b border-arena-border bg-arena-bg">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-4 md:px-6">
        <div className="flex min-w-0 items-center">
          {title ?? (
            <Link
              href="/"
              className="text-[15px] font-medium leading-none text-arena-text-primary"
            >
              Prompt<span className="text-arena-accent">·</span>Arena
            </Link>
          )}
        </div>

        <nav className="hidden items-center gap-1 md:flex">
          {showBattlesLink && hasSession && (
            <Link
              href="/battles"
              className="inline-flex h-9 items-center rounded px-4 text-[13px] text-arena-text-secondary hover:bg-arena-elevated hover:text-arena-text-primary"
            >
              My Battles
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          {user && (
            <>
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-arena-accent"
                aria-hidden
              />
              <span className="text-[13px] text-arena-text-secondary">
                {user.display_name}
              </span>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
