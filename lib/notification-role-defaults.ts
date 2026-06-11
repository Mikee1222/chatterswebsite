import type {
  NotificationEventType,
  NotificationPreference,
  NotificationRoleCategoryKey,
  NotificationRoleDefaults,
  UserRole,
} from "@/types";

export type { NotificationRoleDefaults, NotificationRoleCategoryKey };

export const NOTIFICATION_ROLE_DEFAULT_KEYS = [
  "shift",
  "whale",
  "model",
  "system",
  "task",
  "mistake",
  "fine_bonus",
  "period",
  "marketing",
  "phase",
  "reward",
  "custom_request_alerts",
  "billing_alerts",
  "training_alerts",
  "schedule_alerts",
] as const satisfies readonly NotificationRoleCategoryKey[];

/** English + Greek labels for notification preference categories. */
export const NOTIFICATION_CATEGORY_LABELS: Record<
  NotificationRoleCategoryKey,
  { en: string; el: string }
> = {
  shift: { en: "Shift alerts", el: "Ειδοποιήσεις για βάρδιες, καθυστερήσεις και απουσίες." },
  task: { en: "Task alerts", el: "Ειδοποιήσεις για εργασίες VA και υπενθυμίσεις." },
  phase: { en: "Phase alerts", el: "Ειδοποιήσεις για φάσεις onboarding και προόδου." },
  model: { en: "Model alerts", el: "Ειδοποιήσεις για μοντέλα, live και διαθεσιμότητα." },
  period: { en: "Period alerts", el: "Ειδοποιήσεις για περίοδο και σχετικές υπενθυμίσεις." },
  whale: { en: "Whale alerts", el: "Ειδοποιήσεις για whales, ανάθεση και δραστηριότητα." },
  mistake: { en: "Mistake alerts", el: "Ειδοποιήσεις για λάθη και διορθωτικές ενέργειες." },
  fine_bonus: { en: "Fine/bonus alerts", el: "Ειδοποιήσεις για πρόστιμα, μπόνους και οικονομικές κινήσεις." },
  reward: { en: "Reward alerts", el: "Ειδοποιήσεις για πόντους, επιπέδα και ανταμοιβές." },
  marketing: { en: "Marketing alerts", el: "Ειδοποιήσεις για marketing, shadowban και social." },
  system: { en: "System alerts", el: "Γενικές ειδοποιήσεις συστήματος και λογαριασμού." },
  custom_request_alerts: { en: "Custom requests", el: "Ειδοποιήσεις για custom requests, έγκριση και παράδοση." },
  billing_alerts: { en: "Billing & payments", el: "Ειδοποιήσεις για τιμολόγηση, πληρωμές και έξοδα." },
  training_alerts: { en: "Training & SOPs", el: "Ειδοποιήσεις για εκπαίδευση SOP Academy." },
  schedule_alerts: { en: "Schedule & availability", el: "Ειδοποιήσεις για πρόγραμμα και διαθεσιμότητα." },
};

export type NotificationScope = "personal" | "monitoring" | "both";

export type NotificationEventEntry = {
  key: string;
  label: string;
  note?: string;
  scope: NotificationScope;
};

/** @deprecated Legacy string entries — all events use NotificationEventEntry objects now. */
export type NotificationCategoryEventEntry = NotificationEventEntry;

function eventEntry(
  key: string,
  label: string,
  scope: NotificationScope,
  note?: string
): NotificationEventEntry {
  return note ? { key, label, scope, note } : { key, label, scope };
}

/** Parse event key from entries. */
export function parseEventKeyFromEntry(entry: NotificationCategoryEventEntry): string {
  return entry.key;
}

/** Parse human label from entries. */
export function parseEventLabelFromEntry(entry: NotificationCategoryEventEntry): string {
  return entry.label;
}

/** Optional admin note (entity-only pseudo-events). */
export function parseEventNoteFromEntry(entry: NotificationCategoryEventEntry): string {
  return entry.note?.trim() ?? "";
}

