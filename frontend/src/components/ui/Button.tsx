import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const styles: Record<Variant, string> = {
  primary:
    "bg-gradient-to-r from-indigo-500 to-violet-600 text-white hover:from-indigo-400 hover:to-violet-500 shadow-lg shadow-indigo-950/40",
  secondary:
    "bg-zinc-800 text-zinc-100 ring-1 ring-zinc-700 hover:bg-zinc-700",
  ghost: "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60",
  danger: "bg-red-500/15 text-red-300 ring-1 ring-red-500/30 hover:bg-red-500/25",
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
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50",
        styles[variant],
        className,
      )}
      {...props}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      )}
      {children}
    </button>
  );
}
