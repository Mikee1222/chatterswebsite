"use client";

import { X } from "lucide-react";

export function FilterChip({
  label,
  onRemove,
  active,
  onClick,
  count,
}: {
  label: string;
  onRemove?: () => void;
  /** Toggle chip (filter rail) */
  active?: boolean;
  onClick?: () => void;
  count?: number;
}) {
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400/60 ${
          active
            ? "border-pink-500/40 bg-pink-500/20 text-pink-200"
            : "border-white/10 bg-white/[0.03] text-white/55 hover:border-white/20 hover:text-white/80"
        }`}
      >
        {label}
        {typeof count === "number" ? (
          <span className="tabular-nums text-white/40">{count}</span>
        ) : null}
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-pink-500/30 bg-pink-500/10 px-2.5 py-1 text-xs text-pink-200">
      {label}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="rounded-full p-0.5 hover:bg-pink-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400/60"
          aria-label={`Remove ${label}`}
        >
          <X className="h-3 w-3" aria-hidden />
        </button>
      ) : null}
    </span>
  );
}
