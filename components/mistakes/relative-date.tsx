"use client";

import { formatDateTimeEuropean, formatRelativeTime } from "@/lib/format";

export function RelativeDate({ iso, className = "" }: { iso: string; className?: string }) {
  const full = formatDateTimeEuropean(iso);
  return (
    <span className={`text-xs text-white/40 ${className}`} title={full !== "—" ? full : undefined}>
      {formatRelativeTime(iso)}
    </span>
  );
}
