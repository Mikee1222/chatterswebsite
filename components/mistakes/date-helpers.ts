/** Date presets + range helpers for mistake filters (mistake_date). */

export type MistakeDatePreset =
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "this_week"
  | "this_month"
  | "last_month"
  | "custom"
  | "all";

export const MISTAKE_DATE_PRESET_LABELS: Record<Exclude<MistakeDatePreset, "custom" | "all">, string> = {
  today: "Today",
  yesterday: "Yesterday",
  "7d": "7d",
  "30d": "30d",
  this_week: "This week",
  this_month: "This month",
  last_month: "Last month",
};

export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Monday-start calendar week (local). */
export function startOfWeekMonday(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDay(); // 0 Sun … 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

function parseYmdLocal(ymd: string): Date | null {
  const s = ymd.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** ISO week-start key (Monday YYYY-MM-DD) for a mistake date. */
export function weekStartKeyFromIso(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = parseYmdLocal(iso.slice(0, 10));
  if (!d) return null;
  return toDateStr(startOfWeekMonday(d));
}

const SHORT_DAY_MONTH = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

/** "This week" | "Last week" | "3 Nov – 9 Nov" */
export function formatWeekGroupLabel(weekStartYmd: string, now = new Date()): string {
  const thisWeek = toDateStr(startOfWeekMonday(now));
  const lastWeekDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
  const lastWeek = toDateStr(startOfWeekMonday(lastWeekDate));
  if (weekStartYmd === thisWeek) return "This week";
  if (weekStartYmd === lastWeek) return "Last week";

  const start = parseYmdLocal(weekStartYmd);
  if (!start) return weekStartYmd;
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  return `${SHORT_DAY_MONTH.format(start)} – ${SHORT_DAY_MONTH.format(end)}`;
}

export function getMistakeDateRange(
  preset: MistakeDatePreset,
  customFrom?: string,
  customTo?: string
): { from?: string; to?: string } {
  if (preset === "custom") {
    return {
      from: customFrom?.trim() || undefined,
      to: customTo?.trim() || undefined,
    };
  }
  if (preset === "all") return {};

  const now = new Date();
  const today = toDateStr(now);

  if (preset === "today") return { from: today, to: today };

  if (preset === "yesterday") {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    const s = toDateStr(y);
    return { from: s, to: s };
  }

  if (preset === "this_week") {
    return { from: toDateStr(startOfWeekMonday(now)), to: today };
  }

  if (preset === "7d") {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    return { from: toDateStr(start), to: today };
  }

  if (preset === "30d") {
    const start = new Date(now);
    start.setDate(start.getDate() - 29);
    return { from: toDateStr(start), to: today };
  }

  if (preset === "this_month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: toDateStr(start), to: today };
  }

  // last_month
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0);
  return { from: toDateStr(start), to: toDateStr(end) };
}

/** Days between mistake_date (or created) and today, floored. */
export function daysAgoFromIso(iso: string | null | undefined, now = new Date()): number | null {
  if (!iso) return null;
  const d = (iso.slice(0, 10) || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const then = new Date(`${d}T12:00:00`);
  if (Number.isNaN(then.getTime())) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const that = new Date(then.getFullYear(), then.getMonth(), then.getDate());
  return Math.max(0, Math.round((today.getTime() - that.getTime()) / 86_400_000));
}
