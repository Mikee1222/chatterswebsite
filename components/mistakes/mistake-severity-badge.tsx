"use client";

import type { MistakeReasonCategory } from "@/services/chatter-mistakes";

const STYLES: Record<MistakeReasonCategory, string> = {
  Low: "border-blue-500/25 bg-blue-500/10 text-blue-400",
  Medium: "border-amber-500/25 bg-amber-500/10 text-amber-400",
  High: "border-red-500/25 bg-red-500/10 text-red-400",
};

const DOT: Record<MistakeReasonCategory, string> = {
  Low: "bg-blue-400",
  Medium: "bg-amber-400",
  High: "bg-red-400",
};

export function severityDotClass(cat: MistakeReasonCategory | string): string {
  if (cat === "High" || cat === "Medium" || cat === "Low") return DOT[cat];
  return DOT.Low;
}

export function MistakeSeverityBadge({
  severity,
  className = "",
  withDot = false,
}: {
  severity: MistakeReasonCategory | string;
  className?: string;
  withDot?: boolean;
}) {
  const key: MistakeReasonCategory =
    severity === "High" || severity === "Medium" || severity === "Low" ? severity : "Low";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold ${STYLES[key]} ${className}`}
    >
      {withDot ? <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[key]}`} aria-hidden /> : null}
      {key}
    </span>
  );
}
