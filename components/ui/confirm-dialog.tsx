"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/form";

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmLabel?: string;
  confirmVariant?: "danger" | "warning" | "default";
  loading?: boolean;
  requireReason?: boolean;
  onReasonChange?: (reason: string) => void;
  /** Placeholder for the optional reason textarea. */
  reasonPlaceholder?: string;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  confirmVariant = "default",
  loading = false,
  requireReason = false,
  onReasonChange,
  reasonPlaceholder = "Add a short explanation…",
}: ConfirmDialogProps) {
  const [mounted, setMounted] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [internalLoading, setInternalLoading] = React.useState(false);
  const wasOpen = React.useRef(false);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (open && !wasOpen.current) {
      setReason("");
      onReasonChange?.("");
    }
    wasOpen.current = open;
  }, [open, onReasonChange]);

  const showSpinner = loading || internalLoading;
  /** Show note field when required, or when parent wires `onReasonChange` for an optional explanation. */
  const showReasonInput = requireReason || onReasonChange != null;
  const reasonOk = !requireReason || reason.trim().length > 0;

  async function handleConfirm() {
    if (!reasonOk || showSpinner) return;
    onReasonChange?.(reason.trim());
    const out = onConfirm();
    if (out != null && typeof (out as Promise<void>).then === "function") {
      setInternalLoading(true);
      try {
        await out;
      } finally {
        setInternalLoading(false);
      }
    }
  }

  if (!open || !mounted || typeof document === "undefined") return null;

  const confirmClasses = {
    danger: "border border-red-500/40 bg-red-500/20 text-red-300 hover:bg-red-500/30",
    warning: "border border-amber-500/40 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30",
    default: "border border-pink-500/40 bg-pink-500/20 text-pink-100 hover:bg-pink-500/30",
  }[confirmVariant];

  return createPortal(
    <div className="fixed inset-0 z-[220] flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm md:items-center">
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={() => !showSpinner && onClose()} />
      <div
        className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-[#1a1a2e] p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-dialog-title" className="text-lg font-semibold text-white">
          {title}
        </h2>
        <p className="mt-3 text-sm text-white/65">{description}</p>
        {showReasonInput ? (
          <div className="mt-4">
            <Label htmlFor="confirm-dialog-reason">{requireReason ? "Reason" : "Note (optional)"}</Label>
            <textarea
              id="confirm-dialog-reason"
              value={reason}
              onChange={(e) => {
                const v = e.target.value;
                setReason(v);
                onReasonChange?.(v);
              }}
              disabled={showSpinner}
              placeholder={reasonPlaceholder}
              rows={4}
              className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-black/35 px-3 py-2.5 text-sm text-white placeholder:text-white/35 outline-none focus:border-pink-500/40 focus:ring-2 focus:ring-pink-500/20 disabled:opacity-50"
            />
          </div>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={showSpinner}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/60 transition hover:bg-white/10 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={showSpinner || !reasonOk}
            className={cn(
              "flex min-h-[44px] min-w-[7rem] items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-45",
              confirmClasses
            )}
          >
            {showSpinner ? <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
