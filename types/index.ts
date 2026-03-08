import type { TransactionTypeOption } from "@/lib/airtable-options";

/** Role from Airtable users table; auth must match. */
export type UserRole = "admin" | "manager" | "chatter" | "virtual_assistant";

/** whales.status – must match Airtable single-select options exactly. */
export type WhaleStatus =
  | "Active"
  | "Inactive"
  | "Dead"
  | "Deleted Account";
/** whales.relationship_status – must match Airtable single-select options exactly. */
export type RelationshipStatus =
  | "New"
  | "Angry"
  | "In Love"
  | "Intrestead"
  | "Simp";
export type SpendLevel = "low" | "medium" | "high" | "vip" | "whale";
export type Platform = "onlyfans" | "fanvue" | "other";
export type ShiftStatus = "active" | "on_break" | "completed" | "cancelled";
export type StaffRole = "chatter" | "virtual_assistant";
export type ShiftType = "chatting" | "mistakes" | "vault_cleaning" | "other";

export interface Whale {
  id: string;
  whale_id: string;
  username: string;
  platform: Platform;
  /** First linked record id from assigned_chatter (users). */
  assigned_chatter_id: string;
  assigned_chatter_name: string;
  /** First linked record id from assigned_model (modelss). */
  assigned_model_id: string;
  assigned_model_name: string;
  /** Airtable single-select or empty string when not set. */
  relationship_status: RelationshipStatus | "";
  /** Multi-select: active hours slots. Values from HOURS_ACTIVE_OPTIONS. */
  hours_active: string[];
  active_hours_start: string;
  active_hours_end: string;
  timezone: string;
  country: string;
  language: string;
  spend_level: SpendLevel;
  total_spent: number;
  last_spent_amount: number;
  last_spent_date: string | null;
  last_contact_date: string | null;
  next_followup: string | null;
  response_speed: string;
  personality_type: string;
  preferences: string;
  red_flags: string;
  retention_risk: string;
  status: WhaleStatus;
  notes: string;
  created_at: string;
  updated_at: string;
  last_updated_by: string;
}

