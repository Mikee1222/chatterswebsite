/**
 * Custom 4-week-per-month calendar for Infloww Weekly Progress.
 * Scoped to this feature only — do NOT reuse ISO / Monday-week helpers.
 *
 * Per calendar month (Athens business dates as YYYY-MM-DD):
 *   Week 1: days 1–7
 *   Week 2: days 8–14
 *   Week 3: days 15–21
 *   Week 4: days 22–end of month (28/29/30/31)
 */

export type CustomWeekIndex = 1 | 2 | 3 | 4;

/** Lifecycle of a custom week vs Athens "today". */
export type CustomWeekStatus = "not_started" | "in_progress" | "complete";

export type CustomWeekBoundary = {
  week: CustomWeekIndex;
  /** Inclusive YYYY-MM-DD */
  startYmd: string;
  /** Inclusive YYYY-MM-DD */
  endYmd: string;
  dayCount: number;
  /** e.g. "Week 1 · Aug 1–7" */
  label: string;
};

export type CustomWeekProgress = {
  status: CustomWeekStatus;
  /** Days elapsed in the week so far (0 when not started). */
  elapsedDays: number;
  /**
   * True when the week has begun (start ≤ today) or already has synced activity.
   * Future empty weeks are not comparable for WoW / insights.
   */
  hasStarted: boolean;
};

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function ymd(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** Days in calendar month (1–12). Handles Feb 28/29. */
export function daysInMonth(year: number, month: number): number {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`Invalid year/month: ${year}-${month}`);
  }
  return new Date(Date.UTC(year, month, 0, 12, 0, 0)).getUTCDate();
}

function weekLabel(
  week: CustomWeekIndex,
  year: number,
  month: number,
  startDay: number,
  endDay: number
): string {
  const mon = MONTH_SHORT[month - 1]!;
  return `Week ${week} · ${mon} ${startDay}–${endDay}`;
}

/**
 * Four custom week windows for a calendar month.
 * `month` is 1–12 (January = 1).
 */
export function getCustomWeekBoundaries(year: number, month: number): CustomWeekBoundary[] {
  const last = daysInMonth(year, month);
  const ranges: Array<{ week: CustomWeekIndex; start: number; end: number }> = [
    { week: 1, start: 1, end: Math.min(7, last) },
    { week: 2, start: 8, end: Math.min(14, last) },
    { week: 3, start: 15, end: Math.min(21, last) },
    { week: 4, start: 22, end: last },
  ];

  return ranges
    .filter((r) => r.start <= last && r.start <= r.end)
    .map((r) => ({
      week: r.week,
      startYmd: ymd(year, month, r.start),
      endYmd: ymd(year, month, r.end),
      dayCount: r.end - r.start + 1,
      label: weekLabel(r.week, year, month, r.start, r.end),
    }));
}

/** Which custom week contains `dayOfMonth` (1–31). */
export function customWeekIndexForDay(dayOfMonth: number): CustomWeekIndex {
  if (dayOfMonth <= 7) return 1;
  if (dayOfMonth <= 14) return 2;
  if (dayOfMonth <= 21) return 3;
  return 4;
}

/** Parse YYYY-MM-DD → custom week index within its month. */
export function customWeekIndexForYmd(dateYmd: string): CustomWeekIndex | null {
  const parts = dateYmd.trim().slice(0, 10).split("-").map(Number);
  if (parts.length !== 3 || parts.some((x) => !Number.isFinite(x))) return null;
  const d = parts[2]!;
  if (d < 1 || d > 31) return null;
  return customWeekIndexForDay(d);
}

/** Inclusive day count between two YYYY-MM-DD strings (UTC noon). */
export function inclusiveDaySpan(startYmd: string, endYmd: string): number {
  const a = startYmd.trim().slice(0, 10);
  const b = endYmd.trim().slice(0, 10);
  if (!a || !b || a > b) return 0;
  const ap = a.split("-").map(Number);
  const bp = b.split("-").map(Number);
  if (ap.length !== 3 || bp.length !== 3) return 0;
  const start = Date.UTC(ap[0]!, ap[1]! - 1, ap[2]!, 12, 0, 0);
  const end = Date.UTC(bp[0]!, bp[1]! - 1, bp[2]!, 12, 0, 0);
  return Math.floor((end - start) / 86_400_000) + 1;
}

/**
 * Classify a custom week vs Athens calendar "today".
 * Future weeks with no activity → `not_started` (not comparable for WoW).
 * Activity in a future window (rare / sync skew) still counts as started.
 */
export function classifyCustomWeekProgress(
  boundary: CustomWeekBoundary,
  todayYmd: string,
  hasActivity: boolean
): CustomWeekProgress {
  const today = todayYmd.trim().slice(0, 10);
  const calendarStarted = today >= boundary.startYmd;

  if (!calendarStarted && !hasActivity) {
    return { status: "not_started", elapsedDays: 0, hasStarted: false };
  }

  const hasStarted = true;
  if (today > boundary.endYmd) {
    return { status: "complete", elapsedDays: boundary.dayCount, hasStarted };
  }

  // In progress (including the last calendar day of the week).
  const effectiveEnd = today < boundary.startYmd ? boundary.startYmd : today;
  const cappedEnd = effectiveEnd > boundary.endYmd ? boundary.endYmd : effectiveEnd;
  const elapsedDays = Math.max(1, inclusiveDaySpan(boundary.startYmd, cappedEnd));
  return {
    status: "in_progress",
    elapsedDays: Math.min(elapsedDays, boundary.dayCount),
    hasStarted,
  };
}

/** UI / report label: dates, optional in-progress day counter, or not-yet-started. */
export function formatCustomWeekDisplayLabel(
  boundary: CustomWeekBoundary,
  progress: CustomWeekProgress
): string {
  if (progress.status === "not_started") {
    return `Week ${boundary.week} · Not yet started`;
  }
  if (progress.status === "in_progress") {
    return `Week ${boundary.week} (in progress, day ${progress.elapsedDays} of ${boundary.dayCount})`;
  }
  return boundary.label;
}
