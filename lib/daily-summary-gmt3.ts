/** Calendar "yesterday" as YYYY-MM-DD in fixed offset UTC+3 (IANA `Etc/GMT-3`). */
export function getYesterdayCalendarYmdGmtPlus3(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Etc/GMT-3",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: Intl.DateTimeFormatPartTypes) =>
    parseInt(parts.find((p) => p.type === t)?.value ?? "0", 10);
  const y = get("year");
  const m = get("month");
  const d = get("day");
  const prev = new Date(Date.UTC(y, m - 1, d - 1));
  return `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}-${String(prev.getUTCDate()).padStart(2, "0")}`;
}

export function formatSummaryTitleDate(ymd: string): string {
  const [y, mo, d] = ymd.split("-").map(Number);
  if (!y || !mo || !d) return ymd;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(dt);
}

export function whaleCreatedBoundsForYmdGmtPlus3(ymd: string): { startMs: number; endMs: number } {
  const startMs = new Date(`${ymd}T00:00:00+03:00`).getTime();
  const endMs = new Date(`${ymd}T23:59:59.999+03:00`).getTime();
  return { startMs, endMs };
}
