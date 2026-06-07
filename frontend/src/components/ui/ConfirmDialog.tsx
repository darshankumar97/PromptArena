"use client";

import { X } from "lucide-react";
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
        className="absolute inset-0 bg-black/60"
        onClick={loading ? undefined : onCancel}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-desc"
        className={cn(
          "modal-glow relative w-full max-w-md rounded-lg border border-arena-border-strong",
          "bg-arena-surface p-6",
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <h2
            id="confirm-dialog-title"
            className="text-[17px] font-medium leading-[1.2] text-arena-text-primary"
          >
            {title}
          </h2>
          <button
            type="button"
            aria-label="Close"
            className="inline-flex h-9 items-center rounded px-2 text-arena-text-secondary hover:bg-arena-elevated hover:text-arena-text-primary"
            onClick={loading ? undefined : onCancel}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p
          id="confirm-dialog-desc"
          className="mt-3 text-[15px] leading-[1.6] text-arena-text-secondary"
        >
          {message}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" disabled={loading} onClick={onCancel}>
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
