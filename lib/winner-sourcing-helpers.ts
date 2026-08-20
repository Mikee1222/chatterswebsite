/** Winner Video sourcing — tiers, statuses, slot types (distinct from Research winner_videos). */

export const WINNER_VIEW_THRESHOLD = 100_000;
export const SUPER_WINNER_VIEW_THRESHOLD = 300_000;

export const WINNER_TIERS = ["winner", "super_winner"] as const;
export type WinnerTier = (typeof WINNER_TIERS)[number];

export const WINNER_SUBMISSION_STATUSES = ["pending", "queued_for_recreation"] as const;
export type WinnerSubmissionStatus = (typeof WINNER_SUBMISSION_STATUSES)[number];

/** Provenance of a Winner Videos Hub submission (VA FAB vs ClarioSuite auto-detect). */
export const WINNER_SUBMISSION_SOURCES = [
  "va_submitted",
  "researcher_submitted",
  "auto_detected",
] as const;
export type WinnerSubmissionSource = (typeof WINNER_SUBMISSION_SOURCES)[number];

export const WINNER_SUBMISSION_SOURCE_LABELS: Record<WinnerSubmissionSource, string> = {
  auto_detected: "Auto-detected",
  va_submitted: "VA Submitted",
  researcher_submitted: "Researcher Submitted",
};

export const BUNCH_STATUSES = ["open", "closed"] as const;
export type BunchStatus = (typeof BUNCH_STATUSES)[number];

export const SLOT_SOURCES = ["from_winner", "researcher_submitted"] as const;
export type SlotSource = (typeof SLOT_SOURCES)[number];

export type ModelWinnerThresholds = {
  model_id: string;
  winner_threshold_views: number;
  super_winner_threshold_views: number;
  updated_at: string;
  updated_by: string;
};

export const DEFAULT_MODEL_WINNER_THRESHOLDS = {
  winner_threshold_views: WINNER_VIEW_THRESHOLD,
  super_winner_threshold_views: SUPER_WINNER_VIEW_THRESHOLD,
} as const;

export const SLOT_VIDEO_TYPES = [
  "skit",
  "ugc",
  "text_on_screen",
  "interview",
  "clips",
  "other",
] as const;
export type SlotVideoType = (typeof SLOT_VIDEO_TYPES)[number];

export const SLOT_VIDEO_TYPE_LABELS: Record<SlotVideoType, string> = {
  skit: "Skit",
  ugc: "UGC",
  text_on_screen: "Text on screen",
  interview: "Interview",
  clips: "Clips",
  other: "Other",
};

export function slotVideoTypeLabel(
  type: string | null | undefined,
  otherText?: string | null,
): string {
  const t = coerceSlotVideoType(type);
  if (!t) return "";
  if (t === "other") {
    const custom = String(otherText ?? "").trim();
    return custom ? `Other: ${custom}` : SLOT_VIDEO_TYPE_LABELS.other;
  }
  return SLOT_VIDEO_TYPE_LABELS[t];
}

/** Default recreate counts when a submission is added to the recreation queue. */
export const TIER_RECREATE_COUNTS: Record<WinnerTier, number> = {
  winner: 3,
  super_winner: 10,
};

/** system_settings keys for admin-configurable recreate counts. */
export const WINNER_RECREATE_COUNT_SETTING_KEY = "winner_sourcing.winner_recreate_count";
export const SUPER_WINNER_RECREATE_COUNT_SETTING_KEY =
  "winner_sourcing.super_winner_recreate_count";

export type WinnerSourcingRecreateConfig = {
  winner_recreate_count: number;
  super_winner_recreate_count: number;
};

export function parsePositiveInt(raw: unknown, fallback: number): number {
  const n = typeof raw === "number" ? raw : Number.parseInt(String(raw ?? "").trim(), 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.round(n), 500);
}

/** Non-negative view threshold (0 allowed for tests); caps at 100M. */
export function parseViewThreshold(raw: unknown, fallback: number): number {
  const n = typeof raw === "number" ? raw : Number.parseInt(String(raw ?? "").trim(), 10);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(Math.round(n), 100_000_000);
}

export function normalizeModelWinnerThresholds(input: {
  winner_threshold_views: number;
  super_winner_threshold_views: number;
}): {
  winner_threshold_views: number;
  super_winner_threshold_views: number;
} {
  const winner = parseViewThreshold(
    input.winner_threshold_views,
    DEFAULT_MODEL_WINNER_THRESHOLDS.winner_threshold_views,
  );
  let superWinner = parseViewThreshold(
    input.super_winner_threshold_views,
    DEFAULT_MODEL_WINNER_THRESHOLDS.super_winner_threshold_views,
  );
  if (superWinner < winner) superWinner = winner;
  return {
    winner_threshold_views: winner,
    super_winner_threshold_views: superWinner,
  };
}

