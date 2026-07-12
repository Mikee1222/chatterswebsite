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
import { getMondayOfWeekFromYmdAthens, getTodayYmdAthens } from "@/lib/airtable-datetime";
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

/** Parse HH:mm to minutes since midnight (24h). Expects normalized `HH:mm`. */
function parseHHmmToMinutes(hhmm: string): number {
  const [hRaw, mRaw] = hhmm.split(":");
  const h = parseInt(hRaw ?? "", 10);
  const m = parseInt(mRaw ?? "", 10);
  const hh = Number.isFinite(h) ? h : 0;
  const mm = Number.isFinite(m) ? m : 0;
  return hh * 60 + mm;
}

/**
 * Normalize any common time string to `HH:mm` (24h) for scheduling.
 * Handles: empty → `00:00`, ISO `…T00:00…`, `HH:mm:ss`, `H:mm` / `HH:mm` (24h), and `H:MM AM/PM`.
 */
export function normalizeTime(t: string): string {
  const s = (t ?? "").trim();
  if (!s) return "00:00";

  // ISO datetime — schedule fields use `…T00:00…Z` UTC wall fragment
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) && s.length >= 16) {
    return s.slice(11, 16);
  }

  // 12h: "12:00 AM", "3:05 pm", "1:00 PM"
  const ampm = /^(\d{1,2}):(\d{2})\s*(AM|PM)\s*$/i.exec(s);
  if (ampm) {
    let h = parseInt(ampm[1]!, 10);
    const min = ampm[2]!;
    const ap = ampm[3]!.toUpperCase();
    if (ap === "AM" && h === 12) h = 0;
    else if (ap === "PM" && h !== 12) h += 12;
    if (!Number.isFinite(h) || h < 0 || h > 23) return "00:00";
    return `${String(h).padStart(2, "0")}:${min}`;
  }

  // HH:mm:ss or H:mm:ss (24h)
  const withSec = /^(\d{1,2}):(\d{2}):(\d{2})$/.exec(s);
  if (withSec) {
    const h = parseInt(withSec[1]!, 10);
    const min = withSec[2]!;
    const sec = parseInt(withSec[3]!, 10);
    if (!Number.isFinite(h) || h < 0 || h > 23 || !Number.isFinite(sec) || sec < 0 || sec > 59) return "00:00";
    const mm = parseInt(min, 10);
    if (!Number.isFinite(mm) || mm < 0 || mm > 59) return "00:00";
    return `${String(h).padStart(2, "0")}:${min}`;
  }

  // H:mm or HH:mm (24h)
  const clock = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (clock) {
    const h = parseInt(clock[1]!, 10);
    const min = parseInt(clock[2]!, 10);
    if (!Number.isFinite(h) || !Number.isFinite(min)) return "00:00";
    if (h < 0 || h > 23 || min < 0 || min > 59) return "00:00";
    const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
    return `${pad(h)}:${pad(min)}`;
  }

  return s.length >= 5 ? s.slice(0, 5) : "00:00";
}

/**
 * Normalize a wall time to `HH:mm` (24h). Rejects hours outside 0–23 or minutes outside 0–59.
 * Runs {@link normalizeTime} first so 12h strings and ISO fragments parse consistently.
 */
export function normalizeHHmm(input: string): string | null {
  const wall = normalizeTime((input ?? "").trim());
  const m = /^(\d{2}):(\d{2})$/.exec(wall);
  if (!m) return null;
  const h = parseInt(m[1]!, 10);
  const min = parseInt(m[2]!, 10);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return wall;
}

