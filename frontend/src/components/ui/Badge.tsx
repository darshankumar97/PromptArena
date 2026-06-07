import { cn } from "@/lib/cn";

const variants: Record<string, string> = {
  default: "bg-arena-elevated text-arena-text-secondary",
  lobby: "bg-arena-elevated text-arena-text-secondary",
  prompting: "bg-arena-accent-subtle text-arena-accent",
  resolving: "bg-arena-accent-subtle text-arena-accent",
  results: "bg-arena-success-subtle text-arena-success",
  finished: "bg-arena-elevated text-arena-text-secondary",
  online: "bg-arena-success-subtle text-arena-success",
  offline: "bg-arena-elevated text-arena-text-muted",
  winner: "bg-arena-accent-subtle text-arena-accent",
  host: "bg-arena-elevated text-arena-text-secondary",
  success: "bg-arena-success-subtle text-arena-success",
  lost: "bg-arena-elevated text-arena-text-muted",
  failed: "bg-arena-danger-subtle text-arena-danger",
  live: "bg-arena-accent-subtle text-arena-accent",
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
        "inline-flex h-5 items-center rounded-sm px-2 text-[11px] font-medium leading-none",
        variants[variant] ?? variants.default,
        className,
      )}
    >
      {children}
    </span>
  );
}
