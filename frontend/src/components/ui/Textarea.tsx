import { cn } from "@/lib/cn";

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full resize-none rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)]",
        "placeholder:text-[var(--muted)]",
        "focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
