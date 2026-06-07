import { cn } from "@/lib/cn";

type Variant = "info" | "success" | "warning" | "error";

const styles: Record<Variant, string> = {
  info: "border-arena-border bg-arena-surface text-arena-text-secondary",
  success: "border-arena-success/30 bg-arena-success-subtle text-arena-success",
  warning: "border-arena-accent/30 bg-arena-accent-subtle text-arena-accent",
  error: "border-arena-danger/30 bg-arena-danger-subtle text-arena-danger",
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
        "rounded border px-3 py-2 text-[13px] leading-[1.6]",
        styles[variant],
        className,
      )}
    >
      {children}
    </p>
  );
}
