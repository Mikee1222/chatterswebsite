import type { TransactionTypeOption } from "@/lib/airtable-options";

/** Role from Airtable users table; auth must match. */
export type UserRole = "admin" | "manager" | "chatter" | "virtual_assistant" | "model";

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
  | "Interested"
  | "Simp";
export type SpendLevel = "low" | "medium" | "high" | "vip" | "whale";
export type Platform = "onlyfans" | "fanvue" | "other";
export type ShiftStatus = "active" | "on_break" | "completed" | "cancelled";
export type StaffRole = "chatter" | "virtual_assistant";
export type ShiftType = "chatting" | "mistakes" | "vault_cleaning" | "other";

/** Airtable `shift_queue` — chatter waits for an active shift to end, then auto-starts. */
export type ShiftQueueStatus = "waiting" | "started" | "cancelled" | "expired";

/** `shift_queue.queue_type` — full new shift vs attach models to existing shift when freed. */
export type ShiftQueueType = "full_start" | "add_models";

export type ShiftQueueEntryApi = {
  id: string;
  queue_id: string;
  chatter_id: string;
  chatter_name: string;
  selected_model_ids: string[];
  selected_model_names: string[];
  status: ShiftQueueStatus;
  waiting_for_shift_id: string;
  waiting_for_chatter_name: string;
  /** Defaults to `full_start` when column missing (legacy rows). */
  queue_type: ShiftQueueType;
  /** For `add_models`: Airtable record id of the chatter's shift to attach models to. */
  target_shift_id: string;
  created_at: string | null;
  started_at: string | null;
  cancelled_at: string | null;
};

/** Occupied model row for shift page — which shift holds the model (queue picker + add-models flow). */
export type OccupiedModelDetail = {
  /** `modelss` record id (same as `ModelRecord.id`). */
  model_id: string;
  model_name: string;
  chatter_name: string;
  shift_id: string;
};

/** Active chatter shift summary for queue UI / APIs. */
export type ActiveShiftBrief = {
  id: string;
  chatter_name: string;
  duration_minutes: number;
};

/** Admin live-shifts: waiting queue row. */
export type AdminShiftQueueRow = {
  id: string;
  chatter_name: string;
  waitingForChatterName: string;
  waiting_for_shift_id: string;
  selectedModelNames: string[];
  queue_type?: ShiftQueueType;
};

/** Airtable `va_tasks` — VA operational tasks. */
export type VaTaskStatus = "pending" | "in_progress" | "done" | "skipped";
export type VaTaskPriority = "low" | "normal" | "high" | "urgent";
export type VaRecurrenceType = "daily" | "weekly" | "monthly" | "custom";
export type VaRecurrenceDay =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday";

export type VaTaskRecord = {
  id: string;
  title: string;
  description: string;
  assigned_to_ids: string[];
  assigned_by_ids: string[];
  status: VaTaskStatus;
  priority: VaTaskPriority;
  due_date: string | null;
  is_recurring: boolean;
  recurrence_type: VaRecurrenceType | "";
  recurrence_days: VaRecurrenceDay[];
  recurrence_interval: number | null;
  recurrence_end_date: string | null;
  reminder_minutes_before: number | null;
  completed_at: string | null;
  completed_notes: string;
  overdue_notified_at: string | null;
  created_at: string | null;
};

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
  /** Rolling average cycle length (days) from period history on modelss. */
  avg_cycle_length?: number | null;
  /** Rolling average period length (days) from logged periods. */
  avg_period_length?: number | null;
  period_notes?: string;
  /** When true, model sees period tracking tools (e.g. Settings). Checkbox on modelss. */
  period_tracking_enabled?: boolean | null;
}

/** Logged period row in Airtable table model_periods. */
export interface ModelPeriodRecord {
  id: string;
  model_id: string;
  start_date: string;
  end_date: string;
  cycle_length_days: number | null;
  period_length_days: number | null;
  notes: string;
  logged_by: string;
  created_at: string | null;
  came_early?: boolean;
  missed_period?: boolean;
  predicted_next_date?: string | null;
  /** Per-row flag from Airtable when present; UI guard prefers modelss.period_tracking_enabled. */
  tracking_enabled?: boolean;
  /** Present when {@link getCurrentPeriod} derives an active bleed window from the latest start + avg period length. */
  day_number?: number | null;
}

export type PeriodLoggedBy = "model" | "admin" | "va";

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
  /** When set, cron sends a push after this ISO time (then clears the field). */
  break_reminder_at: string | null;
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

/** custom_requests.admin_status (single-select). */
export type CustomRequestAdminStatus = "pending" | "accepted" | "rejected";
/** custom_requests.model_status (single-select). Add `uploaded` as an Airtable choice if writes fail. */
export type CustomRequestModelStatus =
  | "waiting_schedule"
  | "scheduled"
  | "in_progress"
  | "completed"
  | "uploaded"
  | "declined";