/**
 * Whether two same-calendar-day wall-clock ranges overlap, using minutes and overnight extension.
 * - If `end <= start` for a range, that range is treated as crossing midnight (`end += 24h`).
 * - If the second range lies entirely before the first’s start on the clock (e.g. 00:00–03:00 vs 20:00–…),
 *   the second is shifted by +24h so it lines up with an overnight first range.
 * Same symmetric shift applies when the first range is the “early” one.
 *
 * Expected cases (first pair vs second pair):
 * - `20:00–00:00` vs `00:00–03:00` → false (touching / adjacent)
 * - `12:00–20:00` vs `20:00–03:00` → false
 * - `20:00–03:00` vs `03:00–12:00` → false
 * - `20:00–03:00` vs `22:00–06:00` → true
 * - `20:00–00:00` vs `22:00–02:00` → true
 */
export function hhmmWallClockRangesOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string,
): boolean {
  const a = normalizeHHmm(start1.trim());
  const b = normalizeHHmm(end1.trim());
  const c = normalizeHHmm(start2.trim());
  const d = normalizeHHmm(end2.trim());
  if (!a || !b || !c || !d) return false;

  const toMinutes = (t: string): number => {
    const [h, m] = t.split(":").map((x) => parseInt(x, 10));
    const hh = Number.isFinite(h) ? h : 0;
    const mm = Number.isFinite(m) ? m : 0;
    return hh * 60 + mm;
  };

  let s1 = toMinutes(a);
  let e1 = toMinutes(b);
  let s2 = toMinutes(c);
  let e2 = toMinutes(d);

  const DAY = 24 * 60;
  if (e1 <= s1) e1 += DAY;
  if (e2 <= s2) e2 += DAY;
  // Align overnight / post-midnight windows (±12h heuristic) so e.g. 20:00–00:00 vs 00:00–03:00 does not false-overlap.
  if (s2 < s1 - DAY / 2) {
    s2 += DAY;
    e2 += DAY;
  }
  if (s1 < s2 - DAY / 2) {
    s1 += DAY;
    e1 += DAY;
  }

  // Strict: touching endpoints are not overlap (half-open style in minute space after extension).
  return s1 < e2 && s2 < e1;
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
  const startNorm = normalizeHHmm(startHHmm);
  const endNorm = normalizeHHmm(endHHmm);
  if (!startNorm || !endNorm) {
    throw new Error("Invalid time: use HH:mm with hour 00–23 and minute 00–59.");
  }
  const startMinutes = parseHHmmToMinutes(startNorm);
  const endMinutes = parseHHmmToMinutes(endNorm);
  const endIsNextDay = endMinutes <= startMinutes;
  const start_time = `${dateYmd}T${startNorm}:00.000Z`;
  let endYmd = dateYmd;
  if (endIsNextDay) {
    const d = new Date(dateYmd + "T12:00:00.000Z");
    d.setUTCDate(d.getUTCDate() + 1);
    endYmd = d.toISOString().split("T")[0];
  }
  const end_time = `${endYmd}T${endNorm}:00.000Z`;
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
 * Week is Mon–Sun; for Sunday we go back 6 days to get that week's Monday.
 * Example: 2026-03-01 (Sunday) -> 2026-02-23 (Monday); 2026-03-02 (Monday) -> 2026-03-02.
 */
export function getMondayOfWeek(ymd: string): string {
  const d = new Date(ymd.trim().slice(0, 10) + "T12:00:00.000Z");
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().split("T")[0];
}

/**
 * Returns the Monday (YYYY-MM-DD) of the current week on the Athens business calendar.
 * Use for "this week" so admins in Greece see the correct week boundary near midnight UTC.
 */
export function getThisWeekMonday(): string {
  return getMondayOfWeekFromYmdAthens(getTodayYmdAthens());
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
 *
 * Schema note (both tables use field name `week_start`, types differ):
 * - `weekly_program` (chatter): **dateTime** — UTC ISO midnight for Monday in Athens
 *   (e.g. 2026-03-01T22:00:00.000Z → Monday 2026-03-02 Europe/Athens).
 * - `weekly_program_va`: **date** — calendar date or YYYY-MM-DD text for that Monday.
 *
 * Accepts plain YYYY-MM-DD, ISO datetime strings, and Europe-shifted midnight instants.
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
