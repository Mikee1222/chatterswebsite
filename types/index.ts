import type { TransactionTypeOption } from "@/lib/airtable-options";
import type { Permission } from "@/lib/permissions";

/** Role from Airtable users table; auth must match. */
export type UserRole = "admin" | "manager" | "chatter" | "virtual_assistant" | "model" | "client";

/** Alias for permission strings used in RBAC checks. */
export type PermissionKey = Permission;

/** Role-level notification category keys (master toggles in roles UI). */
export type NotificationRoleCategoryKey =
  | "shift"
  | "whale"
  | "model"
  | "system"
  | "task"
  | "mistake"
  | "fine_bonus"
  | "period"
  | "marketing"
  | "phase"
  | "reward"
  | "custom_request_alerts"
  | "billing_alerts"
  | "training_alerts"
  | "schedule_alerts";

/**
 * Role-level notification defaults (stored as JSON on roles table).
 * Category booleans are required; individual event keys are optional overrides.
 */
export type NotificationRoleDefaults = {
  [K in NotificationRoleCategoryKey]: boolean;
} & Partial<Record<NotificationEventType, boolean>>;

/** Airtable `roles` table row. */
export interface RoleRecord {
  id: string;
  role_id: string;
  label: string;
  description: string;
  permissions: Permission[];
  notification_defaults?: NotificationRoleDefaults;
  is_system_role: boolean;
  color: string;
  created_at: string;
  updated_at: string;
}

/** Airtable `users.va_type` — VA specialization (chatting, marketing, or both). */
export type VaType = "chatting" | "marketing" | "both";

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
export type ShiftType = "chatting" | "mistakes" | "vault_cleaning" | "other" | "task" | "va_tasks";

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

/** SOP Library — `sop_departments.color` / `sop_roles.color` single-select options. */
export type SopColor = "blue" | "pink" | "green" | "orange" | "purple" | "gray";

/** SOP Library — `sop_roles.auth_roles` multi-select options. */
export type SopAuthRole =
  | "admin"
  | "manager"
  | "chatter"
  | "virtual_assistant"
  | "model"
  | "client";

/** SOP Library — `sop_functions.cadence_type` single-select options. */
export type CadenceType = "daily" | "weekly" | "monthly";

export type SopDepartment = {
  id: string;
  department_id: string;
  name: string;
  color: SopColor;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
};

export type SopRole = {
  id: string;
  role_id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: SopColor;
  /** Linked `sop_departments` record id (optional). */
  department_id: string;
  auth_roles: SopAuthRole[];
  assigned_user_ids: string[];
  academy_mode: boolean;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
};

export type SopProgress = {
  id: string;
  progress_id: string;
  user_id: string;
  sop_function_id: string;
  sop_role_id: string;
  completed_at: string;
  completed_version: number;
  quiz_score: number | null;
  created_at?: string;
};

/** Admin report: per-user academy progress for one role. */
export type SopProgressUserSummary = {
  user_id: string;
  user_name: string;
  completed_count: number;
  total_functions: number;
  percent: number;
  last_completed_at: string | null;
  completed_function_ids: string[];
  signoff_at: string | null;
  /** Per-function quiz scores when present. */
  quiz_scores: Array<{ function_id: string; score: number }>;
};

export type SopQuizCorrectOption = "a" | "b" | "c" | "d";

export type SopQuizQuestion = {
  id: string;
  question_id: string;
  sop_function_id: string;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: SopQuizCorrectOption;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
};

export type SopQuizAttempt = {
  id: string;
  attempt_id: string;
  user_id: string;
  sop_function_id: string;
  sop_role_id: string;
  score: number;
  passed: boolean;
  wrong_count: number;
  created_at?: string;
};

/** Admin: per-function quiz attempt analytics for one role. */
export type SopQuizFunctionInsight = {
  function_id: string;
  function_name: string;
  total_attempts: number;
  avg_score: number;
  pass_rate: number;
  members_multi_attempt: number;
  is_difficult: boolean;
};