/** Scope: personal (assigned user), monitoring (admins), or both. */
export function parseEventScopeFromEntry(entry: NotificationCategoryEventEntry): NotificationScope {
  return entry.scope;
}

/** Parse description (alias for label on object entries). */
export function parseEventDescriptionFromEntry(entry: NotificationCategoryEventEntry): string {
  return entry.label;
}

export const NOTIFICATION_SCOPE_LABELS: Record<
  NotificationScope,
  { badge: string; className: string }
> = {
  personal: { badge: "Personal", className: "bg-blue-500/20 text-blue-200 border-blue-400/30" },
  monitoring: { badge: "Monitor", className: "bg-amber-500/20 text-amber-200 border-amber-400/30" },
  both: { badge: "Both", className: "bg-purple-500/20 text-purple-200 border-purple-400/30" },
};

export function isNotificationRoleCategoryKey(key: string): key is NotificationRoleCategoryKey {
  return (NOTIFICATION_ROLE_DEFAULT_KEYS as readonly string[]).includes(key);
}

/**
 * Human-readable event lists per notification preference category (role default keys).
 * Each entry: "event_type — short description". Used in Admin → Roles → Notifications tab.
 */
export const NOTIFICATION_CATEGORY_EVENTS: Record<
  NotificationRoleCategoryKey,
  readonly NotificationEventEntry[]