export interface ModelRecord {
  id: string;
  model_id: string;
  model_name: string;
  platform: Platform;
  status: string;
  current_status: "free" | "occupied";
  /** First linked record id from current_chatter (users). */
  current_chatter_id: string;
  current_chatter_name: string;
  current_shift_id: string;
  entered_at: string | null;
  /** First linked record id from last_chatter (users). */
  last_chatter_id: string;
  last_chatter_name: string;
  last_exit_at: string | null;
  priority: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface Shift {
  id: string;
  shift_id: string;
  /** First linked record id from chatter (users). */
  chatter_id: string;
  chatter_name: string;
  week_start: string;
  date: string;
  scheduled_shift: string;
  start_time: string | null;
  end_time: string | null;
  /** When status is on_break, ISO string of when this break started (for live timer). */
  break_started_at: string | null;
  break_minutes: number;
  worked_minutes: number | null;
  status: ShiftStatus;
  models_count: number;
  total_minutes: number | null;
  staff_role: StaffRole;
  shift_type: ShiftType;
  task_label: string;
  total_hours_decimal: number | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface ShiftModel {
  id: string;
  shift_model_id: string;
  /** First linked record id from shift (shifts). */
  shift_id: string;
  /** First linked record id from chatter (users). */
  chatter_id: string;
  chatter_name: string;
  /** First linked record id from model (modelss). */
  model_id: string;
  model_name: string;
  entered_at: string | null;
  left_at: string | null;
  status: string;
  session_minutes: number | null;
  notes: string;
  created_at: string;
}

export type CustomRequestType =
  | "video"
  | "photo_set"
  | "voice_note"
  | "rating"
  | "special_request"
  | "other";
export type CustomRequestPriority = "low" | "normal" | "high" | "urgent";
export type CustomRequestStatus =
  | "pending"
  | "accepted"
  | "recording"
  | "completed"
  | "delivered"
  | "cancelled";

export interface CustomRequest {
  id: string;
  request_id: string;
  /** First linked record id from chatter (users). */
  chatter_id: string;
  chatter_name: string;
  /** First linked record id from model (modelss). */
  model_id: string;
  model_name: string;
  /** First linked record id from whale (whales), if any. */
  whale_id: string;
  /** Human-readable whale username snapshot. Prefer for display. */
  whale_username: string;
  /** Human-readable whale name, if different from username. */
  whale_name: string;
  fan_username: string;
  custom_type: CustomRequestType;
  description: string;
  price: string;
  priority: CustomRequestPriority;
  status: CustomRequestStatus;
  created_at: string;
}

export type TransactionCurrency = "usd" | "eur";
/** whale_transactions.type – keep in sync with lib/airtable-options.ts TRANSACTION_TYPES */
export type TransactionType = TransactionTypeOption;

export interface WhaleTransaction {
  id: string;
  transaction_id: string;
  /** First linked record id from whale (whales). */
  whale_id: string;
  whale_username: string;
  /** First linked record id from chatter (users). */
  chatter_id: string;
  chatter_name: string;
  /** First linked record id from model (modelss). */
  model_id: string;
  model_name: string;
  date: string;
  time: string;
  session_length_minutes: number | null;
  amount: number;
  currency: TransactionCurrency;
  type: TransactionType;
  note: string;
  created_at: string;
}

export interface MonthlyTarget {
  id: string;
  target_id: string;
  month_key: string;
  team_member_id: string;
  team_member_name: string;
  role: string;
  target_amount_usd: number;
  is_active: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface UserRecord {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  role: UserRole;
  status: string;
  can_login: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
  /** Only present when loading from DB; never expose to client. */
  password_hash?: string;
}

export interface ActivityLog {
  id: string;
  log_id: string;
  actor_user_id: string;
  actor_name: string;
  action_type: string;
  entity_type: string;
  entity_id: string;
  summary: string;
  details: string;
  created_at: string;
}

export interface StaffTaskType {
  id: string;
  task_type_id: string;
  task_key: string;
  task_label: string;
  applies_to_role: string;
  is_active: boolean;
  sort_order: number;
  description: string;
  created_at: string;
}

/** Day option in weekly_program (single select). Must match Airtable exactly. */
export type WeeklyProgramDay =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday";

/** Standard shift types. Morning 12:00–20:00, Night 20:00–03:00, Custom = user-defined times. */
export type WeeklyProgramShiftType = "Morning" | "Night" | "Custom";

/** One row = one scheduled shift entry. One chatter, one day, one shift type, multiple models. */
export interface WeeklyProgramRecord {
  id: string;
  program_id: string;
  chatter_id: string;
  chatter_name: string;
  /** Linked model IDs (modelss). Multiple models per shift. */
  model_ids: string[];
  day: WeeklyProgramDay;
  shift_type: WeeklyProgramShiftType;
  start_time: string;
  end_time: string;
  week_start: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

/** Status for chatter-submitted weekly availability requests (weekly_availability_requests table). */
export type WeeklyAvailabilityRequestStatus = "submitted" | "reviewed" | "used" | "rejected";

/** Entry type for weekly_availability_requests: availability window or day off (repo). */
export type WeeklyAvailabilityEntryType = "availability" | "day_off";

/** Chatter-submitted availability request for a week (not the final schedule). */
export interface WeeklyAvailabilityRequest {
  id: string;
  request_id: string;
  week_start: string;
  chatter_id: string;
  chatter_name: string;
  day: WeeklyProgramDay;
  entry_type: WeeklyAvailabilityEntryType;
  shift_type: WeeklyProgramShiftType;
  custom_start_time: string;
  custom_end_time: string;
  notes: string;
  status: WeeklyAvailabilityRequestStatus;
  created_at: string;
}

/** Session user (from D1 auth); role must match Airtable users. */
export interface SessionUser {
  id: string;
  email: string;
  role: UserRole;
  airtableUserId: string | null;
  fullName: string | null;
}

// --- Notifications ---

export type NotificationCategory =
  | "shift"
  | "task_shift"
  | "model"
  | "whale"
  | "system"
  | "account";

export type NotificationPriority = "low" | "normal" | "high" | "critical";

export type NotificationEventType =
  | "shift_started"
  | "shift_ended"
  | "break_started"
  | "break_ended"
  | "task_started"
  | "task_finished"
  | "model_became_free"
  | "model_taken"
  | "whale_followup"
  | "whale_spent"
  | "whale_session_submitted"
  | "custom_request_submitted"
  | "custom_status_changed"
  | "system_alert"
  | "account_update";

export interface AppNotification {
  id: string;
  notification_id: string;
  user_id: string;
  category: NotificationCategory;
  event_type: NotificationEventType;
  priority: NotificationPriority;
  title: string;
  body: string;
  entity_type: string;
  entity_id: string;
  read_at: string | null;
  created_at: string;
}

export interface NotificationPreference {
  id: string;
  preference_id: string;
  user_id: string;
  push_enabled: boolean;
  in_app_enabled: boolean;
  critical_only: boolean;
  whale_alerts: boolean;
  shift_alerts: boolean;
  model_alerts: boolean;
  system_alerts: boolean;
  task_alerts: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  mute_all: boolean;
  updated_at: string;
}

export interface PushSubscriptionRecord {
  id: string;
  subscription_id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string;
  /** Role at subscribe time for push click routing. */
  role?: UserRole;
  active: boolean;
  created_at: string;
}
