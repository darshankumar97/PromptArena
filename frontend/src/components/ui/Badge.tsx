import { cn } from "@/lib/cn";

const variants: Record<string, string> = {
  default: "bg-[var(--card-elevated)] text-[var(--muted-foreground)] border-[var(--border)]",
  lobby: "bg-[var(--card-elevated)] text-[var(--muted)] border-[var(--border)]",
  prompting: "bg-blue-950/50 text-blue-300 border-blue-900/50",
  resolving: "bg-amber-950/50 text-amber-300 border-amber-900/50",
  results: "bg-emerald-950/50 text-emerald-300 border-emerald-900/50",
  finished: "bg-[var(--card-elevated)] text-[var(--muted)] border-[var(--border)]",
  online: "bg-emerald-950/40 text-emerald-400 border-emerald-900/40",
  offline: "bg-[var(--card-elevated)] text-[var(--muted)] border-[var(--border)]",
  winner: "bg-[var(--card-elevated)] text-[var(--foreground)] border-[var(--border)]",
  host: "bg-[var(--card-elevated)] text-[var(--muted-foreground)] border-[var(--border)]",
};

export function Badge({
  children,
  variant = "default",
  className,
}: {
  children: React.ReactNode;
  variant?: keyof typeof variants;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium leading-none",
        variants[variant] ?? variants.default,
        className,
      )}
    >
      {children}
    </span>
  );
}
