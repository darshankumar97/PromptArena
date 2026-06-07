import { cn } from "@/lib/cn";

export function Spinner({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: "h-4 w-4 border",
    md: "h-6 w-6 border-2",
    lg: "h-8 w-8 border-2",
  };
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        "inline-block animate-spin rounded-full border-arena-border border-t-arena-text-primary",
        sizes[size],
        className,
      )}
    />
  );
}