export function tierFromViewCount(
  viewCount: number,
  thresholds?: {
    winner_threshold_views?: number;
    super_winner_threshold_views?: number;
  } | null,
): WinnerTier | null {
  const winner =
    thresholds?.winner_threshold_views ?? DEFAULT_MODEL_WINNER_THRESHOLDS.winner_threshold_views;
  const superWinner =
    thresholds?.super_winner_threshold_views ??
    DEFAULT_MODEL_WINNER_THRESHOLDS.super_winner_threshold_views;
  if (!Number.isFinite(viewCount) || viewCount < winner) return null;
  if (viewCount >= superWinner) return "super_winner";
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

export function coerceWinnerSubmissionSource(raw: unknown): WinnerSubmissionSource | null {
  const s = String(raw ?? "").trim().toLowerCase();
  if ((WINNER_SUBMISSION_SOURCES as readonly string[]).includes(s)) {
    return s as WinnerSubmissionSource;
  }
  if (s === "auto" || s === "clariosuite" || s === "auto_detect") return "auto_detected";
  if (s === "va" || s === "manual" || s === "me_submitted" || s === "marketing") return "va_submitted";
  if (s === "researcher" || s === "research") return "researcher_submitted";
  return null;
}

export function winnerSubmissionSourceLabel(source: WinnerSubmissionSource): string {
  return WINNER_SUBMISSION_SOURCE_LABELS[source];
}

/** Resolve source from explicit column or submitter heuristics (pre–auto-detection rows). */
export function resolveWinnerSubmissionSource(input: {
  source?: unknown;
  submitted_by_id?: string | null;
  submitted_by_name?: string | null;
}): WinnerSubmissionSource {
  const explicit = coerceWinnerSubmissionSource(input.source);
  if (explicit) return explicit;
  const id = String(input.submitted_by_id ?? "").trim().toLowerCase();
  const name = String(input.submitted_by_name ?? "").trim().toLowerCase();
  if (
    id === "system" ||
    id === "auto" ||
    id === "clariosuite_auto" ||
    name.includes("auto") ||
    name.includes("clario") ||
    name.includes("detection")
  ) {
    return "auto_detected";
  }
  if (name.includes("research")) return "researcher_submitted";
  return "va_submitted";
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

/** 3-way bunch capacity: approved slots + pending research finds + still needed. */
export type BunchFulfillment = {
  filled: number;
  pending: number;
  remaining: number;
  target: number;
  occupied: number;
  /** Share of target already filled (approved slots). */
  filledPct: number;
  /** Share awaiting Research Manage review. */
  pendingPct: number;
  /** Share still open for researcher submits. */
  remainingPct: number;
  /** remaining / target — higher = more urgent for researchers. */
  needRatio: number;
};

export function getBunchFulfillment(bunch: {
  provided_count?: number;
  pending_review_count?: number;
  remaining_count?: number;
  target_video_count: number;
}): BunchFulfillment {
  const target = Math.max(1, Number(bunch.target_video_count) || 1);
  const filled = Math.max(0, bunch.provided_count ?? 0);
  const pending = Math.max(0, bunch.pending_review_count ?? 0);
  const remaining =
    bunch.remaining_count ?? Math.max(0, target - filled - pending);
  const occupied = filled + pending;
  return {
    filled,
    pending,
    remaining: Math.max(0, remaining),
    target,
    occupied,
    filledPct: Math.min(100, (filled / target) * 100),
    pendingPct: Math.min(100, (pending / target) * 100),
    remainingPct: Math.min(100, (Math.max(0, remaining) / target) * 100),
    needRatio: Math.max(0, remaining) / target,
  };
}

/** Urgency tone for researcher overview cards (most remaining need = amber). */
export function bunchUrgencyTone(needRatio: number, remaining: number): {
  accent: "amber" | "champagne" | "pink" | "emerald";
  label: string;
  barClass: string;
  glow: string;
  ring: string;
} {
  if (remaining <= 0) {
    return {
      accent: "emerald",
      label: "Complete",
      barClass: "from-emerald-500/80 to-emerald-400",
      glow: "rgba(52,211,153,0.28)",
      ring: "ring-emerald-400/25 border-emerald-400/25",
    };
  }
  if (needRatio >= 0.45) {
    return {
      accent: "amber",
      label: "Needs finds",
      barClass: "from-amber-400 to-amber-300",
      glow: "rgba(251,191,36,0.32)",
      ring: "ring-amber-400/20 border-amber-400/20",
    };
  }
  if (needRatio >= 0.2) {
    return {
      accent: "champagne",
      label: "In progress",
      barClass: "from-[#D4AF8C] to-[#E8C9A8]",
      glow: "rgba(212,175,140,0.3)",
      ring: "ring-[#D4AF8C]/20 border-[#D4AF8C]/20",
    };
  }
  return {
    accent: "pink",
    label: "Nearly full",
    barClass: "from-[#FF1493] to-[#E91E8C]",
    glow: "rgba(255,20,147,0.3)",
    ring: "ring-[#FF1493]/20 border-[#FF1493]/20",
  };
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
  // skit / text_on_screen / interview / clips → storytelling skit bucket for creatives
  return { content_type: "Skit", script_video_type: "Storytelling" };
}

/** Reverse map Research fields → slot video_type (best-effort; prefer sourcing_video_type when set). */
export function mapScriptFieldsToSlotType(
  contentType: string,
  scriptVideoType: string,
  sourcingVideoType?: string | null,
): SlotVideoType {
  const fromSourcing = coerceSlotVideoType(sourcingVideoType);
  if (fromSourcing) return fromSourcing;
  const script = String(scriptVideoType ?? "").trim();
  if (script === "Other") return "other";
  if (script === "UGC" || String(contentType ?? "").trim() === "UGC") return "ugc";
  return "skit";
}