> = {
  shift: [
    eventEntry("shift_started", "Chatter/VA starts a shift", "monitoring"),
    eventEntry("shift_ended", "Chatter/VA ends a shift", "monitoring"),
    eventEntry("shift_late", "Late for a scheduled shift", "personal"),
    eventEntry("shift_no_show", "No-show on scheduled shift", "monitoring"),
    eventEntry("shift_overtime", "Shift overtime alert", "monitoring"),
    eventEntry("shift_running_long", "Shift running longer than expected", "monitoring"),
    eventEntry("shift_starting_soon", "Reminder before shift starts", "personal"),
    eventEntry("chatter_no_models", "Chatter on shift with no models", "monitoring"),
    eventEntry("break_started", "Break started", "monitoring"),
    eventEntry("break_ended", "Break ended", "monitoring"),
    eventEntry("break_exceeded", "Break over 45 minutes", "personal"),
    eventEntry("break_too_long", "Break duration limit exceeded", "personal"),
  ],
  task: [
    eventEntry("task_started", "VA starts a task shift", "monitoring"),
    eventEntry("task_finished", "VA ends a task shift", "monitoring"),
    eventEntry("task_completed", "VA completes an assigned task", "both"),
    eventEntry("task_overdue", "VA task past due date", "both"),
    eventEntry("tasks_not_started", "Tasks not started on schedule", "monitoring"),
    eventEntry("va_task_reminder", "Reminder before VA task due", "personal"),
    eventEntry("model_content_scheduled", "Model schedules content assignment", "both"),
    eventEntry("model_content_completed", "Model marks content complete", "both"),
    eventEntry("va_content_assigned", "VA receives a content assignment", "personal"),
    eventEntry("va_content_scheduled", "VA content delivery scheduled", "personal"),
    eventEntry("va_content_completed", "VA content marked complete", "both"),
    eventEntry("custom_request_uploaded", "Custom request file uploaded", "both"),
  ],
  phase: [
    eventEntry("phase_task_completed", "VA completes a phase checklist item", "monitoring"),
    eventEntry("phase_completed", "VA completes all items in a phase", "both"),
    eventEntry("phase_overdue", "VA phase missed deadline", "both"),
    eventEntry("all_phases_completed", "All phases done for a VA task", "both"),
  ],
  model: [
    eventEntry("model_became_free", "Model becomes available on floor", "monitoring"),
    eventEntry("model_taken", "Chatter enters a model session", "monitoring"),
    eventEntry("model_live_started", "Model goes live", "both"),
    eventEntry("model_live_ended", "Model live stream ended", "both"),
    eventEntry("model_live_scheduled", "Upcoming live stream reminder", "personal"),
    eventEntry("model_missed_live", "Model missed scheduled live", "monitoring"),
  ],
  period: [
    eventEntry("period_3_day_reminder", "Period expected in ~3 days", "personal"),
    eventEntry("period_predicted_day", "Predicted period start today", "personal"),
    eventEntry("period_confirmed_early", "Period logged earlier than predicted", "personal"),
    eventEntry("period_overdue", "Period logging overdue", "personal"),
    eventEntry("period_prediction_reset", "Period prediction reset", "personal"),
  ],
  whale: [
    eventEntry("whale_registered", "New whale registered", "monitoring"),
    eventEntry("whale_assigned", "Whale assigned to chatter or model", "personal"),
    eventEntry("whale_spent", "Whale spending logged", "monitoring"),
    eventEntry("whale_followup", "Whale follow-up due", "personal"),
    eventEntry("whale_session_submitted", "Chatter logs a whale session", "monitoring"),
  ],
  mistake: [
    eventEntry(
      "chatter_mistake",
      "Mistake logged or updated",
      "personal",
      "Entity-gated: uses chatter_mistake entity_type; event_type is chatter_mistake on approve/reject."
    ),
  ],
  fine_bonus: [
    eventEntry(
      "fine_bonus",
      "Fine or bonus submitted or reviewed",
      "personal",
      "Entity-gated only — no standalone event_type; preference follows fine_bonus entity_type."
    ),
  ],
  reward: [
    eventEntry("points_awarded", "Points earned", "personal"),
    eventEntry("level_up", "Rewards tier level up", "personal"),
    eventEntry("spin_available", "Spin wheel credit available", "personal"),
    eventEntry("challenge_completed", "Live challenge completed", "personal"),
  ],
  marketing: [
    eventEntry(
      "shadowban_report",
      "Shadowban report submitted or reviewed",
      "both",
      "Entity-gated: event_type shadowban_report on review; entity_type shadowban_report."
    ),
  ],
  custom_request_alerts: [
    eventEntry("custom_request_created", "New custom request submitted", "both"),
    eventEntry("custom_request_submitted", "Custom request sent to agency", "both"),
    eventEntry("custom_request_updated", "Custom request details updated", "both"),
    eventEntry("custom_status_changed", "Custom request status changed", "both"),
    eventEntry("custom_approved", "Custom request approved by agency", "both"),
    eventEntry("custom_rejected", "Custom request rejected", "both"),
    eventEntry("custom_declined", "Custom request declined by agency", "both"),
    eventEntry("custom_edited", "Custom request terms edited", "both"),
    eventEntry("custom_uploaded", "Custom content uploaded", "both"),
    eventEntry("custom_scheduled", "Custom delivery scheduled", "both"),
    eventEntry("custom_deadline_approaching", "Custom deadline in 48h", "both"),
    eventEntry("custom_overdue", "Custom request past deadline", "both"),
  ],
  billing_alerts: [
    eventEntry("billing_cycle_announced", "Client billing cycle announced", "monitoring"),
    eventEntry("billing_due_reminder", "Client payment due reminder", "monitoring"),
    eventEntry("payment_submitted", "Client payment proof submitted", "monitoring"),
    eventEntry("payment_confirmed", "Client payment confirmed", "monitoring"),
    eventEntry("payment_rejected", "Client payment rejected", "monitoring"),
    eventEntry("expense_approved", "Expense request approved", "monitoring"),
    eventEntry("expense_rejected", "Expense request declined", "monitoring"),
  ],
  training_alerts: [
    eventEntry("sop_academy_reminder", "SOP Academy training reminder", "personal"),
    eventEntry("sop_academy_training_complete", "SOP Academy training complete", "both"),
    eventEntry("sop_academy_signed_off", "SOP Academy sign-off", "both"),
  ],
  schedule_alerts: [
    eventEntry("schedule_updated", "Weekly schedule updated", "personal"),
    eventEntry("weekly_availability_friday_reminder", "Friday availability reminder", "personal"),
    eventEntry("availability_submitted", "Availability submitted", "monitoring"),
  ],
  system: [
    eventEntry("system_alert", "General system message", "both"),
    eventEntry("user_created", "New user account created", "monitoring"),
    eventEntry("role_changed", "User role changed", "personal"),
    eventEntry("account_deleted", "Account deleted", "monitoring"),
    eventEntry("account_update", "Account settings changed", "personal"),
    eventEntry("daily_summary", "Daily operations summary", "monitoring"),
    eventEntry("form_submitted", "Form submitted", "monitoring"),
  ],
};

