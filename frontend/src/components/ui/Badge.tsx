import { cn } from "@/lib/cn";

const variants: Record<string, string> = {
  default: "bg-zinc-800 text-zinc-300 ring-zinc-700",
  lobby: "bg-zinc-800/80 text-zinc-400 ring-zinc-700",
  prompting: "bg-blue-500/15 text-blue-300 ring-blue-500/30",
  resolving: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  results: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  finished: "bg-zinc-800 text-zinc-500 ring-zinc-700",
  online: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/25",
  offline: "bg-zinc-800 text-zinc-500 ring-zinc-700",
  winner: "bg-violet-500/20 text-violet-300 ring-violet-500/35",
  host: "bg-indigo-500/15 text-indigo-300 ring-indigo-500/30",
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
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        variants[variant] ?? variants.default,
        className,
      )}
    >
      {children}
    </span>
  );
}