export type SopSignoff = {
  id: string;
  signoff_id: string;
  user_id: string;
  sop_role_id: string;
  signed_at: string;
  statement: string;
  created_at?: string;
};

export type SopAcademyOverviewRoleStats = {
  role_id: string;
  role_name: string;
  role_color: SopColor;
  total_functions: number;
  member_count: number;
  completed_count: number;
  signed_off_count: number;
  in_training_count: number;
  completion_rate: number;
};

export type SopAcademyBehindMember = {
  user_id: string;
  user_name: string;
  role_id: string;
  role_name: string;
  completed_count: number;
  total_functions: number;
  percent: number;
  days_behind: number;
  last_activity_at: string | null;
  signed_off: boolean;
};

export type SopAcademyOverview = {
  total_members: number;
  total_in_training: number;
  total_completed: number;
  total_signed_off: number;
  roles: SopAcademyOverviewRoleStats[];
  behind: SopAcademyBehindMember[];
  chart_by_role: Array<{
    name: string;
    completion_rate: number;
    in_training: number;
    completed: number;
    signed_off: number;
  }>;
  chart_totals: Array<{ name: string; value: number }>;
};

export type SopDepartmentDeleteImpact = {
  roles: number;
  functions: number;
  blocked: boolean;
};

export type SopCascadeDeleteImpact = {
  functions: number;
  progress: number;
  signoffs: number;
  feedback: number;
  quiz_questions: number;
};

export type SopFeedbackHelpful = "yes" | "no";

export type SopFeedback = {
  id: string;
  feedback_id: string;
  user_id: string;
  sop_function_id: string;
  sop_role_id: string;
  helpful: SopFeedbackHelpful;
  comment: string;
  created_at?: string;
};

/** Admin: aggregated helpfulness for one function. */
export type SopFeedbackSummary = {
  function_id: string;
  total: number;
  helpful_yes: number;
  helpful_pct: number;
  comments: Array<{
    comment: string;
    helpful: SopFeedbackHelpful;
    created_at: string;
  }>;
};

/** Home resume banner + deep-link into academy viewer. */
export type SopAcademyResume = {
  role_id: string;
  role_name: string;
  completed_count: number;
  total_functions: number;
  next_function_id: string | null;
};

export type SopCertificationBadge = {
  kind: "role" | "master";
  label: string;
  role_id?: string;
  role_color?: SopColor;
};

export type StandardType = "text" | "file";

export type SopFunction = {
  id: string;
  function_id: string;
  sop_role_id: string;
  name: string;
  department_id: string;
  kpi: string;
  standard_type: StandardType;
  sop_content: string;
  sop_file_url: string;
  sop_file_name: string;
  loom_url: string;
  cadence_type: CadenceType;
  cadence_note: string;
  sort_order: number;
  is_active: boolean;
  content_version: number;
  created_at?: string;
};

export type VaTaskRecord = {
  id: string;
  title: string;
  description: string;
  assigned_to_ids: string[];
  assigned_by_ids: string[];
  /** Comma-separated model record ids in Airtable; parsed to arrays in the app layer. */
  assigned_model_ids: string[];
  assigned_model_names: string[];
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
  /** Who created this whale (name or email); Airtable `created_by` when the column exists. */
  created_by: string;
}

export interface ModelRecord {
  id: string;
  model_id: string;
  /** TheOnlyAPI OF user ID — links this model to the connected OF account. */
  of_user_id?: string;
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
  team: "gunzo_team" | "chatting_agency";
  paypal_email?: string;
  paypal_link?: string;
  revolut_tag?: string;
  payment_notes?: string;
  payment_threshold_eur?: number;
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
  /** Airtable `va_type` when role (or secondary_role) is virtual_assistant. */
  va_type?: VaType | null;
  telegram_username?: string;
  /** Last User-Agent string seen on successful login (for new-device detection). */
  last_login_user_agent?: string;
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
  /** Lookup / rollup names from Airtable when the base exposes them. */
  model_names?: string[];
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
  role: UserRole | (string & {});
  airtableUserId: string | null;
  fullName: string | null;
  secondary_role?: "chatter" | "virtual_assistant" | null;
  active_role?: "chatter" | "virtual_assistant" | null;
  va_type?: import("@/types").VaType | null;
}

