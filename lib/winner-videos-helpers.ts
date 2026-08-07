export const WINNER_VIDEO_STATUSES = [
  "Pending",
  "Approved",
  "Rejected",
  "Recreated",
  "Published",
] as const;

export type WinnerVideoStatus = (typeof WINNER_VIDEO_STATUSES)[number];

export const WINNER_VIDEO_CONTENT_TYPES = ["Skit", "UGC"] as const;

export type WinnerVideoContentType = (typeof WINNER_VIDEO_CONTENT_TYPES)[number];

export function coerceWinnerVideoContentType(raw: unknown): WinnerVideoContentType | "" {
  const s = String(raw ?? "").trim() as WinnerVideoContentType;
  return (WINNER_VIDEO_CONTENT_TYPES as readonly string[]).includes(s) ? s : "";
}

export const WINNER_VIDEO_CONTENT_TYPE_STYLES: Record<
  WinnerVideoContentType,
  { label: string; className: string }
> = {
  Skit: {
    label: "Skit",
    className: "border-violet-500/35 bg-violet-500/12 text-violet-200",
  },
  UGC: {
    label: "UGC",
    className: "border-teal-500/35 bg-teal-500/12 text-teal-200",
  },
};

export function coerceWinnerVideoStatus(raw: unknown): WinnerVideoStatus {
  const s = String(raw ?? "").trim() as WinnerVideoStatus;
  return (WINNER_VIDEO_STATUSES as readonly string[]).includes(s) ? s : "Pending";
}

/** Optional quality rating set when admins approve a research find. */
export const WINNER_VIDEO_QUALITY_RATINGS = ["good", "excellent", "fire"] as const;

export type WinnerVideoQualityRating = (typeof WINNER_VIDEO_QUALITY_RATINGS)[number];

export const WINNER_VIDEO_QUALITY_RATING_META: Record<
  WinnerVideoQualityRating,
  { emoji: string; label: string; labelEl: string }
> = {
  good: { emoji: "👍", label: "Good", labelEl: "Καλό" },
  excellent: { emoji: "🌟", label: "Excellent", labelEl: "Εξαιρετικό" },
  fire: { emoji: "🔥", label: "Fire", labelEl: "Φωτιά" },
};

export function coerceWinnerVideoQualityRating(raw: unknown): WinnerVideoQualityRating | null {
  const s = String(raw ?? "").trim().toLowerCase();
  return (WINNER_VIDEO_QUALITY_RATINGS as readonly string[]).includes(s)
    ? (s as WinnerVideoQualityRating)
    : null;
}

export function qualityRatingEmoji(rating: WinnerVideoQualityRating | null | undefined): string {
  if (!rating) return "";
  return WINNER_VIDEO_QUALITY_RATING_META[rating].emoji;
}

/** Aggregate line e.g. "🔥 x3 · 🌟 x5 · 👍 x8" (omits zero tiers). */
export function formatQualityRatingAggregate(
  ratings: Array<WinnerVideoQualityRating | null | undefined>,
): string {
  let fire = 0;
  let excellent = 0;
  let good = 0;
  for (const r of ratings) {
    if (r === "fire") fire += 1;
    else if (r === "excellent") excellent += 1;
    else if (r === "good") good += 1;
  }
  const parts: string[] = [];
  if (fire > 0) parts.push(`🔥 x${fire}`);
  if (excellent > 0) parts.push(`🌟 x${excellent}`);
  if (good > 0) parts.push(`👍 x${good}`);
  return parts.join(" · ");
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
