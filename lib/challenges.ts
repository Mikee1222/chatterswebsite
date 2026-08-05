/** Shared challenge constants and pure helpers (safe for client + server). */

/** Classic event-driven challenge metrics (whale / shift / etc.). */
export const CLASSIC_CHALLENGE_METRICS = [
  "transactions",
  "whales_added",
  "shift_hours",
  "customs_completed",
  "whale_status_upgrades",
  "rebills_verified",
] as const;

/** Infloww analytics metrics — progress from `infloww_daily_stats` over the challenge window. */
export const INFLOWW_CHALLENGE_METRICS = [
  "infloww_sales",
  "infloww_ppv_sales",
  "infloww_tips",
  "infloww_messages",
  "infloww_ppvs_sent",
  "infloww_ppvs_unlocked",
  "infloww_unlock_rate",
  "infloww_golden_ratio",
  "infloww_fans_chatted",
  "infloww_rev_per_hour",
  "infloww_rev_per_fan",
] as const;

export const CHALLENGE_METRICS = [
  ...CLASSIC_CHALLENGE_METRICS,
  ...INFLOWW_CHALLENGE_METRICS,
] as const;

export type ClassicChallengeMetric = (typeof CLASSIC_CHALLENGE_METRICS)[number];
export type InflowwChallengeMetric = (typeof INFLOWW_CHALLENGE_METRICS)[number];
export type ChallengeMetric = (typeof CHALLENGE_METRICS)[number];

export type ChallengeMetricKind = "count" | "hours" | "money" | "rate_pct";

export type ChallengeStatus = "active" | "upcoming" | "expired";

export function isInflowwChallengeMetric(m: string): m is InflowwChallengeMetric {
  return (INFLOWW_CHALLENGE_METRICS as readonly string[]).includes(m);
}

export function isClassicChallengeMetric(m: string): m is ClassicChallengeMetric {
  return (CLASSIC_CHALLENGE_METRICS as readonly string[]).includes(m);
}

export function isChallengeMetric(m: string): m is ChallengeMetric {
  return (CHALLENGE_METRICS as readonly string[]).includes(m);
}

export function challengeMetricKind(metric: ChallengeMetric): ChallengeMetricKind {
  if (metric === "shift_hours") return "hours";
  if (
    metric === "infloww_sales" ||
    metric === "infloww_ppv_sales" ||
    metric === "infloww_tips" ||
    metric === "infloww_rev_per_hour" ||
    metric === "infloww_rev_per_fan"
  ) {
    return "money";
  }
  if (metric === "infloww_unlock_rate" || metric === "infloww_golden_ratio") {
    return "rate_pct";
  }
  return "count";
}

export const CHALLENGE_METRIC_LABELS: Record<ChallengeMetric, string> = {
  transactions: "Transactions",
  whales_added: "Whales added",
  shift_hours: "Shift hours",
  customs_completed: "Customs completed",
  whale_status_upgrades: "Whale status upgrades",
  rebills_verified: "Rebills verified",
  infloww_sales: "Total sales",
  infloww_ppv_sales: "PPV sales",
  infloww_tips: "Tips",
  infloww_messages: "Messages",
  infloww_ppvs_sent: "PPVs sent",
  infloww_ppvs_unlocked: "PPVs unlocked",
  infloww_unlock_rate: "Unlock rate",
  infloww_golden_ratio: "Golden ratio",
  infloww_fans_chatted: "Fans chatted",
  infloww_rev_per_hour: "Rev / hour",
  infloww_rev_per_fan: "Rev / fan",
};

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

function formatMoney(n: number): string {
  const v = Math.round(n * 100) / 100;
  if (Number.isInteger(v)) return `$${v.toLocaleString("en-US")}`;
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPct(n: number): string {
  const v = Math.round(n * 100) / 100;
  if (Number.isInteger(v)) return `${v}%`;
  return `${v.toFixed(1)}%`;
}

function formatCount(n: number): string {
  const v = Math.round(n * 100) / 100;
  if (Number.isInteger(v)) return String(v);
  return String(v);
}

/** Format a single challenge value with the right unit for the metric. */
export function formatChallengeValue(metric: ChallengeMetric, value: number): string {
  const kind = challengeMetricKind(metric);
  if (kind === "hours") return formatChallengeHours(value);
  if (kind === "money") return formatMoney(value);
  if (kind === "rate_pct") return formatPct(value);
  return formatCount(value);
}

/** Format current/target progress; units depend on metric kind. */
export function formatChallengeProgress(
  metric: ChallengeMetric,
  current: number,
  target: number
): string {
  return `${formatChallengeValue(metric, current)} / ${formatChallengeValue(metric, target)}`;
}

/** Normalize admin-entered target (rates as %, money may be decimal, counts as int). */
export function normalizeChallengeTargetValue(metric: ChallengeMetric, raw: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 1;
  const kind = challengeMetricKind(metric);
  if (kind === "count") return Math.max(1, Math.floor(n));
  if (kind === "hours") return Math.max(0.1, Math.round(n * 100) / 100);
  if (kind === "rate_pct") return Math.max(0.1, Math.min(100, Math.round(n * 100) / 100));
  return Math.max(0.01, Math.round(n * 100) / 100);
}
