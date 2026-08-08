import type { DailyReviewVerifiedStatus } from "@/services/daily-review-verifications";

export type DailyReviewVaStats = {
  total_items: number;
  va_completed: number;
  verified: number;
  flagged: number;
  unverified: number;
};

export function formatVaBreakdownLine(va: {
  va_name: string;
  stats: Pick<DailyReviewVaStats, "total_items" | "verified" | "flagged">;
}): string {
  const { va_name, stats } = va;
  if (stats.flagged > 0) {
    return `${va_name}: ${stats.verified}/${stats.total_items} verified, ${stats.flagged} flagged`;
  }
  return `${va_name}: ${stats.verified}/${stats.total_items} verified`;
}

export type { DailyReviewVerifiedStatus };
