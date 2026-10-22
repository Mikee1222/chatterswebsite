/**
 * Deadline helpers for Recording / Editing Briefs.
 * Entry timezone: Europe/Athens (Greece). Live read-only displays for NY + LA.
 * Stored as UTC (timestamptz).
 */

export const BRIEF_DEADLINE_ENTRY_TZ = "Europe/Athens";
export const BRIEF_DEADLINE_DISPLAY_TZS = [
  { id: "Europe/Athens", label: "Greece" },
  { id: "America/New_York", label: "New York" },
  { id: "America/Los_Angeles", label: "Los Angeles" },
] as const;

export const BRIEF_REMINDER_LEAD_HOURS_SETTING_KEY = "brief_reminder_lead_hours";
export const BRIEF_REMINDER_LEAD_HOURS_DEFAULT = 3;

/** Parse `YYYY-MM-DDTHH:mm` (or with seconds) as local wall time in `timeZone`, return UTC Date. */
export function greeceLocalToUtc(localIso: string, timeZone = BRIEF_DEADLINE_ENTRY_TZ): Date {
  const raw = localIso.trim();
  const m = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (!m) throw new Error("Invalid deadline format. Use YYYY-MM-DDTHH:mm");

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const second = Number(m[6] ?? "0");

  // Binary-search UTC instant whose wall clock in `timeZone` matches the intended local.
  let lo = Date.UTC(year, month - 1, day, hour, minute, second) - 14 * 3600_000;
  let hi = Date.UTC(year, month - 1, day, hour, minute, second) + 14 * 3600_000;
  for (let i = 0; i < 48; i++) {
    const mid = Math.floor((lo + hi) / 2);
    const parts = wallPartsInZone(new Date(mid), timeZone);
    const cmp = compareWall(parts, { year, month, day, hour, minute, second });
    if (cmp === 0) return new Date(mid);
    if (cmp < 0) lo = mid + 1;
    else hi = mid - 1;
  }
  // Fallback: approximate with mid
  return new Date(Math.floor((lo + hi) / 2));
}

type Wall = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function wallPartsInZone(date: Date, timeZone: string): Wall {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = fmt.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

function compareWall(a: Wall, b: Wall): number {
  const keys: (keyof Wall)[] = ["year", "month", "day", "hour", "minute", "second"];
  for (const k of keys) {
    if (a[k] !== b[k]) return a[k] < b[k] ? -1 : 1;
  }
  return 0;
}

/** Format a UTC instant as `YYYY-MM-DDTHH:mm` wall time in Greece (for datetime-local inputs). */
export function utcToGreeceLocalInput(utc: Date | string | null | undefined): string {
  if (!utc) return "";
  const d = typeof utc === "string" ? new Date(utc) : utc;
  if (Number.isNaN(d.getTime())) return "";
  const p = wallPartsInZone(d, BRIEF_DEADLINE_ENTRY_TZ);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** Human-readable wall time in a zone. */
export function formatInZone(
  utc: Date | string | null | undefined,
  timeZone: string,
  opts?: Intl.DateTimeFormatOptions,
): string {
  if (!utc) return "—";
  const d = typeof utc === "string" ? new Date(utc) : utc;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    ...opts,
  }).format(d);
}

export type DeadlineMultiZoneDisplay = {
  greece: string;
  newYork: string;
  losAngeles: string;
  isoUtc: string | null;
};

export function formatDeadlineMultiZone(
  utc: Date | string | null | undefined,
): DeadlineMultiZoneDisplay {
  if (!utc) {
    return { greece: "—", newYork: "—", losAngeles: "—", isoUtc: null };
  }
  const d = typeof utc === "string" ? new Date(utc) : utc;
  if (Number.isNaN(d.getTime())) {
    return { greece: "—", newYork: "—", losAngeles: "—", isoUtc: null };
  }
  return {
    greece: formatInZone(d, "Europe/Athens"),
    newYork: formatInZone(d, "America/New_York"),
    losAngeles: formatInZone(d, "America/Los_Angeles"),
    isoUtc: d.toISOString(),
  };
}

/** Countdown relative to viewer "now". */
export function formatCountdown(
  deadlineUtc: Date | string | null | undefined,
  now: Date = new Date(),
): { label: string; overdue: boolean; msRemaining: number } {
  if (!deadlineUtc) return { label: "No deadline", overdue: false, msRemaining: NaN };
  const d = typeof deadlineUtc === "string" ? new Date(deadlineUtc) : deadlineUtc;
  if (Number.isNaN(d.getTime())) return { label: "—", overdue: false, msRemaining: NaN };
  const ms = d.getTime() - now.getTime();
  const overdue = ms < 0;
  const abs = Math.abs(ms);
  const totalMin = Math.floor(abs / 60_000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const mins = totalMin % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  parts.push(`${mins}m`);
  const core = parts.join(" ");
  return {
    label: overdue ? `${core} overdue` : `${core} left`,
    overdue,
    msRemaining: ms,
  };
}

export function parseReminderLeadHours(raw: string | null | undefined): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return BRIEF_REMINDER_LEAD_HOURS_DEFAULT;
  return Math.min(168, Math.max(0, Math.round(n)));
}
