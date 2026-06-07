import { cn } from "@/lib/cn";

import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const styles: Record<Variant, string> = {
  primary:
    "bg-arena-accent text-white hover:bg-arena-accent-dim border border-transparent",
  secondary:
    "bg-transparent border border-arena-border text-arena-text-primary hover:border-arena-border-strong hover:bg-arena-elevated",
  ghost:
    "bg-transparent border-none text-arena-text-secondary hover:bg-arena-elevated hover:text-arena-text-primary",
  danger:
    "bg-arena-danger-subtle border border-arena-danger text-arena-danger hover:bg-arena-danger hover:text-white",
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
        "inline-flex h-9 items-center justify-center gap-2 rounded px-4 text-[15px] font-medium leading-none",
        "disabled:cursor-not-allowed disabled:opacity-40",
        styles[variant],
        className,
      )}
      {...props}
    >
      {loading ? (
        <Spinner size="sm" className="border-white/30 border-t-white" />
      ) : (
        children
      )}
    </button>
  );
}
