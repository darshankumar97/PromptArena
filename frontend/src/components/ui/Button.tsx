import { cn } from "@/lib/cn";

import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const styles: Record<Variant, string> = {
  primary:
    "bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-zinc-200 border border-transparent",
  secondary:
    "bg-transparent text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--card-elevated)]",
  ghost:
    "bg-transparent text-[var(--muted-foreground)] border border-transparent hover:text-[var(--foreground)] hover:bg-[var(--card)]",
  danger:
    "bg-transparent text-red-400 border border-red-900/60 hover:bg-red-950/40",
};

export function Button({
  children,
  variant = "primary",
  className,
  loading,
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-2 rounded-md px-3.5 text-sm font-medium transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-50",
        styles[variant],
        className,
      )}
      {...props}
    >
      {loading && <Spinner size="sm" className="border-zinc-500 border-t-zinc-900" />}
      {children}
    </button>
  );
}
