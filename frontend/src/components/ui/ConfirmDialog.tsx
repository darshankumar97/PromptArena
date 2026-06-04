"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, loading, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/70"
        onClick={loading ? undefined : onCancel}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-desc"
        className={cn(
          "relative w-full max-w-md rounded-lg border border-[var(--border)]",
          "bg-[var(--card-elevated)] p-6",
        )}
      >
        <h2
          id="confirm-dialog-title"
          className="text-base font-semibold text-[var(--foreground)]"
        >
          {title}
        </h2>
        <p
          id="confirm-dialog-desc"
          className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]"
        >
          {message}
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" disabled={loading} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
