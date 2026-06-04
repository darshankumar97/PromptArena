import { cn } from "@/lib/cn";

export function Card({
  children,
  className,
  padding = "md",
}: {
  children: React.ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
}) {
  const paddingClass = {
    none: "",
    sm: "p-4",
    md: "p-5",
    lg: "p-6",
  }[padding];

  return (
    <div
      className={cn(
        "rounded-lg border border-[var(--border)] bg-[var(--card)]",
        paddingClass,
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-medium text-[var(--foreground)]">{title}</h3>
      {description && (
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">{description}</p>
      )}
    </div>
  );
}