/** Roles that receive personal/both events by default (non-admin assigned party). */
export const EVENT_TARGET_ROLES: Partial<Record<string, readonly UserRole[]>> = {
  shift_late: ["chatter", "virtual_assistant"],
  shift_starting_soon: ["chatter", "virtual_assistant"],
  break_exceeded: ["chatter"],
  break_too_long: ["chatter"],
  va_task_reminder: ["virtual_assistant"],
  va_content_assigned: ["model"],
  va_content_scheduled: ["virtual_assistant"],
  va_content_completed: ["virtual_assistant"],
  model_content_scheduled: ["model", "virtual_assistant"],
  model_content_completed: ["model", "virtual_assistant"],
  task_completed: ["virtual_assistant"],
  task_overdue: ["virtual_assistant"],
  custom_request_uploaded: ["chatter", "model", "virtual_assistant"],
  custom_request_created: ["chatter", "model", "virtual_assistant"],
  custom_request_submitted: ["chatter", "model", "virtual_assistant"],
  custom_request_updated: ["chatter", "model", "virtual_assistant"],
  custom_status_changed: ["chatter", "model", "virtual_assistant"],
  custom_approved: ["chatter", "model", "virtual_assistant"],
  custom_rejected: ["chatter", "model", "virtual_assistant"],
  custom_declined: ["chatter", "model", "virtual_assistant"],
  custom_edited: ["chatter", "model", "virtual_assistant"],
  custom_uploaded: ["chatter", "model", "virtual_assistant"],
  custom_scheduled: ["chatter", "model", "virtual_assistant"],
  custom_deadline_approaching: ["chatter", "model", "virtual_assistant"],
  custom_overdue: ["chatter", "model", "virtual_assistant"],
  phase_completed: ["virtual_assistant"],
  phase_overdue: ["virtual_assistant"],
  all_phases_completed: ["virtual_assistant"],
  model_live_started: ["chatter"],
  model_live_ended: ["chatter"],
  model_live_scheduled: ["model"],
  period_3_day_reminder: ["model"],
  period_predicted_day: ["model"],
  period_confirmed_early: ["model"],
  period_overdue: ["model"],
  period_prediction_reset: ["model"],
  whale_assigned: ["chatter"],
  whale_followup: ["chatter"],
  chatter_mistake: ["chatter"],
  fine_bonus: ["chatter"],
  points_awarded: ["chatter"],
  level_up: ["chatter"],
  spin_available: ["chatter"],
  challenge_completed: ["chatter"],
  shadowban_report: ["chatter", "virtual_assistant", "model"],
  billing_cycle_announced: ["client"],
  billing_due_reminder: ["client"],
  payment_confirmed: ["client"],
  payment_rejected: ["client"],
  expense_approved: ["model"],
  expense_rejected: ["model"],
  sop_academy_reminder: ["chatter", "virtual_assistant"],
  sop_academy_training_complete: ["chatter", "virtual_assistant"],
  sop_academy_signed_off: ["chatter", "virtual_assistant"],
  schedule_updated: ["chatter", "virtual_assistant"],
  weekly_availability_friday_reminder: ["chatter", "virtual_assistant"],
  role_changed: ["admin", "manager", "chatter", "virtual_assistant", "model", "client"],
  account_update: ["admin", "manager", "chatter", "virtual_assistant", "model", "client"],
  system_alert: ["admin", "manager", "chatter", "virtual_assistant", "model", "client"],
};

