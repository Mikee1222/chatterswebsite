/**
 * Centralized single-select option values for Airtable-backed fields.
 * Keep these in sync with Airtable base options to avoid drift.
 *
 * whale_transactions.type
 */
export const TRANSACTION_TYPES = [
  "sexting + videos",
  "sexting + videos + custom",
  "sexting + videos + vip",
  "sexting",
  "other",
] as const;

export type TransactionTypeOption = (typeof TRANSACTION_TYPES)[number];

/** Human-readable label for transaction type (values are already display-ready from Airtable). */
export function transactionTypeLabel(value: string): string {
  if (TRANSACTION_TYPES.includes(value as TransactionTypeOption)) return value;
  return "other";
}

/**
 * whales.relationship_status – single source of truth. Match Airtable options exactly.
 */
export const RELATIONSHIP_STATUS_OPTIONS = [
  "New",
  "Angry",
  "In Love",
  "Interested",
  "Simp",
] as const;

export type RelationshipStatusOption = (typeof RELATIONSHIP_STATUS_OPTIONS)[number];

/**
 * whales.status – single source of truth. Match Airtable options exactly.
 */
export const WHALE_STATUS_OPTIONS = [
  "Active",
  "Inactive",
  "Dead",
  "Deleted Account",
] as const;

export type WhaleStatusOption = (typeof WHALE_STATUS_OPTIONS)[number];

/** Badge variant for whale status (for My Whales table). Only new status values supported. */
export function whaleStatusBadgeVariant(
  status: string
): "emerald" | "amber" | "slate" {
  if (status === "Active") return "emerald";
  if (status === "Inactive") return "amber";
  if (status === "Dead" || status === "Deleted Account") return "slate";
  return "slate";
}

/**
 * whales.hours_active – multi-select. Match Airtable options exactly (spacing and capitalization).
 */
export const HOURS_ACTIVE_OPTIONS = [
  "7am - 10am",
  "10am-4pm",
  "4pm - 8pm",
  "8pm - 12am",
  "12am+",
] as const;

export type HoursActiveOption = (typeof HOURS_ACTIVE_OPTIONS)[number];

/**
 * whales.spend_level
 */
export const SPEND_LEVEL_OPTIONS = ["low", "medium", "high", "vip", "whale"] as const;

/**
 * custom_requests.custom_type (CustomRequestType)
 */
export const CUSTOM_REQUEST_TYPE_OPTIONS = [
  "video",
  "photo_set",
  "voice_note",
  "rating",
  "special_request",
  "other",
] as const;

/**
 * custom_requests.priority
 */
export const CUSTOM_REQUEST_PRIORITY_OPTIONS = ["low", "normal", "high", "urgent"] as const;

/**
 * custom_requests.status
 */
export const CUSTOM_REQUEST_STATUS_OPTIONS = [
  "pending",
  "accepted",
  "recording",
  "completed",
  "delivered",
  "cancelled",
] as const;

/**
 * whale_transactions.currency – match Airtable options exactly (usd, eur only).
 */
export const TRANSACTION_CURRENCY_OPTIONS = ["usd", "eur"] as const;

/**
 * model_live_streams.platform – single source of truth for live stream platform.
 * Match Airtable single-select options exactly: onlyfans, instagram, tiktok, other.
 */
export const MODEL_LIVE_STREAM_PLATFORM_OPTIONS = ["onlyfans", "instagram", "tiktok", "other"] as const;

export type ModelLiveStreamPlatformOption = (typeof MODEL_LIVE_STREAM_PLATFORM_OPTIONS)[number];

export function isModelLiveStreamPlatform(value: string): value is ModelLiveStreamPlatformOption {
  return MODEL_LIVE_STREAM_PLATFORM_OPTIONS.includes(value as ModelLiveStreamPlatformOption);
}

/** Display label for model live stream platform (for UI only; Airtable stores lowercase). */
export function modelLiveStreamPlatformLabel(value: string): string {
  if (value === "onlyfans") return "OnlyFans";
  if (value === "instagram") return "Instagram";
  if (value === "tiktok") return "TikTok";
  if (value === "other") return "Other";
  return value;
}

/** Platforms the model dashboard offers for impromptu "Go Live" (subset of Airtable options). */
export const MODEL_GO_LIVE_PLATFORM_OPTIONS = ["instagram", "tiktok", "onlyfans"] as const;

export type ModelGoLivePlatformOption = (typeof MODEL_GO_LIVE_PLATFORM_OPTIONS)[number];

export function isModelGoLivePlatform(value: string): value is ModelGoLivePlatformOption {
  return MODEL_GO_LIVE_PLATFORM_OPTIONS.includes(value as ModelGoLivePlatformOption);
}

/**
 * model_live_streams.reason – why the model went live (Start Live).
 * Match Airtable / Supabase single-select options exactly.
 */
export const MODEL_LIVE_STREAM_REASON_OPTIONS = ["going_out", "gym", "at_home", "other"] as const;

export type ModelLiveStreamReasonOption = (typeof MODEL_LIVE_STREAM_REASON_OPTIONS)[number];

export function isModelLiveStreamReason(value: string): value is ModelLiveStreamReasonOption {
  return MODEL_LIVE_STREAM_REASON_OPTIONS.includes(value as ModelLiveStreamReasonOption);
}

/** Display label for live reason in notifications / admin (Greek — team language). UI uses i18n. */
export function modelLiveStreamReasonLabel(
  reason: string | null | undefined,
  reasonNote?: string | null
): string {
  const key = (reason ?? "").trim();
  let label = key;
  if (key === "going_out") label = "Βγαίνω έξω";
  else if (key === "gym") label = "Γυμναστήριο";
  else if (key === "at_home") label = "Σπίτι";
  else if (key === "other") label = "Άλλο";
  else if (!key) return "";
  const note = reasonNote?.trim();
  if (key === "other" && note) return `${label} — ${note}`;
  return label;
}

/**
 * model_live_streams.status – match Airtable single-select (scheduled rows + ad-hoc live/ended).
 */
export const MODEL_LIVE_STREAM_STATUS_OPTIONS = [
  "scheduled",
  "in_progress",
  "live",
  "ended",
  "cancelled",
  "completed",
] as const;

export type ModelLiveStreamStatusOption = (typeof MODEL_LIVE_STREAM_STATUS_OPTIONS)[number];

/**
 * model_tasks.type (single-select). Match Airtable single-select options exactly.
 * Expected: script, mass, live_prep, live_stream, custom, content, admin_note, other.
 */
export const MODEL_TASK_TYPE_OPTIONS = [
  "script",
  "mass",
  "live_prep",
  "live_stream",
  "custom",
  "content",
  "admin_note",
  "other",
] as const;

export type ModelTaskTypeOption = (typeof MODEL_TASK_TYPE_OPTIONS)[number];

export function modelTaskTypeLabel(value: string): string {
  const labels: Record<string, string> = {
    script: "Script",
    mass: "Mass",
    live_prep: "Live prep",
    live_stream: "Live stream",
    custom: "Custom",
    content: "Content",
    admin_note: "Admin note",
    other: "Other",
  };
  return labels[value] ?? value;
}
