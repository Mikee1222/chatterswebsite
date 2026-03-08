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
  "Intrestead",
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
