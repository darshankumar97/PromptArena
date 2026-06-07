import { cn } from "@/lib/cn";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-9 w-full rounded border border-arena-border bg-arena-surface px-3 text-[15px] text-arena-text-primary leading-none",
        "placeholder:text-arena-text-muted",
        "focus:border-arena-border-strong focus:outline-none focus:ring-2 focus:ring-arena-accent/20",
        "disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
}