function isAdminRole(role: UserRole): boolean {
  return role === "admin" || role === "manager";
}

/** Derive per-event default from scope and target role. */
export function deriveEventDefaultForRole(
  scope: NotificationScope,
  role: UserRole,
  eventKey: string
): boolean {
  const targets = EVENT_TARGET_ROLES[eventKey];
  const isTarget = targets?.includes(role) ?? false;
  switch (scope) {
    case "monitoring":
      return isAdminRole(role) || isTarget;
    case "personal":
      return isTarget;
    case "both":
      return isAdminRole(role) || isTarget;
  }
}

function buildScopedRoleDefaults(role: UserRole): NotificationRoleDefaults {
  const categories = {} as Record<NotificationRoleCategoryKey, boolean>;
  const result = {} as NotificationRoleDefaults;

  for (const catKey of NOTIFICATION_ROLE_DEFAULT_KEYS) {
    let catOn = false;
    for (const entry of NOTIFICATION_CATEGORY_EVENTS[catKey]) {
      const eventKey = parseEventKeyFromEntry(entry);
      const scope = parseEventScopeFromEntry(entry);
      const eventOn = deriveEventDefaultForRole(scope, role, eventKey);
      (result as Record<string, boolean>)[eventKey] = eventOn;
      if (eventOn) catOn = true;
    }
    categories[catKey] = catOn;
    result[catKey] = catOn;
  }

  return result;
}

/** Built-in defaults per system role slug (lowercase), derived from event scope. */
export const DEFAULT_NOTIFICATION_DEFAULTS: Record<UserRole, NotificationRoleDefaults> = {
  admin: buildScopedRoleDefaults("admin"),
  manager: buildScopedRoleDefaults("manager"),
  chatter: buildScopedRoleDefaults("chatter"),
  virtual_assistant: buildScopedRoleDefaults("virtual_assistant"),
  model: buildScopedRoleDefaults("model"),
  client: buildScopedRoleDefaults("client"),
};

export function getBuiltInNotificationDefaults(roleName: string): NotificationRoleDefaults | null {
  const key = roleName.trim().toLowerCase();
  if (key in DEFAULT_NOTIFICATION_DEFAULTS) {
    return normalizeNotificationDefaults({ ...DEFAULT_NOTIFICATION_DEFAULTS[key as UserRole] });
  }
  return null;
}

export function getFallbackNotificationDefaults(roleName: string): NotificationRoleDefaults {
  return normalizeNotificationDefaults(
    getBuiltInNotificationDefaults(roleName) ?? buildScopedRoleDefaults("admin")
  );
}

/** Fill missing event keys from their category master toggle. */
export function normalizeNotificationDefaults(
  raw: NotificationRoleDefaults
): NotificationRoleDefaults {
  const result = { ...raw } as NotificationRoleDefaults;
  for (const catKey of NOTIFICATION_ROLE_DEFAULT_KEYS) {
    if (typeof result[catKey] !== "boolean") {
      result[catKey] = false;
    }
    const catOn = result[catKey];
    for (const entry of NOTIFICATION_CATEGORY_EVENTS[catKey]) {
      const eventKey = parseEventKeyFromEntry(entry);
      if ((result as Record<string, boolean | undefined>)[eventKey] === undefined) {
        (result as Record<string, boolean>)[eventKey] = catOn;
      }
    }
  }
  return result;
}

export function parseNotificationDefaultsJson(raw: unknown): NotificationRoleDefaults | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    const obj = parsed as Record<string, unknown>;
    const result = {} as NotificationRoleDefaults;
    for (const key of NOTIFICATION_ROLE_DEFAULT_KEYS) {
      if (typeof obj[key] !== "boolean") return null;
      result[key] = obj[key];
    }
    for (const [key, value] of Object.entries(obj)) {
      if (isNotificationRoleCategoryKey(key)) continue;
      if (typeof value === "boolean") {
        (result as Record<string, boolean>)[key] = value;
      }
    }
    return normalizeNotificationDefaults(result);
  } catch {
    return null;
  }
}

