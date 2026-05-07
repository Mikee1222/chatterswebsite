export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "—";
  try {
    const d = new Date(dateString);
    if (Number.isNaN(d.getTime())) return typeof dateString === "string" ? dateString.trim() || "—" : "—";
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return typeof dateString === "string" ? dateString : "—";
  }
}

/** Date-only calendar string `YYYY-MM-DD` without timezone shift (noon UTC anchor). */
export function formatDateYmd(ymd: string | null | undefined): string {
  if (ymd == null || typeof ymd !== "string") return "—";
  const s = ymd.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return formatDate(ymd);
  return formatDate(`${s}T12:00:00.000Z`);
}

export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return "—";
  try {
    const d = new Date(dateString);
    if (Number.isNaN(d.getTime())) return typeof dateString === "string" ? dateString.trim().slice(0, 24) || "—" : "—";
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return typeof dateString === "string" ? dateString : "—";
  }
}
