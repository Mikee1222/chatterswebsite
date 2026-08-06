/** Winner Video sourcing — tiers, statuses, slot types (distinct from Research winner_videos). */

export const WINNER_VIEW_THRESHOLD = 100_000;
export const SUPER_WINNER_VIEW_THRESHOLD = 300_000;

export const WINNER_TIERS = ["winner", "super_winner"] as const;
export type WinnerTier = (typeof WINNER_TIERS)[number];

export const WINNER_SUBMISSION_STATUSES = ["pending", "queued_for_recreation"] as const;
export type WinnerSubmissionStatus = (typeof WINNER_SUBMISSION_STATUSES)[number];

export const BUNCH_STATUSES = ["open", "closed"] as const;
export type BunchStatus = (typeof BUNCH_STATUSES)[number];

export const SLOT_SOURCES = ["from_winner", "researcher_submitted"] as const;
export type SlotSource = (typeof SLOT_SOURCES)[number];

export const SLOT_VIDEO_TYPES = ["skit", "ugc", "other"] as const;
export type SlotVideoType = (typeof SLOT_VIDEO_TYPES)[number];

/** Recreate counts when a submission is added to the recreation queue. */
export const TIER_RECREATE_COUNTS: Record<WinnerTier, number> = {
  winner: 3,
  super_winner: 10,
};

export function tierFromViewCount(viewCount: number): WinnerTier | null {
  if (!Number.isFinite(viewCount) || viewCount < WINNER_VIEW_THRESHOLD) return null;
  if (viewCount >= SUPER_WINNER_VIEW_THRESHOLD) return "super_winner";
  return "winner";
}

export function coerceWinnerTier(raw: unknown): WinnerTier | null {
  const s = String(raw ?? "").trim();
  return (WINNER_TIERS as readonly string[]).includes(s) ? (s as WinnerTier) : null;
}

export function coerceWinnerSubmissionStatus(raw: unknown): WinnerSubmissionStatus {
  const s = String(raw ?? "").trim();
  if ((WINNER_SUBMISSION_STATUSES as readonly string[]).includes(s)) {
    return s as WinnerSubmissionStatus;
  }
  return "pending";
}

export function coerceBunchStatus(raw: unknown): BunchStatus {
  const s = String(raw ?? "").trim();
  if ((BUNCH_STATUSES as readonly string[]).includes(s)) return s as BunchStatus;
  return "open";
}

export function coerceSlotSource(raw: unknown): SlotSource {
  const s = String(raw ?? "").trim();
  if ((SLOT_SOURCES as readonly string[]).includes(s)) return s as SlotSource;
  return "from_winner";
}

export function coerceSlotVideoType(raw: unknown): SlotVideoType | "" {
  const s = String(raw ?? "").trim().toLowerCase();
  if ((SLOT_VIDEO_TYPES as readonly string[]).includes(s)) return s as SlotVideoType;
  return "";
}

export function tierLabel(tier: WinnerTier): string {
  return tier === "super_winner" ? "Super Winner" : "Winner";
}

export function slotFilled(slot: { description?: string; video_link?: string }): boolean {
  return Boolean(String(slot.description ?? "").trim() && String(slot.video_link ?? "").trim());
}

/** Map slot video_type → Research content_type / script_video_type for Creative Scripts. */
export function mapSlotTypeToScriptFields(videoType: SlotVideoType | ""): {
  content_type: "Skit" | "UGC";
  script_video_type: "Storytelling" | "UGC" | "Other";
} {
  if (videoType === "ugc") return { content_type: "UGC", script_video_type: "UGC" };
  if (videoType === "other") return { content_type: "Skit", script_video_type: "Other" };
  return { content_type: "Skit", script_video_type: "Storytelling" };
}

/** Reverse map Research fields → slot video_type (best-effort). */
export function mapScriptFieldsToSlotType(
  contentType: string,
  scriptVideoType: string,
): SlotVideoType {
  const script = String(scriptVideoType ?? "").trim();
  if (script === "Other") return "other";
  if (script === "UGC" || String(contentType ?? "").trim() === "UGC") return "ugc";
  return "skit";
}