export function getEventDefaultValue(
  defaults: NotificationRoleDefaults,
  categoryKey: NotificationRoleCategoryKey,
  eventKey: string
): boolean {
  const explicit = (defaults as Record<string, boolean | undefined>)[eventKey];
  if (typeof explicit === "boolean") return explicit;
  return defaults[categoryKey];
}

export function notificationDefaultsToPreferenceFields(
  defaults: NotificationRoleDefaults
): Pick<
  NotificationPreference,
  | "shift_alerts"
  | "whale_alerts"
  | "model_alerts"
  | "system_alerts"
  | "task_alerts"
  | "mistake_alerts"
  | "fine_bonus_alerts"
  | "period_alerts"
  | "marketing_alerts"
  | "phase_alerts"
  | "reward_alerts"
  | "custom_request_alerts"
  | "billing_alerts"
  | "training_alerts"
  | "schedule_alerts"
> {
  return {
    shift_alerts: defaults.shift,
    whale_alerts: defaults.whale,
    model_alerts: defaults.model,
    system_alerts: defaults.system,
    task_alerts: defaults.task,
    mistake_alerts: defaults.mistake,
    fine_bonus_alerts: defaults.fine_bonus,
    period_alerts: defaults.period,
    marketing_alerts: defaults.marketing,
    phase_alerts: defaults.phase,
    reward_alerts: defaults.reward,
    custom_request_alerts: defaults.custom_request_alerts,
    billing_alerts: defaults.billing_alerts,
    training_alerts: defaults.training_alerts,
    schedule_alerts: defaults.schedule_alerts,
  };
}

export function preferenceCategoryFieldsFromPrefs(
  prefs: NotificationPreference
): Pick<NotificationRoleDefaults, NotificationRoleCategoryKey> {
  return {
    shift: prefs.shift_alerts,
    whale: prefs.whale_alerts,
    model: prefs.model_alerts,
    system: prefs.system_alerts,
    task: prefs.task_alerts,
    mistake: prefs.mistake_alerts,
    fine_bonus: prefs.fine_bonus_alerts,
    period: prefs.period_alerts,
    marketing: prefs.marketing_alerts,
    phase: prefs.phase_alerts,
    reward: prefs.reward_alerts,
    custom_request_alerts: prefs.custom_request_alerts,
    billing_alerts: prefs.billing_alerts,
    training_alerts: prefs.training_alerts,
    schedule_alerts: prefs.schedule_alerts,
  };
}

export function notificationCategoryDefaultsEqual(
  a: Pick<NotificationRoleDefaults, NotificationRoleCategoryKey>,
  b: Pick<NotificationRoleDefaults, NotificationRoleCategoryKey>
): boolean {
  return NOTIFICATION_ROLE_DEFAULT_KEYS.every((key) => a[key] === b[key]);
}

export function notificationDefaultsEqual(
  a: NotificationRoleDefaults,
  b: NotificationRoleDefaults
): boolean {
  if (!notificationCategoryDefaultsEqual(a, b)) return false;
  for (const catKey of NOTIFICATION_ROLE_DEFAULT_KEYS) {
    for (const entry of NOTIFICATION_CATEGORY_EVENTS[catKey]) {
      const eventKey = parseEventKeyFromEntry(entry);
      if (getEventDefaultValue(a, catKey, eventKey) !== getEventDefaultValue(b, catKey, eventKey)) {
        return false;
      }
    }
  }
  return true;
}

