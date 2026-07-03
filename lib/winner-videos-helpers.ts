export const WINNER_VIDEO_STATUSES = [
  "Pending",
  "Approved",
  "Rejected",
  "Recreated",
  "Published",
] as const;

export type WinnerVideoStatus = (typeof WINNER_VIDEO_STATUSES)[number];

export function coerceWinnerVideoStatus(raw: unknown): WinnerVideoStatus {
  const s = String(raw ?? "").trim() as WinnerVideoStatus;
  return (WINNER_VIDEO_STATUSES as readonly string[]).includes(s) ? s : "Pending";
}

export const WINNER_VIDEO_STATUS_STYLES: Record<
  WinnerVideoStatus,
  { label: string; className: string; glowClassName?: string }
> = {
  Pending: {
    label: "Pending",
    className: "border-amber-500/35 bg-amber-500/12 text-amber-200",
    glowClassName: "shadow-[0_0_12px_-4px_rgba(245,158,11,0.45)]",
  },
  Approved: {
    label: "Approved",
    className: "border-emerald-500/35 bg-emerald-500/12 text-emerald-200",
    glowClassName: "shadow-[0_0_12px_-4px_rgba(16,185,129,0.4)]",
  },
  Rejected: {
    label: "Rejected",
    className: "border-red-500/35 bg-red-500/12 text-red-200",
    glowClassName: "shadow-[0_0_12px_-4px_rgba(239,68,68,0.45)]",
  },
  Recreated: {
    label: "Recreated",
    className: "border-sky-500/35 bg-sky-500/12 text-sky-200",
    glowClassName: "shadow-[0_0_12px_-4px_rgba(14,165,233,0.4)]",
  },
  Published: {
    label: "Published",
    className: "border-[#D4AF8C]/40 bg-[#D4AF8C]/12 text-[#D4AF8C]",
    glowClassName: "shadow-[0_0_12px_-4px_rgba(212,175,140,0.45)]",
  },
};