// --- Notifications ---
// Categories must match Airtable notifications.category single-select options exactly.
export type NotificationCategory =
  | "shift"
  | "model"
  | "whale"
  | "custom_request"
  | "system"
  | "task"
  | "billing";

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
  | "va_content_scheduled"
  | "va_content_completed"
  | "custom_request_uploaded"
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
  | "challenge_completed"
  | "spin_result"
  // Billing
  | "billing_cycle_announced"
  | "billing_due_reminder"
  | "billing_payment_submitted"
  | "payment_submitted"
  | "payment_confirmed"
  | "payment_rejected"
  | "expense_approved"
  | "expense_rejected"
  // Performance / marketing
  | "chatter_mistake"
  | "chatter_mistake_reviewed"
  | "fine_issued"
  | "bonus_awarded"
  | "fine_bonus_reviewed"
  | "shadowban_report"
  | "shadowban_submitted"
  | "shadowban_resolved"
  | "sop_quiz_passed"
  | "sop_quiz_failed"
  | "schedule_published"
  | "login_new_device"
  | "password_changed"
  // SOP Academy
  | "sop_academy_reminder"
  | "sop_academy_training_complete"
  | "sop_academy_signed_off"
  // Admin monitoring variants (_admin suffix)
  | "shift_started_admin"
  | "shift_ended_admin"
  | "shift_late_admin"
  | "shift_no_show_admin"
  | "shift_overtime_admin"
  | "shift_running_long_admin"
  | "chatter_no_models_admin"
  | "break_started_admin"
  | "break_ended_admin"
  | "break_exceeded_admin"
  | "break_too_long_admin"
  | "task_started_admin"
  | "task_finished_admin"
  | "task_shift_started_admin"
  | "task_shift_ended_admin"
  | "task_completed_admin"
  | "task_overdue_admin"
  | "tasks_not_started_admin"
  | "phase_task_completed_admin"
  | "phase_completed_admin"
  | "phase_overdue_admin"
  | "all_phases_completed_admin"
  | "model_became_free_admin"
  | "model_taken_admin"
  | "model_live_started_admin"
  | "model_live_ended_admin"
  | "model_missed_live_admin"
  | "model_content_completed_admin"
  | "model_content_scheduled_admin"
  | "va_content_assigned_admin"
  | "va_content_scheduled_admin"
  | "va_content_completed_admin"
  | "custom_request_uploaded_admin"
  | "whale_registered_admin"
  | "whale_assigned_admin"
  | "whale_followup_admin"
  | "whale_spent_admin"
  | "whale_session_submitted_admin"
  | "custom_request_created_admin"
  | "custom_request_updated_admin"
  | "custom_request_submitted_admin"
  | "custom_status_changed_admin"
  | "custom_approved_admin"
  | "custom_rejected_admin"
  | "custom_declined_admin"
  | "custom_edited_admin"
  | "custom_uploaded_admin"
  | "custom_scheduled_admin"
  | "custom_deadline_approaching_admin"
  | "custom_overdue_admin"
  | "form_submitted_admin"
  | "schedule_updated_admin"
  | "availability_submitted_admin"
  | "user_created_admin"
  | "points_awarded_admin"
  | "level_up_admin"
  | "challenge_completed_admin"
  | "spin_result_admin"
  | "sop_academy_training_complete_admin"
  | "sop_academy_signed_off_admin"
  | "payment_submitted_admin"
  | "billing_payment_submitted_admin"
  | "expense_approved_admin"
  | "expense_rejected_admin"
  | "chatter_mistake_admin"
  | "chatter_mistake_reviewed_admin"
  | "fine_issued_admin"
  | "bonus_awarded_admin"
  | "fine_bonus_reviewed_admin"
  | "shadowban_report_admin"
  | "shadowban_submitted_admin"
  | "shadowban_resolved_admin"
  | "period_overdue_admin"
  | "billing_cycle_announced_admin"
  | "sop_quiz_passed_admin"
  | "schedule_published_admin";

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
  mistake_alerts: boolean;
  fine_bonus_alerts: boolean;
  period_alerts: boolean;
  marketing_alerts: boolean;
  phase_alerts: boolean;
  reward_alerts: boolean;
  custom_request_alerts: boolean;
  billing_alerts: boolean;
  training_alerts: boolean;
  schedule_alerts: boolean;
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