export interface CustomRequest {
  id: string;
  request_id: string;
  fan_username: string;
  /** requested_by_chatter link → users */
  requested_by_chatter_id: string;
  requested_by_chatter_name?: string;
  /** Optional `custom_requests.assigned_va` — singleLineText or legacy link → users (VA airtable record id). */
  assigned_va_id?: string;
  /** assigned_model link → modelss */
  assigned_model_id: string;
  assigned_model_name?: string;
  request_title: string;
  request_details: string;
  price: string;
  deadline_requested: string | null;
  admin_status: CustomRequestAdminStatus;
  model_status: CustomRequestModelStatus;
  model_scheduled_date: string | null;
  model_scheduled_start: string | null;
  model_scheduled_end: string | null;
  admin_notes: string;
  model_notes: string;
  /** Airtable `custom_requests.decline_reason` when admin rejects. */
  decline_reason?: string;
  /** linked_schedule_item link → model_schedule */
  linked_schedule_item_id: string | null;
  /** When the model marked the custom as uploaded (Airtable dateTime). */
  uploaded_at: string | null;
  uploaded_by_model?: boolean;
  created_at: string;
  updated_at: string;
  /** Legacy/compat: same as request_title or request_details. */
  custom_type?: CustomRequestType;
  description?: string;
  priority?: CustomRequestPriority;
  status?: CustomRequestStatus;
  /** Legacy: same as requested_by_chatter_id. */
  chatter_id?: string;
  chatter_name?: string;
  model_id?: string;
  model_name?: string;
  whale_username?: string;
  whale_name?: string;
  whale_id?: string;
}

/** model_schedule.item_type (single-select). */
export type ModelScheduleItemType =
  | "script"
  | "mass_message"
  | "live_stream"
  | "custom"
  | "content_shoot"
  | "promo"
  | "meeting"
  | "rest"
  | "time_off"
  | "other";

export interface ModelScheduleItem {
  id: string;
  /** Link to modelss */
  model_id: string;
  title: string;
  item_type: ModelScheduleItemType;
  date: string;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  priority: string;
  status: string;
  details: string;
  details_en: string | null;
  details_es: string | null;
  instructions: string;
  instructions_en: string | null;
  instructions_es: string | null;
  linked_custom_request_id: string | null;
  created_at: string;
  updated_at: string;
}

/** model_tasks status / type. */
export type ModelTaskStatus = "pending" | "done" | "skipped" | "blocked";
export type ModelTaskType = string;

