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
