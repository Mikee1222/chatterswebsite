/**
 * Date/time display delegates to `@/lib/format-date` (en-GB: "19 May 2026").
 * Form inputs still use DD/MM helpers: `isoToEuropeanDisplay`, `parseEuropeanDateInput`.
 */

import { formatDate as formatDateUk, formatDateTime as formatDateTimeUk, formatDateYmd } from "@/lib/format-date";

const EU_LOCALE = "en-GB";

/** Match YYYY-MM-DD (date-only, no time). Use for scheduling week_start and derived dates. */
const DATE_ONLY_ISO = /^\d{4}-\d{2}-\d{2}$/;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * Format a date-only value (YYYY-MM-DD) — no TZ shift ("19 May 2026").
 */
export function formatDateOnlyEuropean(ymd: string | null | undefined): string {
  return formatDateYmd(ymd);
}

/**
 * Convert YYYY-MM-DD → `dd/mm/yyyy` for **typed date inputs** (must match {@link parseEuropeanDateInput}).
 * Use {@link formatDate} / {@link formatDateEuropean} for read-only UI labels.
 */
export function isoToEuropeanDisplay(iso: string | null | undefined): string {
  if (iso == null || typeof iso !== "string") return "";
  const s = iso.trim().slice(0, 10);
  if (!DATE_ONLY_ISO.test(s)) return "";
  const dd = s.slice(8, 10);
  const mm = s.slice(5, 7);
  const yyyy = s.slice(0, 4);
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Parse European-style date input (dd/mm/yyyy or d/m/yyyy) to YYYY-MM-DD. Returns null if invalid.
 */
export function parseEuropeanDateInput(str: string | null | undefined): string | null {
  if (str == null || typeof str !== "string") return null;
  const s = str.trim().replace(/\s+/g, " ");
  const parts = s.split(/[/.-]/);
  if (parts.length !== 3) return null;
  const [d, m, y] = parts.map((p) => parseInt(p, 10));
  if (!Number.isFinite(d) || !Number.isFinite(m) || !Number.isFinite(y)) return null;
  if (y < 1970 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/** European date only: DD/MM/YYYY (e.g. 07/03/2026). Explicit formatting — no locale dependency. */
export function formatDateEuropean(dateInput: string | Date | null | undefined): string {
  if (dateInput == null || dateInput === "") return "—";
  if (typeof dateInput === "string" && DATE_ONLY_ISO.test(dateInput.trim())) {
    return formatDateYmd(dateInput);
  }
  const s =
    typeof dateInput === "string"
      ? dateInput
      : typeof dateInput === "object" && dateInput instanceof Date && !Number.isNaN(dateInput.getTime())
        ? dateInput.toISOString()
        : "";
  if (!s) return "—";
  return formatDateUk(s);
}

/** Schedule-style long date (calendar YMD → stable; ISO → formatted). Matches app-wide formatDate style. */
export function formatDateLong(
  dateInput: string | Date | null | undefined,
  _locale: "en-GB" | "es" = "en-GB"
): string {
  void _locale;
  return formatDateEuropean(dateInput);
}

/** Model schedule / calendar: Athens wall time, 24h (handles ISO from Airtable). */
const SCHEDULE_TIME_ZONE = "Europe/Athens";
const SCHEDULE_TIME_LOCALE = "el-GR";

/**
 * Format a schedule time for display (ISO datetime, `HH:mm`, or `HH:mm:ss`).
 * Uses Europe/Athens so Airtable UTC instants match local wall clock.
 */
export function formatScheduleTime(isoString: string | null | undefined): string {
  if (isoString == null || isoString === "") return "—";
  const t = String(isoString).trim();
  const hhmmss = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;
  const m = hhmmss.exec(t);
  if (m) {
    return `${pad2(Number(m[1]))}:${pad2(Number(m[2]))}`;
  }
  try {
    const d = new Date(t);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleTimeString(SCHEDULE_TIME_LOCALE, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: SCHEDULE_TIME_ZONE,
      });
    }
  } catch {
    /* fall through */
  }
  try {
    const d = new Date(`1970-01-01T${t}`);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleTimeString(SCHEDULE_TIME_LOCALE, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "UTC",
      });
    }
  } catch {
    /* ignore */
  }
  return t;
}

