"use client";

import type { MistakeStatus } from "@/services/chatter-mistakes";

const STYLES: Record<MistakeStatus, { wrap: string; dot: string; label: string }> = {
  pending: {
    wrap: "border-yellow-500/25 bg-yellow-500/10 text-yellow-400",
    dot: "bg-yellow-400",
    label: "Pending",
  },
  approved: {
    wrap: "border-emerald-500/25 bg-emerald-500/10 text-emerald-400",
    dot: "bg-emerald-400",
    label: "Approved",
  },
  rejected: {
    wrap: "border-red-500/25 bg-red-500/10 text-red-400",
    dot: "bg-red-400",
    label: "Rejected",
  },
};

const PENDING_NEUTRAL = {
  wrap: "border-white/15 bg-white/[0.06] text-white/70",
  dot: "bg-white/45",
  label: "Under review",
};

export function MistakeStatusBadge({
  status,
  className = "",
  /** Chatter-facing: muted “Under review” instead of yellow Pending */
  underReview = false,
}: {
  status: string;
  className?: string;
  underReview?: boolean;
}) {
  const key: MistakeStatus =
    status === "approved" || status === "rejected" ? status : "pending";
  const s = key === "pending" && underReview ? PENDING_NEUTRAL : STYLES[key];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${s.wrap} ${className}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${s.dot}`} aria-hidden />
      {s.label}
    </span>
  );
}
