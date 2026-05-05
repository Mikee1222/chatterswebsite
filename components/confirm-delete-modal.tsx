"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  title?: string;
  /** Defaults to the standard irreversible warning. */
  description?: React.ReactNode;
  confirmLabel?: string;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  confirming: boolean;
};

export function ConfirmDeleteModal({
  open,
  title = "Delete?",
  description = "Are you sure? This action cannot be undone.",
  confirmLabel = "Delete",
  onClose,
  onConfirm,
  confirming,
}: Props) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end justify-center p-4 md:items-center">
      <button type="button" className="absolute inset-0 bg-black/75 backdrop-blur-sm" aria-label="Close" onClick={onClose} />
      <div
        className="relative w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-modal-title"
      >
        <h2 id="confirm-delete-modal-title" className="text-lg font-semibold text-white">
          {title}
        </h2>
        <div className="mt-4 text-sm text-white/80">{description}</div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={confirming}
            className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/5 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={confirming}
            className={cn(
              "flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
            )}
          >
            {confirming ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
