"use client";

import type { MistakeStatus } from "@/services/chatter-mistakes";

export function MistakePoints({
  points,
  status,
  className = "",
}: {
  points: number;
  /** When set, pending/rejected render chatter-friendly copy instead of −N */
  status?: MistakeStatus | string;
  className?: string;
}) {
  if (status === "pending") {
    return (
      <span className={`font-medium tabular-nums text-white/45 ${className}`} title="Awaiting review">
        pending
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className={`text-xs font-medium text-white/40 ${className}`}>
        Rejected — no points deducted
      </span>
    );
  }

  const n = Number.isFinite(points) ? Math.abs(Math.round(points)) : 0;
  return (
    <span className={`font-semibold tabular-nums text-red-400 ${className}`} title={`${n} points`}>
      −{n} pts
    </span>
  );
}
