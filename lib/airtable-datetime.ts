/**
 * Helpers for Airtable date/datetime fields.
 * Airtable datetime fields require full ISO 8601 (e.g. 2026-03-09T10:00:00.000Z).
 * Sending time-only strings like "10:00" causes: Cannot parse date value "10:00" for field X.
 */

import type { WeeklyProgramDay } from "@/types";

/** Fixed Greece summer offset (UTC+3). Server runs UTC; business calendar uses this offset (no DST split). */
const ATHENS_OFFSET_MS = 3 * 60 * 60 * 1000;

/**
 * “Now” shifted so UTC calendar getters approximate Europe/Athens wall time in summer (+3).
 * Athens is UTC+2 in winter, but the product uses +3 year-round for simplicity.
 */
export function getNowInAthens(): Date {
  const now = new Date();
  return new Date(now.getTime() + ATHENS_OFFSET_MS);
}

export function getWeekStartInAthens(offsetWeeks = 0): Date {
  const now = getNowInAthens();
  const dayOfWeek = now.getUTCDay();
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(now.getTime());
  weekStart.setUTCDate(now.getUTCDate() + daysToMonday + offsetWeeks * 7);
  weekStart.setUTCHours(0, 0, 0, 0);
  return weekStart;
}

function shiftedUtcDateToYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Current week’s Monday as YYYY-MM-DD (Athens +3 convention). */
export function getWeekStartYmdInAthens(offsetWeeks = 0): string {
  return shiftedUtcDateToYmd(getWeekStartInAthens(offsetWeeks));
}

/** Today’s calendar date YYYY-MM-DD (Athens +3 convention). */
export function getTodayYmdAthens(): string {
  return shiftedUtcDateToYmd(getNowInAthens());
}

function parseYmdParts(ymd: string): { y: number; m: number; d: number } | null {
  const s = ymd.trim().slice(0, 10);
  const parts = s.split("-").map((x) => Number.parseInt(x, 10));
  if (parts.length !== 3 || parts.some((x) => Number.isNaN(x))) return null;
  return { y: parts[0]!, m: parts[1]!, d: parts[2]! };
}

/**
 * UTC epoch ms for Athens midnight on `ymd` (YYYY-MM-DD), using the same fixed UTC+3
 * convention as `getTodayYmdAthens` (not full IANA timezone).
 */
export function athensYmdStartUtcMs(ymd: string): number {
  const p = parseYmdParts(ymd);
  if (!p) return Number.NaN;
  return Date.UTC(p.y, p.m - 1, p.d, 0, 0, 0, 0) - ATHENS_OFFSET_MS;
}

/** UTC epoch ms for last ms of Athens wall day `ymd` (same +3 convention). */
export function athensYmdEndUtcMs(ymd: string): number {
  const p = parseYmdParts(ymd);
  if (!p) return Number.NaN;
  return Date.UTC(p.y, p.m - 1, p.d, 23, 59, 59, 999) - ATHENS_OFFSET_MS;
}

/** Monday YYYY-MM-DD of the week containing `ymd` (Athens +3 convention). */
export function getMondayOfWeekFromYmdAthens(ymd: string): string {
  const s = ymd.trim().slice(0, 10);
  const parts = s.split("-").map(Number);
  if (parts.length !== 3 || parts.some((x) => Number.isNaN(x))) return getWeekStartYmdInAthens(0);
  const cal = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12, 0, 0));
  const shifted = new Date(cal.getTime() + ATHENS_OFFSET_MS);
  const dayOfWeek = shifted.getUTCDay();
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  shifted.setUTCDate(shifted.getUTCDate() + daysToMonday);
  shifted.setUTCHours(0, 0, 0, 0);
  return shiftedUtcDateToYmd(shifted);
}

const ATHENS_WEEKDAY_MON_FIRST: WeeklyProgramDay[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

/** Weekday name for “today” in Athens (+3) for weekly_program day matching. */
export function getTodayWeekdayAthens(): WeeklyProgramDay {
  const n = getNowInAthens();
  const idx = n.getUTCDay();
  return ATHENS_WEEKDAY_MON_FIRST[(idx + 6) % 7];
}

/** Calendar add/subtract days on a YYYY-MM-DD interpreted in UTC noon (stable). */
export function addDaysAthensYmd(ymd: string, deltaDays: number): string {
  const s = ymd.trim().slice(0, 10);
  const parts = s.split("-").map(Number);
  if (parts.length !== 3 || parts.some((x) => Number.isNaN(x))) return getTodayYmdAthens();
  const u = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12, 0, 0));
  u.setUTCDate(u.getUTCDate() + deltaDays);
  return shiftedUtcDateToYmd(u);
}

/** Previous calendar day vs {@link getTodayYmdAthens} (Athens +3 “today”). */
export function getYesterdayYmdAthens(): string {
  return addDaysAthensYmd(getTodayYmdAthens(), -1);
}

/** Match HH:mm or HH:mm:ss (time-only, no date). */
const TIME_ONLY_REGEX = /^\d{1,2}:\d{2}(:\d{2})?$/;

/**
 * True if the value looks like a time-only string (e.g. "10:00", "14:30:00").
 * Such values must not be sent to Airtable datetime fields; use toAirtableDateTime instead.
 */
export function isTimeOnlyString(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return TIME_ONLY_REGEX.test(value.trim());
}

/**
 * Normalize to HH:mm for use with buildCustomShiftTimes.
 * Input can be "10:00", "10:00:00", or full ISO (we take time part).
 */
export function toHHmm(value: string): string {
  const t = value.trim();
  if (TIME_ONLY_REGEX.test(t)) return t.slice(0, 5);
  if (t.includes("T")) {
    const part = t.split("T")[1];
    if (part) return part.slice(0, 5);
  }
  return t.slice(0, 5);
}
