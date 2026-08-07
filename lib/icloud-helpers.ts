/** Shared bunch pipeline stages (Bunches list · Pipeline Overview · detail stepper). */
export const BUNCH_PIPELINE_STAGES = [
  "Sourcing",
  "Scripting",
  "Filming",
  "Editing",
  "iCloud",
] as const;
export type BunchPipelineStage = (typeof BUNCH_PIPELINE_STAGES)[number];

/** 0–4 index for Sourcing → Scripting → Filming → Editing → iCloud. */
export function getBunchPipelineStageIndex(b: {
  provided_count?: number;
  pending_review_count?: number;
  assigned_creative_id?: string;
  assigned_filmer_id?: string;
  filming_status?: string;
  editing_status?: string;
  icloud_status?: string;
}): number {
  if (coerceIcloudStatus(b.icloud_status) === "organized") return 4;
  if (String(b.editing_status ?? "").toLowerCase() === "uploaded") return 4;
  const edit = String(b.editing_status ?? "").toLowerCase();
  if (edit === "assigned" || edit === "in_progress") return 3;
  if (String(b.filming_status ?? "").toLowerCase() === "uploaded") return 3;
  const film = String(b.filming_status ?? "").toLowerCase();
  if (film === "assigned" || film === "in_progress") return 2;
  if (b.assigned_filmer_id) return 2;
  if (b.assigned_creative_id) return 1;
  if ((b.provided_count ?? 0) > 0 || (b.pending_review_count ?? 0) > 0) return 0;
  return 0;
}

/** Editing uploaded but iCloud not yet organized — outstanding stage for steppers. */
export function isBunchIcloudOutstanding(b: {
  editing_status?: string;
  icloud_status?: string;
}): boolean {
  return (
    String(b.editing_status ?? "").toLowerCase() === "uploaded" &&
    coerceIcloudStatus(b.icloud_status) !== "organized"
  );
}

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

/**
 * Material runway tiers — shared by Pipeline Overview + iCloud Management.
 * Healthy >14d · Low 8–14d · Urgent ≤7d or past · No coverage (no date).
 */
export type MaterialRunwayTier = "healthy" | "low" | "urgent" | "none";

/** @deprecated Prefer MaterialRunwayTier — kept as alias for older call sites. */
export type MaterialRunwayAlert = MaterialRunwayTier;

export const MATERIAL_RUNWAY_LABELS: Record<MaterialRunwayTier, string> = {
  healthy: "Healthy",
  low: "Low",
  urgent: "Urgent",
  none: "No coverage",
};

export const MATERIAL_RUNWAY_STYLES: Record<MaterialRunwayTier, string> = {
  healthy: "border-emerald-500/45 bg-emerald-500/15 text-emerald-300",
  low: "border-amber-500/50 bg-amber-500/20 text-amber-200",
  urgent: "border-red-500/50 bg-red-500/20 text-red-200",
  none: "border-white/20 bg-white/10 text-white/55",
};

export const MATERIAL_RUNWAY_SORT: Record<MaterialRunwayTier, number> = {
  urgent: 0,
  none: 1,
  low: 2,
  healthy: 3,
};

export function materialRunwayTier(days: number | null): MaterialRunwayTier {
  if (days == null) return "none";
  if (days <= 7) return "urgent";
  if (days <= 14) return "low";
  return "healthy";
}

/** Alias — same as materialRunwayTier (Pipeline Overview + iCloud Management). */
export function materialRunwayAlert(days: number | null): MaterialRunwayTier {
  return materialRunwayTier(days);
}

export function formatMaterialDate(ymd: string | null | undefined): string {
  const raw = (ymd ?? "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "—";
  const [y, m, d] = raw.split("-").map((n) => Number.parseInt(n, 10));
  if (!y || !m || !d) return raw;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Short human date for runway cards — "Aug 27" (no year). */
export function formatMaterialDateShort(ymd: string | null | undefined): string {
  const raw = (ymd ?? "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "—";
  const [y, m, d] = raw.split("-").map((n) => Number.parseInt(n, 10));
  if (!y || !m || !d) return raw;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/** 12h clock for shoot times — "11:00 AM". Accepts HH:mm or ISO. */
export function formatShootTime12h(time: string | null | undefined): string | null {
  const raw = (time ?? "").trim();
  if (!raw) return null;
  const hhmm = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(raw);
  if (hhmm) {
    let h = Number.parseInt(hhmm[1]!, 10);
    const min = hhmm[2]!;
    if (Number.isNaN(h)) return null;
    const ap = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${min} ${ap}`;
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

export function formatDaysRemaining(days: number | null): string {
  if (days == null) return "No coverage date";
  if (days < 0) {
    const n = Math.abs(days);
    return `${n} day${n === 1 ? "" : "s"} past`;
  }
  if (days === 0) return "Ends today";
  return `${days} day${days === 1 ? "" : "s"} remaining`;
}
