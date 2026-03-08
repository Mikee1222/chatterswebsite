/**
 * European date/time formatting and display-value helpers.
 * All visible dates in the UI must be dd/mm/yyyy (European only). No USA or locale-default formatting.
 */

const EU_LOCALE = "en-GB";

/** Match YYYY-MM-DD (date-only, no time). Use for scheduling week_start and derived dates. */
const DATE_ONLY_ISO = /^\d{4}-\d{2}-\d{2}$/;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * Format a date-only value (YYYY-MM-DD) as DD/MM/YYYY with no timezone conversion.
 * Use for week_start, day columns, and any scheduling date that must not shift by timezone.
 * Example: "2026-03-02" → "02/03/2026" (never "03/03/2026").
 */
export function formatDateOnlyEuropean(ymd: string | null | undefined): string {
  if (ymd == null || typeof ymd !== "string") return "—";
  const s = ymd.trim();
  if (!DATE_ONLY_ISO.test(s)) return "—";
  const dd = s.slice(8, 10);
  const mm = s.slice(5, 7);
  const yyyy = s.slice(0, 4);
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Convert YYYY-MM-DD (ISO date) to display string dd/mm/yyyy. Use for date inputs and any place we show a date from ISO.
 */
export function isoToEuropeanDisplay(iso: string | null | undefined): string {
  if (iso == null || typeof iso !== "string") return "";
  const s = iso.trim().slice(0, 10);
  if (!DATE_ONLY_ISO.test(s)) return "";
  return formatDateOnlyEuropean(s);
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
    return formatDateOnlyEuropean(dateInput);
  }
  try {
    const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    if (Number.isNaN(d.getTime())) return "—";
    const dd = pad2(d.getDate());
    const mm = pad2(d.getMonth() + 1);
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  } catch {
    return "—";
  }
}

/** European date and time (e.g. 07/03/2026, 14:30). Explicit date part; time uses EU locale 24h. */
export function formatDateTimeEuropean(dateInput: string | Date | null | undefined): string {
  if (dateInput == null || dateInput === "") return "—";
  try {
    const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    if (Number.isNaN(d.getTime())) return "—";
    const datePart = `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
    const timePart = d.toLocaleTimeString(EU_LOCALE, { hour: "2-digit", minute: "2-digit", hour12: false });
    return `${datePart}, ${timePart}`;
  } catch {
    return "—";
  }
}

/** Time only, European 24h (e.g. 14:30). Use when you have a separate time string. */
export function formatTimeEuropean(timeInput: string | null | undefined): string {
  if (timeInput == null || timeInput === "") return "—";
  const t = String(timeInput).trim();
  if (/^\d{1,2}:\d{2}$/.test(t)) return t;
  try {
    const d = new Date(`1970-01-01T${t}`);
    if (Number.isNaN(d.getTime())) return t;
    return d.toLocaleTimeString(EU_LOCALE, { hour: "2-digit", minute: "2-digit", hour12: false });
  } catch {
    return t;
  }
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
