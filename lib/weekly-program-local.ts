/**
 * Chatter weekly program UI: week anchors match Greece (fixed UTC+3) via {@link getWeekStartYmdInAthens}.
 * Safe to import from Server Components (no "use client").
 */

import { getMondayOfWeekFromYmdAthens, getWeekStartYmdInAthens } from "@/lib/airtable-datetime";

/** Current week’s Monday YYYY-MM-DD (Athens +3). */
export function getThisWeekMondayLocal(): string {
  return getWeekStartYmdInAthens(0);
}

/** Monday of the week containing the given YYYY-MM-DD (Athens +3). */
export function getMondayOfWeekLocalFromYmd(ymd: string): string {
  return getMondayOfWeekFromYmdAthens(ymd);
}

export function addWeeksLocal(ymd: string, deltaWeeks: number): string {
  const parts = ymd.slice(0, 10).split("-").map(Number);
  const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12, 0, 0));
  d.setUTCDate(d.getUTCDate() + deltaWeeks * 7);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function diffWeeksOffset(thisWeekMonday: string, weekStart: string): number {
  const a = new Date(thisWeekMonday + "T12:00:00").getTime();
  const b = new Date(weekStart + "T12:00:00").getTime();
  return Math.round((b - a) / (7 * 24 * 60 * 60 * 1000));
}
