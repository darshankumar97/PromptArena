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
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={loading ? undefined : onCancel}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-desc"
        className={cn(
          "relative w-full max-w-md rounded-xl border border-zinc-700/80",
          "bg-zinc-900 p-6 shadow-2xl shadow-black/50",
        )}
      >
        <h2
          id="confirm-dialog-title"
          className="text-lg font-semibold text-zinc-100"
        >
          {title}
        </h2>
        <p id="confirm-dialog-desc" className="mt-3 text-sm leading-relaxed text-zinc-400">
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