/** Weekday + calendar date line for schedule day cards (Athens). */
export function formatScheduleWeekdayDateLine(dateYmd: string, locale: "en-GB" | "es" = "en-GB"): string {
  const ymd = String(dateYmd).trim().slice(0, 10);
  if (!DATE_ONLY_ISO.test(ymd)) return dateYmd;
  const d = new Date(`${ymd}T12:00:00Z`);
  const loc = locale === "es" ? "es" : "en-GB";
  const wd = d.toLocaleDateString(loc, { weekday: "short", timeZone: SCHEDULE_TIME_ZONE });
  const rest = d.toLocaleDateString(loc, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: SCHEDULE_TIME_ZONE,
  });
  return `${wd} · ${rest}`;
}

/** `live_stream` → `Live Stream` for schedule badges. */
export function formatScheduleItemTypeForDisplay(raw: string | null | undefined): string {
  if (raw == null || raw === "") return "—";
  return String(raw)
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Time range helper for schedule UI (24h, en dash). */
export function formatTimeRange(
  start: string | null | undefined,
  end: string | null | undefined
): string {
  const startText = formatScheduleTime(start);
  const endText = formatScheduleTime(end);
  if (startText === "—" && endText === "—") return "—";
  if (startText === "—") return endText;
  if (endText === "—") return startText;
  return `${startText}\u2013${endText}`;
}

/** Date and time: "19 May 2026, 14:30" (24h per en-GB). */
export function formatDateTimeEuropean(dateInput: string | Date | null | undefined): string {
  if (dateInput == null || dateInput === "") return "—";
  const s =
    typeof dateInput === "string"
      ? dateInput
      : dateInput instanceof Date && !Number.isNaN(dateInput.getTime())
        ? dateInput.toISOString()
        : "";
  return formatDateTimeUk(s || null);
}

/** Time only, 24h — delegates to {@link formatScheduleTime} (ISO + `HH:mm` + Athens for datetimes). */
export function formatTimeEuropean(timeInput: string | null | undefined): string {
  return formatScheduleTime(timeInput);
}

/** Current time as HH:mm (European 24h). Use for live clock display. */
export function formatTimeFromDate(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/**
 * Time from ISO datetime string (e.g. 2026-03-01T12:00:00.000Z → 12:00).
 * Uses UTC so schedule times (stored as UTC) display as intended; avoids local timezone shifting (e.g. +2h).
 * European style (24h).
 */
export function formatTimeFromISO(iso: string | null | undefined): string {
  if (iso == null || iso === "") return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleTimeString(EU_LOCALE, {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    });
  } catch {
    return "—";
  }
}

/** Returns true if value looks like an Airtable record id – do not show in UI. */
export function looksLikeRecordId(value: string | undefined): boolean {
  if (!value?.trim()) return false;
  return /^rec[A-Za-z0-9]{14}$/.test(value.trim()) || value.trim().startsWith("rec");
}

/** Display a name/snapshot value: hide raw record ids, use fallback for empty or id-like. */
export function displayName(value: string | null | undefined, fallback = "—"): string {
  const v = value?.trim();
  if (!v) return fallback;
  if (looksLikeRecordId(v)) return fallback;
  return v;
}

/** Duration from minutes (e.g. 133 → "2h 13m", 380 → "6h 20m", 45 → "45m"). */
export function formatDurationMinutes(totalMinutes: number | null | undefined): string {
  if (totalMinutes == null || totalMinutes < 0 || !Number.isFinite(totalMinutes)) return "—";
  const m = Math.round(totalMinutes);
  if (m === 0) return "0m";
  const h = Math.floor(m / 60);
  const mins = m % 60;
  if (h === 0) return `${mins}m`;
  if (mins === 0) return `${h}h`;
  return `${h}h ${mins}m`;
}

/** Human-readable relative time (e.g. "today", "2 days ago", "1 week ago"). */
export function formatRelativeTime(dateInput: string | Date | null | undefined): string {
  if (dateInput == null || dateInput === "") return "—";
  try {
    const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    if (Number.isNaN(d.getTime())) return "—";
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const that = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.floor((today.getTime() - that.getTime()) / (24 * 60 * 60 * 1000));
    if (diffDays === 0) return "today";
    if (diffDays === 1) return "yesterday";
    if (diffDays >= 2 && diffDays < 7) return `${diffDays} days ago`;
    if (diffDays >= 7 && diffDays < 14) return "1 week ago";
    if (diffDays >= 14 && diffDays < 21) return "2 weeks ago";
    if (diffDays >= 21 && diffDays < 28) return "3 weeks ago";
    if (diffDays >= 28 && diffDays < 60) return "1 month ago";
    if (diffDays >= 60 && diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    if (diffDays >= 365) return `${Math.floor(diffDays / 365)} year${Math.floor(diffDays / 365) !== 1 ? "s" : ""} ago`;
    return formatDateEuropean(dateInput);
  } catch {
    return "—";
  }
}
