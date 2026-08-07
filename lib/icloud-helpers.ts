/** iCloud organization status for a video bunch after editing upload. */
export const ICLOUD_STATUSES = ["pending", "in_progress", "organized"] as const;
export type IcloudStatus = (typeof ICLOUD_STATUSES)[number];

export function coerceIcloudStatus(raw: unknown): IcloudStatus {
  const s = String(raw ?? "").trim().toLowerCase();
  if ((ICLOUD_STATUSES as readonly string[]).includes(s)) return s as IcloudStatus;
  return "pending";
}

export const ICLOUD_STATUS_LABELS: Record<IcloudStatus, string> = {
  pending: "Pending",
  in_progress: "In progress",
  organized: "Organized",
};

export const ICLOUD_STATUS_STYLES: Record<IcloudStatus, { label: string; className: string }> = {
  pending: {
    label: "Pending",
    className: "bg-white/10 text-white/60",
  },
  in_progress: {
    label: "In progress",
    className: "bg-[#FF1493]/15 text-[#FF1493]",
  },
  organized: {
    label: "Organized",
    className: "bg-emerald-500/15 text-emerald-300",
  },
};

/** True when editing is uploaded — iCloud org can begin. */
export function bunchReadyForIcloud(bunch: { editing_status?: string }): boolean {
  return String(bunch.editing_status ?? "").toLowerCase() === "uploaded";
}

/** Days until material_until_date (negative = past). */
export function daysUntilMaterialDate(ymd: string | null | undefined, now = new Date()): number | null {
  const raw = (ymd ?? "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const target = new Date(`${raw}T12:00:00.000Z`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

export type MaterialRunwayAlert = "ok" | "soon" | "past";

export function materialRunwayAlert(days: number | null): MaterialRunwayAlert {
  if (days == null) return "ok";
  if (days < 0) return "past";
  if (days <= 7) return "soon";
  return "ok";
}
