/** Shared challenge constants and pure helpers (safe for client + server). */

export const CHALLENGE_METRICS = [
  "transactions",
  "whales_added",
  "shift_hours",
  "customs_completed",
  "whale_status_upgrades",
  "rebills_verified",
] as const;

export type ChallengeMetric = (typeof CHALLENGE_METRICS)[number];

export type ChallengeStatus = "active" | "upcoming" | "expired";

/** Whole calendar days from `todayYmd` through `endYmd` (inclusive). */
export function daysRemainingYmd(endYmd: string, todayYmd: string): number {
  const e = new Date(`${endYmd.trim().slice(0, 10)}T12:00:00.000Z`).getTime();
  const t = new Date(`${todayYmd.trim().slice(0, 10)}T12:00:00.000Z`).getTime();
  if (Number.isNaN(e) || Number.isNaN(t)) return 0;
  return Math.max(0, Math.ceil((e - t) / 86400000));
}

export function getChallengeStatus(
  c: { start_date: string; end_date: string },
  today: string
): ChallengeStatus {
  if (!c.start_date || !c.end_date) return "expired";
  if (c.end_date < today) return "expired";
  if (c.start_date > today) return "upcoming";
  return "active";
}

/** Format hour values for challenge progress (e.g. 2.5 → "2.5h", 10 → "10h"). */
export function formatChallengeHours(hours: number): string {
  const v = Math.round(hours * 100) / 100;
  if (Number.isInteger(v)) return `${v}h`;
  const fixed = v.toFixed(1);
  return `${fixed.endsWith(".0") ? String(Math.floor(v)) : fixed}h`;
}

/** Format current/target progress; shift_hours uses "Xh / Yh". */
export function formatChallengeProgress(
  metric: ChallengeMetric,
  current: number,
  target: number
): string {
  if (metric === "shift_hours") {
    return `${formatChallengeHours(current)} / ${formatChallengeHours(target)}`;
  }
  return `${current} / ${target}`;
}
