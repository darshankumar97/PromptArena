import { cn } from "@/lib/cn";

type Variant = "info" | "success" | "warning" | "error";

const styles: Record<Variant, string> = {
  info: "border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)]",
  success: "border-emerald-900/50 bg-emerald-950/30 text-emerald-200",
  warning: "border-amber-900/50 bg-amber-950/30 text-amber-200",
  error: "border-red-900/50 bg-red-950/30 text-red-200",
};

export function Alert({
  children,
  variant = "info",
  className,
}: {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "rounded-md border px-3 py-2 text-xs leading-relaxed",
        styles[variant],
        className,
      )}
    >
      {children}
    </p>
  );
}