export interface ModelTaskRecord {
  id: string;
  /** Link to modelss */
  model_id: string;
  title: string;
  type: ModelTaskType;
  required: boolean;
  status: ModelTaskStatus;
  description: string;
  description_en: string | null;
  description_es: string | null;
  linked_schedule_item_id: string | null;
  completion_notes: string | null;
  /** Airtable `date` (calendar / due day), YYYY-MM-DD when parseable */
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

/** `va_content_assignments` row (VA → model content). */
export interface VaContentAssignmentRecord {
  id: string;
  assignment_id: string;
  model_id: string;
  va_id: string | null;
  title: string;
  description: string;
  content_type: string;
  file_url: string | null;
  file_attachment: { id?: string; url?: string; filename?: string; size?: number; type?: string }[];
  deadline: string | null;
  scheduled_date: string | null;
  status: string;
  priority: string;
  model_notes: string;
  va_notes: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  rejection_reason: string;
  admin_edit_notes: string;
  reviewed_by: string;
  reviewed_at: string | null;
}

/** Serializable row for model VA content UI (no internal notes). */
export type ModelContentAssignmentCardDTO = {
  id: string;
  title: string;
  description: string;
  deadline: string | null;
  scheduled_date: string | null;
  completed_at: string | null;
  file_url: string | null;
  file_attachment: { url?: string; filename?: string }[];
  priority: string;
  status: string;
  va_name: string | null;
  content_type: string;
};

export interface ModelLiveStreamRecord {
  id: string;
  /** Link to modelss */
  model_id: string;
  date: string;
  planned_start: string | null;
  planned_end: string | null;
  /** When live actually started (ISO). */
  actual_start: string | null;
  /** When live actually ended (ISO). */
  actual_end: string | null;
  platform: string;
  status: string;
  details: string;
  details_en: string | null;
  details_es: string | null;
  created_at: string;
  updated_at: string;
}

/** weekly_availability_requests_models entry_type. */
export type ModelAvailabilityEntryType = "availability" | "day_off" | "live_window" | "custom_window";

/** Parsed from `availability_windows` JSON (+ legacy start/end). HH:mm strings. */
export type ModelAvailabilityTimeWindow = { start: string; end: string };

export interface ModelWeeklyAvailabilityRequest {
  id: string;
  request_id: string;
  week_start: string;
  /** Link to modelss */
  model_id: string;
  model_name: string;
  day: WeeklyProgramDay;
  entry_type: ModelAvailabilityEntryType;
  start_time: string | null;
  end_time: string | null;
  /** Resolved time windows for this row (same day). */
  time_windows: ModelAvailabilityTimeWindow[];
  notes: string;
  status: WeeklyAvailabilityRequestStatus;
  created_at: string;
}

/** `model_time_off_requests` — model-requested blackout dates. */
export interface ModelTimeOffRequest {
  id: string;
  request_id: string;
  model_id: string;
  model_name: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
  created_at: string;
}

export type ModelContentRequestType = "script" | "mass" | "photo_set" | "video" | "other";
export type ModelContentRequestStatus = "pending" | "approved" | "rejected" | "in_progress" | "completed";

export interface ModelContentRequest {
  id: string;
  request_id: string;
  model_id: string;
  model_user_id: string;
  type: ModelContentRequestType;
  title: string;
  description: string;
  status: ModelContentRequestStatus;
  admin_notes: string;
  created_at: string;
  updated_at: string;
}

export type ModelExpenseRequestType = "airbnb" | "other";
export type ModelExpenseRequestStatus = "pending" | "approved" | "rejected";

export interface ModelExpenseRequest {
  id: string;
  request_id: string;
  model_id: string;
  model_user_id: string;
  va_content_assignment_id: string;
  assignment_title: string;
  type: ModelExpenseRequestType;
  airbnb_link: string;
  notes: string;
  status: ModelExpenseRequestStatus;
  admin_notes: string;
  created_at: string;
  updated_at: string;
}

export type ModelPersonalEventType = "nails" | "lashes" | "hairdresser" | "surgery" | "fillers" | "custom";

export interface ModelPersonalEvent {
  id: string;
  event_id: string;
  model_id: string;
  model_user_id: string;
  event_type: ModelPersonalEventType;
  custom_label: string;
  event_date: string;
  event_time: string | null;
  notes: string;
  created_at: string;
  reminder_sent: boolean;
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
  /** When role=model: Airtable record id of linked modelss row. */
  linked_model_id?: string;
  /** When role=model: preferred language (e.g. "en", "es") for model-facing UI. */
  language_preference?: string;
  /** Only present when loading from DB; never expose to client. */
  password_hash?: string;
  /** Airtable `secondary_role`: chatter or va (mapped to virtual_assistant in app). */
  secondary_role?: "chatter" | "virtual_assistant" | null;
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
  secondary_role?: "chatter" | "virtual_assistant" | null;
  active_role?: "chatter" | "virtual_assistant" | null;
}

// --- Notifications ---
// Categories must match Airtable notifications.category single-select options exactly.
export type NotificationCategory =
  | "shift"
  | "model"
  | "whale"
  | "custom_request"
  | "system"
  | "task";

export type NotificationPriority = "low" | "normal" | "high" | "critical";

// Event types (operational intelligence). Many map to Airtable single-select via EVENT_TYPE_TO_AIRTABLE.
export type NotificationEventType =
  // Shift
  | "shift_started"
  | "shift_ended"
  | "shift_late"
  | "shift_no_show"
  | "shift_overtime"
  | "shift_running_long"
  | "shift_starting_soon"
  | "chatter_no_models"
  // Break
  | "break_started"
  | "break_ended"
  | "break_exceeded"
  | "break_too_long"
  // Model / live
  | "model_became_free"
  | "model_taken"
  | "model_live_started"
  | "model_live_ended"
  | "model_live_scheduled"
  | "model_missed_live"
  | "model_content_completed"
  | "model_content_scheduled"
  | "va_content_assigned"
  | "period_3_day_reminder"
  | "period_predicted_day"
  | "period_confirmed_early"
  | "period_overdue"
  | "period_prediction_reset"
  // Task
  | "task_shift_started"
  | "task_shift_ended"
  | "task_started"
  | "task_finished"
  | "task_completed"
  | "task_overdue"
  | "tasks_not_started"
  | "va_task_reminder"
  | "phase_task_completed"
  | "phase_completed"
  | "phase_overdue"
  | "all_phases_completed"
  // Custom
  | "custom_request_created"
  | "custom_request_updated"
  | "custom_request_submitted"
  | "custom_status_changed"
  | "custom_approved"
  | "custom_rejected"
  | "custom_declined"
  | "custom_edited"
  | "custom_uploaded"
  | "custom_scheduled"
  | "custom_deadline_approaching"
  | "custom_overdue"
  // Form / schedule
  | "form_submitted"
  | "schedule_updated"
  | "weekly_availability_friday_reminder"
  | "availability_submitted"
  // Whale / revenue
  | "whale_registered"
  | "whale_assigned"
  | "whale_followup"
  | "whale_spent"
  | "whale_session_submitted"
  // System
  | "system_alert"
  | "account_update"
  | "user_created"
  | "role_changed"
  | "account_deleted"
  | "daily_summary"
  // Rewards
  | "points_awarded"
  | "level_up"
  | "spin_available"
  | "challenge_completed";

/** Optional structured metadata for richer display (e.g. models, shift type, deadline). */
export type NotificationMetadataItem = { label: string; value: string };

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
  /** Optional structured metadata for chips / metadata line (when provided by backend). */
  metadata?: NotificationMetadataItem[];
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
