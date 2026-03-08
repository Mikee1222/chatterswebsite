/**
 * Single source of truth for all scheduling week/date logic.
 * Use this module everywhere: weekly program (chatter, admin, VA), my weekly availability (chatter, VA),
 * helper panels, create/edit flows, and Airtable queries.
 *
 * Convention: Monday-based week_start (YYYY-MM-DD of the Monday of that week).
 * - getStartOfWeekMonday(ymd) / getMondayOfWeek(ymd) — normalize any date to that week's Monday
 * - getCurrentWeekStartMonday() / getThisWeekMonday() — current week's Monday
 * - normalizeWeekStart(ymd) — ensure a value is always a Monday (use on client when reading URL/state)
 * - addDays(ymd, n), addWeeks(ymd, n) — date arithmetic
 * - formatWeekLabel(ymd) — DD/MM/YYYY for week labels (date-only, no timezone shift)
 * - parseWeekStart(ymd) — validate YYYY-MM-DD, return string or null
 * No "use server" – safe to use from server and client.
 */

import { formatDateOnlyEuropean } from "@/lib/format";
import type { WeeklyProgramDay, WeeklyProgramShiftType } from "@/types";

const DATE_ONLY_ISO = /^\d{4}-\d{2}-\d{2}$/;

export const WEEKLY_PROGRAM_DAY_OPTIONS: WeeklyProgramDay[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export const WEEKLY_PROGRAM_SHIFT_TYPES: WeeklyProgramShiftType[] = ["Morning", "Night", "Custom"];

/** Weekday name for today (e.g. "Monday") for matching weekly program day. */
export function getTodayWeekday(): WeeklyProgramDay {
  const names: WeeklyProgramDay[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const d = new Date();
  const idx = d.getDay();
  return names[(idx + 6) % 7];
}

/** Today's date as YYYY-MM-DD (local date). */
export function getTodayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${y}-${pad(m)}-${pad(day)}`;
}

/**
 * Morning 12:00–20:00, Night 20:00–03:00 (end next day).
 * Custom: use buildCustomShiftTimes() with HH:mm.
 * dateYmd = YYYY-MM-DD for the day.
 */
export function getTimesForShiftType(
  shiftType: WeeklyProgramShiftType,
  dateYmd: string
): { start_time: string; end_time: string } {
  if (shiftType === "Morning") {
    return {
      start_time: `${dateYmd}T12:00:00.000Z`,
      end_time: `${dateYmd}T20:00:00.000Z`,
    };
  }
  if (shiftType === "Night") {
    const nextDay = new Date(dateYmd + "T12:00:00.000Z");
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    const nextYmd = nextDay.toISOString().split("T")[0];
    return {
      start_time: `${dateYmd}T20:00:00.000Z`,
      end_time: `${nextYmd}T03:00:00.000Z`,
    };
  }
  throw new Error("Custom shift requires buildCustomShiftTimes()");
}

/** Parse HH:mm to minutes since midnight for comparison. */
function parseHHmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/**
 * Build ISO start_time and end_time for Custom shift.
 * dateYmd = YYYY-MM-DD for the shift day. startHHmm/endHHmm = "HH:mm" (24h).
 * If end_time is earlier than or equal to start_time, end is treated as next day.
 */
export function buildCustomShiftTimes(
  dateYmd: string,
  startHHmm: string,
  endHHmm: string
): { start_time: string; end_time: string } {
  const startMinutes = parseHHmmToMinutes(startHHmm);
  const endMinutes = parseHHmmToMinutes(endHHmm);
  const endIsNextDay = endMinutes <= startMinutes;
  const start_time = `${dateYmd}T${startHHmm}:00.000Z`;
  let endYmd = dateYmd;
  if (endIsNextDay) {
    const d = new Date(dateYmd + "T12:00:00.000Z");
    d.setUTCDate(d.getUTCDate() + 1);
    endYmd = d.toISOString().split("T")[0];
  }
  const end_time = `${endYmd}T${endHHmm}:00.000Z`;
  return { start_time, end_time };
}

export function addDays(ymd: string, days: number): string {
  const d = new Date(ymd + "T12:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

/**
 * Returns the Monday (YYYY-MM-DD) of the week containing the given date.
 * Use this everywhere for week_start so the system is consistently Monday-based.
 * Week is Mon–Sun; for Sunday we go back 5 days to get that week's Monday.
 * Example: 2026-03-01 (Sunday) -> 2026-02-24 (Monday); 2026-03-02 (Monday) -> 2026-03-02.
 */
export function getMondayOfWeek(ymd: string): string {
  const d = new Date(ymd.trim().slice(0, 10) + "T12:00:00.000Z");
  const day = d.getUTCDay();
  const diff = day === 0 ? -5 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().split("T")[0];
}

/**
 * Returns the Monday (YYYY-MM-DD) of the current week in UTC.
 * Use for "this week" so server and client share the same convention.
 */
export function getThisWeekMonday(): string {
  const today = new Date().toISOString().slice(0, 10);
  return getMondayOfWeek(today);
}

/** Alias for getMondayOfWeek. Use for clarity when you need "start of week = Monday". */
export const getStartOfWeekMonday = getMondayOfWeek;

/** Alias for getThisWeekMonday. Use for "current week's Monday". */
export const getCurrentWeekStartMonday = getThisWeekMonday;

/**
 * Add whole weeks to a date (YYYY-MM-DD). Uses UTC noon so the calendar day does not shift.
 */
export function addWeeks(ymd: string, weeks: number): string {
  return addDays(ymd, weeks * 7);
}

/**
 * Validate and parse a week_start candidate. Returns YYYY-MM-DD or null.
 */
export function parseWeekStart(ymd: string | null | undefined): string | null {
  if (ymd == null || typeof ymd !== "string") return null;
  const s = ymd.trim().slice(0, 10);
  return DATE_ONLY_ISO.test(s) ? s : null;
}

/**
 * Normalize to Monday-based week_start. Use on the client when reading week_start from
 * searchParams or state so a stale/non-Monday value never drives the UI.
 * - If input is valid YYYY-MM-DD → return that week's Monday.
 * - Otherwise → return current week's Monday.
 */
export function normalizeWeekStart(ymd: string | null | undefined): string {
  const parsed = parseWeekStart(ymd);
  if (parsed == null) return getThisWeekMonday();
  return getMondayOfWeek(parsed);
}

/**
 * Format week_start for display (DD/MM/YYYY). Always normalizes to Monday before formatting
 * so the header/hero never shows a Tuesday (e.g. 03/03) when the scheduling week is Monday 02/03.
 */
export function formatWeekLabel(weekStartYmd: string): string {
  const parsed = parseWeekStart(weekStartYmd);
  const monday = parsed != null ? getMondayOfWeek(parsed) : weekStartYmd;
  return formatDateOnlyEuropean(monday);
}

/** Europe timezone used to interpret Airtable date fields (midnight Europe = that calendar date). */
const SCHEDULING_TIMEZONE = "Europe/Paris";

/**
 * Convert an Airtable week_start value to our canonical Monday-based YYYY-MM-DD.
 * Airtable may store dates as UTC ISO (e.g. 2026-03-01T22:00:00.000Z = 2026-03-02 00:00 Europe).
 * We interpret in Europe so the intended Monday is preserved.
 */
export function airtableWeekStartToMonday(raw: string | null | undefined): string {
  if (raw == null || typeof raw !== "string") return getThisWeekMonday();
  const s = raw.trim();
  if (DATE_ONLY_ISO.test(s.slice(0, 10))) return getMondayOfWeek(s.slice(0, 10));
  if (s.includes("T") && s.length >= 10) {
    try {
      const d = new Date(s);
      if (!Number.isNaN(d.getTime())) {
        const europeDate = d.toLocaleDateString("en-CA", { timeZone: SCHEDULING_TIMEZONE });
        if (/^\d{4}-\d{2}-\d{2}$/.test(europeDate)) return getMondayOfWeek(europeDate);
      }
    } catch (_) {
      /* fall through */
    }
  }
  if (s.length >= 10) return getMondayOfWeek(s.slice(0, 10));
  return getThisWeekMonday();
}

/**
 * Ensure week_start is Monday-based before using in a query. Use at service/query boundaries.
 * In development, logs if the input was not already a Monday.
 */
export function ensureMondayForQuery(weekStart: string | null | undefined): string {
  const parsed = parseWeekStart(weekStart);
  const monday = parsed != null ? getMondayOfWeek(parsed) : getThisWeekMonday();
  if (process.env.NODE_ENV !== "production" && parsed != null) {
    const d = new Date(parsed + "T12:00:00.000Z");
    if (d.getUTCDay() !== 1) {
      console.warn("[weekly-program] week_start was not Monday; normalized for query", {
        input: weekStart,
        normalized: monday,
        inputDay: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()],
      });
    }
  }
  return monday;
}
