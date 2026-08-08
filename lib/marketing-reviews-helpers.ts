import { addDaysAthensYmd, getTodayYmdAthens } from "@/lib/airtable-datetime";

export const SPOT_CHECK_TYPES = [
  "Account audit",
  "Exec QA",
  "Account warning",
  "Brief delay",
  "Other",
] as const;

export type SpotCheckType = (typeof SPOT_CHECK_TYPES)[number];

export const SPOT_CHECK_STATUSES = ["Pending", "Fixed", "Escalated"] as const;
export type SpotCheckStatus = (typeof SPOT_CHECK_STATUSES)[number];

export const SPOT_CHECK_STATUS_STYLES: Record<
  SpotCheckStatus,
  { label: string; className: string; glowClassName: string }
> = {
  Pending: {
    label: "Pending",
    className: "border-amber-500/35 bg-amber-500/12 text-amber-300",
    glowClassName: "shadow-[0_0_10px_rgba(245,158,11,0.3)]",
  },
  Fixed: {
    label: "Fixed",
    className: "border-emerald-500/35 bg-emerald-500/12 text-emerald-300",
    glowClassName: "shadow-[0_0_10px_rgba(16,185,129,0.3)]",
  },
  Escalated: {
    label: "Escalated",
    className: "border-red-500/40 bg-red-500/15 text-red-300",
    glowClassName: "motion-safe:animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.45)]",
  },
};

export const SPOT_CHECK_TYPE_STYLES: Record<SpotCheckType, { className: string }> = {
  "Account audit": { className: "border-sky-500/35 bg-sky-500/10 text-sky-300" },
  "Exec QA": { className: "border-violet-500/35 bg-violet-500/10 text-violet-300" },
  "Account warning": { className: "border-orange-500/35 bg-orange-500/10 text-orange-300" },
  "Brief delay": { className: "border-yellow-500/35 bg-yellow-500/10 text-yellow-200" },
  Other: { className: "border-white/15 bg-white/5 text-[#B8B4B8]/70" },
};

/** Display name stored on spot checks / daily reviews as `manager_name`. */
export function spotCheckManagerName(session: {
  fullName?: string | null;
  email?: string | null;
}): string {
  return session.fullName?.trim() || session.email?.trim() || "Manager";
}

/** Stable ownership id (prefer Airtable id for dual-backend continuity). */
export function spotCheckManagerId(session: {
  airtableUserId?: string | null;
  id: string;
}): string {
  return session.airtableUserId?.trim() || session.id;
}

type ManagerOwned = {
  manager_name: string;
  manager_id?: string | null;
};

/** Prefer stable manager_id; fall back to display-name match for legacy rows. */
export function isOwnedByManager(
  row: ManagerOwned,
  managerId: string,
  managerName: string,
): boolean {
  const id = managerId.trim();
  const rowId = String(row.manager_id ?? "").trim();
  if (id && rowId) return rowId === id;
  const target = managerName.trim().toLowerCase();
  if (!target) return false;
  return row.manager_name.trim().toLowerCase() === target;
}

/** Client-side filter when server-side manager filter is unavailable. */
export function filterSpotChecksByManager<T extends ManagerOwned>(
  checks: T[],
  managerName: string,
  managerId?: string,
): T[] {
  const id = managerId?.trim() ?? "";
  const target = managerName.trim().toLowerCase();
  if (!id && !target) return checks;
  return checks.filter((sc) => isOwnedByManager(sc, id, managerName));
}

/** Client-side filter for daily reviews submitted by a supervisor. */
export function filterDailyReviewsByManager<T extends ManagerOwned>(
  reviews: T[],
  managerName: string,
  managerId?: string,
): T[] {
  const id = managerId?.trim() ?? "";
  const target = managerName.trim().toLowerCase();
  if (!id && !target) return reviews;
  return reviews.filter((r) => isOwnedByManager(r, id, managerName));
}

/** Unix ms timestamp for resolution_time when status → Fixed. */
export function resolutionTimeNowMs(): number {
  return Date.now();
}

/** Today's calendar date YYYY-MM-DD in Europe/Athens (business timezone). */
export function todayReviewIso(): string {
  return getTodayYmdAthens();
}

/** Calendar date N days before today (Athens), as YYYY-MM-DD. */
export function isoDateDaysAgo(days: number): string {
  return addDaysAthensYmd(getTodayYmdAthens(), -days);
}

export function formatReviewDate(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export const DAILY_REVIEW_KPIS = [
  "Posts published on time",
  "Engagement targets met",
  "Follower growth on track",
  "Content quality standards",
  "DM / comment response rate",
  "Hashtag & caption compliance",
] as const;

export const COMPLIANCE_VS_MASTER = [
  "Username matches master",
  "Bio matches master",
  "Link in bio correct",
  "Profile photo matches",
  "Highlights / pinned posts updated",
] as const;

/**
 * Normalize any Airtable `review_date` value (or a UI-selected date) into a stable
 * `YYYY-MM-DD` calendar key for equality comparison.
 *
 * Airtable's `filterByFormula` string equality (`{review_date} = "2026-07-03"`) is
 * unreliable for date fields: the field is a date value while the literal is text, and
 * the base's European D/M/YYYY display format makes the implicit date⇄text coercion
 * mismatch the ISO date we send — so a matching review is never found. We instead fetch
 * all reviews and compare on this normalized key in JS (mirrors the Europe/Athens
 * date-bucketing fix in va-schedule-client.tsx).
 *
 * Date-only values (`YYYY-MM-DD`) are returned as-is; full ISO timestamps are bucketed to
 * the Europe/Athens calendar day so a review never lands on the wrong day near midnight.
 */
export function toReviewDateKey(value: unknown): string {
  if (typeof value !== "string") return "";
  const s = value.trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s.slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens" }).format(d);
}
