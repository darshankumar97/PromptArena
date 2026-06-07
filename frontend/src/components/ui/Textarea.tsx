import { cn } from "@/lib/cn";

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-[120px] w-full resize-none rounded border border-arena-border bg-arena-surface px-3 py-3 text-[15px] text-arena-text-primary leading-[1.6]",
        "placeholder:text-arena-text-muted",
        "focus:border-arena-accent/60 focus:outline-none focus:ring-2 focus:ring-arena-accent/20",
        "disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
}
