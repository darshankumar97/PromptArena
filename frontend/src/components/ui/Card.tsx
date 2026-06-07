import { cn } from "@/lib/cn";

export function Card({
  children,
  className,
  padding = "md",
  interactive,
}: {
  children: React.ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
  interactive?: boolean;
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
        "rounded-md border border-arena-border bg-arena-surface",
        interactive && "hover:border-arena-border-strong",
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
      <h3 className="text-[17px] font-medium leading-[1.2] text-arena-text-primary">
        {title}
      </h3>
      {description && (
        <p className="mt-2 text-[13px] leading-[1.6] text-arena-text-secondary">
          {description}
        </p>
      )}
    </div>
  );
}