export const NOTIFICATION_CATEGORY_GROUPS: Array<{
  key: string;
  label: string;
  categories: Array<{
    key: NotificationRoleCategoryKey;
    label: string;
    description: string;
  }>;
}> = [
  {
    key: "shifts_work",
    label: "SHIFTS & WORK",
    categories: [
      {
        key: "shift",
        label: NOTIFICATION_CATEGORY_LABELS.shift.en,
        description: NOTIFICATION_CATEGORY_LABELS.shift.el,
      },
      {
        key: "task",
        label: NOTIFICATION_CATEGORY_LABELS.task.en,
        description: NOTIFICATION_CATEGORY_LABELS.task.el,
      },
      {
        key: "phase",
        label: NOTIFICATION_CATEGORY_LABELS.phase.en,
        description: NOTIFICATION_CATEGORY_LABELS.phase.el,
      },
      {
        key: "schedule_alerts",
        label: NOTIFICATION_CATEGORY_LABELS.schedule_alerts.en,
        description: NOTIFICATION_CATEGORY_LABELS.schedule_alerts.el,
      },
    ],
  },
  {
    key: "models_content",
    label: "MODELS & CONTENT",
    categories: [
      {
        key: "model",
        label: NOTIFICATION_CATEGORY_LABELS.model.en,
        description: NOTIFICATION_CATEGORY_LABELS.model.el,
      },
      {
        key: "period",
        label: NOTIFICATION_CATEGORY_LABELS.period.en,
        description: NOTIFICATION_CATEGORY_LABELS.period.el,
      },
      {
        key: "whale",
        label: NOTIFICATION_CATEGORY_LABELS.whale.en,
        description: NOTIFICATION_CATEGORY_LABELS.whale.el,
      },
      {
        key: "custom_request_alerts",
        label: NOTIFICATION_CATEGORY_LABELS.custom_request_alerts.en,
        description: NOTIFICATION_CATEGORY_LABELS.custom_request_alerts.el,
      },
    ],
  },
  {
    key: "performance",
    label: "PERFORMANCE",
    categories: [
      {
        key: "mistake",
        label: NOTIFICATION_CATEGORY_LABELS.mistake.en,
        description: NOTIFICATION_CATEGORY_LABELS.mistake.el,
      },
      {
        key: "fine_bonus",
        label: NOTIFICATION_CATEGORY_LABELS.fine_bonus.en,
        description: NOTIFICATION_CATEGORY_LABELS.fine_bonus.el,
      },
      {
        key: "reward",
        label: NOTIFICATION_CATEGORY_LABELS.reward.en,
        description: NOTIFICATION_CATEGORY_LABELS.reward.el,
      },
      {
        key: "marketing",
        label: NOTIFICATION_CATEGORY_LABELS.marketing.en,
        description: NOTIFICATION_CATEGORY_LABELS.marketing.el,
      },
    ],
  },
  {
    key: "finance_admin",
    label: "FINANCE & ADMIN",
    categories: [
      {
        key: "billing_alerts",
        label: NOTIFICATION_CATEGORY_LABELS.billing_alerts.en,
        description: NOTIFICATION_CATEGORY_LABELS.billing_alerts.el,
      },
      {
        key: "training_alerts",
        label: NOTIFICATION_CATEGORY_LABELS.training_alerts.en,
        description: NOTIFICATION_CATEGORY_LABELS.training_alerts.el,
      },
      {
        key: "system",
        label: NOTIFICATION_CATEGORY_LABELS.system.en,
        description: NOTIFICATION_CATEGORY_LABELS.system.el,
      },
    ],
  },
];

/** Map event type → role default category key (for per-event enforcement). */
export const EVENT_TO_ROLE_CATEGORY: Partial<Record<NotificationEventType, NotificationRoleCategoryKey>> =
  (() => {
    const map: Partial<Record<NotificationEventType, NotificationRoleCategoryKey>> = {};
    for (const catKey of NOTIFICATION_ROLE_DEFAULT_KEYS) {
      for (const entry of NOTIFICATION_CATEGORY_EVENTS[catKey]) {
        const eventKey = parseEventKeyFromEntry(entry);
        map[eventKey as NotificationEventType] = catKey;
      }
    }
    return map;
  })();