// --- Link-in-Bio pages ---

export type LinkPageStatus = "draft" | "published" | "archived";
export type LinkPageBackgroundType = "color" | "gradient" | "image";
export type LinkPageTheme = "dark" | "light" | "minimal" | "neon" | "gold";
export type LinkPageFont = "modern" | "elegant" | "bold" | "minimal";
export type LinkPageBlockType =
  | "link"
  | "bio_text"
  | "photo_grid"
  | "countdown"
  | "social_bar"
  | "spacer"
  | "heading";
export type LinkPageBlockStyle = "default" | "prominent" | "subtle" | "pill" | "card";
export type LinkPageAnalyticsEventType = "page_view" | "link_click";
export type LinkPageDeviceType = "mobile" | "desktop" | "tablet";

export interface LinkPageRecord {
  id: string;
  page_id: string;
  model_id: string;
  slug: string;
  status: LinkPageStatus;
  title: string;
  bio: string;
  profile_photo_url: string;
  background_type: LinkPageBackgroundType;
  background_value: string;
  theme: LinkPageTheme;
  primary_color: string;
  accent_color: string;
  font: LinkPageFont;
  custom_domain: string;
  show_powered_by: boolean;
  meta_description: string;
  created_at: string;
  updated_at: string;
}

export interface LinkPageBlockRecord {
  id: string;
  block_id: string;
  page_id: string;
  block_type: LinkPageBlockType;
  sort_order: number;
  is_visible: boolean;
  label: string;
  url: string;
  icon: string;
  sublabel: string;
  style: LinkPageBlockStyle;
  photo_urls: string[];
  countdown_target: string | null;
  heading_text: string;
  created_at: string;
  updated_at: string;
}

export interface LinkPageAnalyticsRecord {
  id: string;
  event_id: string;
  page_id: string;
  block_id: string;
  event_type: LinkPageAnalyticsEventType;
  ip_address: string;
  country: string;
  city: string;
  region: string;
  device_type: LinkPageDeviceType;
  browser: string;
  os: string;
  referrer: string;
  user_agent: string;
  session_id: string;
  timestamp: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
}

export interface AnalyticsSummary {
  pageViews: number;
  linkClicks: number;
  uniqueVisitors: number;
  topLinks: Array<{ block_id: string; label: string; clicks: number }>;
  viewsByDay: Array<{ date: string; views: number; clicks: number }>;
  deviceBreakdown: Array<{ device: string; count: number }>;
  countryBreakdown: Array<{ country: string; count: number }>;
  referrerBreakdown: Array<{ referrer: string; count: number }>;
}

export interface GlobalAnalyticsSummary {
  totalPageViews: number;
  totalLinkClicks: number;
  totalUniqueVisitors: number;
  viewsByDayByPage: Array<{ date: string; pages: Record<string, number> }>;
  leaderboard: Array<{ page_id: string; title: string; slug: string; views: number; clicks: number }>;
  deviceBreakdown: Array<{ device: string; count: number }>;
  pageBreakdown: Array<{ page_id: string; title: string; views: number }>;
}

export interface LinkPageWithBlocks extends LinkPageRecord {
  blocks: LinkPageBlockRecord[];
}
