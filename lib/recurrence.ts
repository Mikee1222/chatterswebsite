import { parseISO } from "date-fns";
import type { VaRecurrenceDay } from "@/types";

/** Map Airtable weekday names to JS `Date#getUTCDay()` (0 = Sunday … 6 = Saturday). */
const RECURRENCE_DAY_TO_UTCDAY: Record<VaRecurrenceDay, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

function targetUtcDays(recurrenceDays: string[]): number[] {
  const out: number[] = [];
  for (const d of recurrenceDays) {
    const n = RECURRENCE_DAY_TO_UTCDAY[d as VaRecurrenceDay];
    if (typeof n === "number") out.push(n);
  }
  return out;
}

function addUtcMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * 60_000);
}

function addUtcDays(d: Date, days: number): Date {
  const out = new Date(d.getTime());
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

function addUtcWeeks(d: Date, weeks: number): Date {
  return addUtcDays(d, weeks * 7);
}

/** Monday 00:00:00.000 UTC of the calendar week containing `d` (UTC date parts). */
function startOfUtcWeekMonday(d: Date): Date {
  const dow = d.getUTCDay(); // 0 Sun … 6 Sat
  const daysFromMonday = (dow + 6) % 7;
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  return new Date(Date.UTC(y, m, day - daysFromMonday, 0, 0, 0, 0));
}

function calendarWeeksBetweenUtcMon(a: Date, b: Date): number {
  const sa = startOfUtcWeekMonday(a).getTime();
  const sb = startOfUtcWeekMonday(b).getTime();
  return Math.round((sb - sa) / (7 * 24 * 60 * 60 * 1000));
}

function addUtcMonths(d: Date, months: number): Date {
  const out = new Date(d.getTime());
  const day = out.getUTCDate();
  out.setUTCMonth(out.getUTCMonth() + months);
  if (out.getUTCDate() < day) {
    out.setUTCDate(0);
  }
  return out;
}

/** Same wire format as `toAirtableDateTimeIsoUtc` in `services/va-tasks.ts`. */
function toAirtableDateTimeIsoUtc(d: Date): string {
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  const s = String(d.getUTCSeconds()).padStart(2, "0");
  const ms = String(d.getUTCMilliseconds()).padStart(3, "0");
  return `${y}-${mo}-${day}T${h}:${mi}:${s}.${ms}Z`;
}

function parseCurrentDue(currentDue: string): Date | null {
  const s = currentDue.trim();
  if (!s) return null;
  const d = parseISO(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseRecurrenceEndUtc(ymd: string): Date | null {
  const p = ymd.trim().split("-").map((x) => Number(x));
  if (p.length !== 3 || !p[0] || !p[1] || !p[2]) return null;
  return new Date(Date.UTC(p[0], p[1] - 1, p[2], 23, 59, 59, 999));
}

/**
 * Next due instant after `currentDue`, or `null` if recurrence ended or type invalid.
 * Uses UTC calendar arithmetic so ISO `…Z` due dates stay stable.
 */
export function getNextOccurrence(
  currentDue: string,
  recurrenceType: string,
  recurrenceInterval = 1,
  recurrenceDays: string[] = [],
  recurrenceEndDate: string | null = null
): string | null {
  const current = parseCurrentDue(currentDue);
  if (!current) return null;

  const interval = Math.max(1, Math.floor(recurrenceInterval) || 1);
  const type = recurrenceType.trim().toLowerCase();
  let next: Date | null = null;

  switch (type) {
    case "daily":
      next = addUtcDays(current, interval);
      break;

    case "weekly": {
      const targets = targetUtcDays(recurrenceDays);
      if (targets.length === 0) {
        next = addUtcWeeks(current, interval);
        break;
      }
      let search = addUtcMinutes(current, 1);
      const limit = addUtcDays(current, 400);
      while (search.getTime() <= limit.getTime()) {
        const strictFuture = search.getTime() > current.getTime();
        if (targets.includes(search.getUTCDay())) {
          if (interval <= 1) {
            if (strictFuture) {
              next = search;
              break;
            }
          } else {
            const wDiff = calendarWeeksBetweenUtcMon(current, search);
            if (strictFuture && wDiff >= interval && wDiff % interval === 0) {
              next = search;
              break;
            }
          }
        }
        search = addUtcDays(search, 1);
      }
      if (!next) next = addUtcWeeks(current, interval);
      break;
    }

    case "monthly":
      next = addUtcMonths(current, interval);
      break;

    case "custom":
      next = addUtcDays(current, interval);
      break;

    default:
      return null;
  }

  if (!next || Number.isNaN(next.getTime())) return null;

  if (recurrenceEndDate?.trim()) {
    const end = parseRecurrenceEndUtc(recurrenceEndDate);
    if (end && next.getTime() > end.getTime()) return null;
  }

  return toAirtableDateTimeIsoUtc(next);
}

export function shouldSpawnRecurring(task: {
  is_recurring: boolean;
  recurrence_type: string | null | "";
  recurrence_end_date: string | null;
  due_date: string | null;
}): boolean {
  if (!task.is_recurring) return false;
  const rt = typeof task.recurrence_type === "string" ? task.recurrence_type.trim() : "";
  if (!rt) return false;
  if (!task.due_date?.trim()) return false;
  if (task.recurrence_end_date?.trim()) {
    const end = parseRecurrenceEndUtc(task.recurrence_end_date);
    if (end && Date.now() > end.getTime()) return false;
  }
  return true;
}

/** Same title + assignees (order-insensitive) for de-duping spawned series. */
export function vaTaskSeriesKey(task: { title: string; assigned_to_ids: string[] }): string {
  const ids = [...task.assigned_to_ids].map((x) => x.trim()).filter(Boolean).sort();
  return `${task.title.trim()}\0${ids.join(",")}`;
}
