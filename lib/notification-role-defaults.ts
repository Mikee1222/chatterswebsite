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

export type NotificationCategoryEventEntry =
  | string
  | { key: string; label: string; note?: string };

/** Parse event key from string entries or object entries. */
export function parseEventKeyFromEntry(entry: NotificationCategoryEventEntry): string {
  if (typeof entry === "object") return entry.key;
  return entry.split(" — ")[0]?.trim() ?? entry.trim();
}

/** Parse human label from object entries or description from string entries. */
export function parseEventLabelFromEntry(entry: NotificationCategoryEventEntry): string {
  if (typeof entry === "object") return entry.label;
  return parseEventDescriptionFromEntry(entry);
}

/** Optional admin note (entity-only pseudo-events). */
export function parseEventNoteFromEntry(entry: NotificationCategoryEventEntry): string {
  if (typeof entry === "object") return entry.note?.trim() ?? "";
  return "";
}

/** Parse description from strings like "shift_started — description". */
export function parseEventDescriptionFromEntry(entry: NotificationCategoryEventEntry): string {
  if (typeof entry === "object") return entry.label;
  const idx = entry.indexOf(" — ");
  return idx >= 0 ? entry.slice(idx + 3).trim() : "";
}

export function isNotificationRoleCategoryKey(key: string): key is NotificationRoleCategoryKey {
  return (NOTIFICATION_ROLE_DEFAULT_KEYS as readonly string[]).includes(key);
}

/**
 * Human-readable event lists per notification preference category (role default keys).
 * Each entry: "event_type — short description". Used in Admin → Roles → Notifications tab.
 */
export const NOTIFICATION_CATEGORY_EVENTS: Record<
  NotificationRoleCategoryKey,
  readonly NotificationCategoryEventEntry[]
> = {
  shift: [
    "shift_started — Chatter/VA starts a shift",
    "shift_ended — Chatter/VA ends a shift",
    "shift_late — Late for a scheduled shift",
    "shift_no_show — No-show on scheduled shift",
    "shift_overtime — Shift overtime alert",
    "shift_running_long — Shift running longer than expected",
    "shift_starting_soon — Reminder before shift starts",
    "chatter_no_models — Chatter on shift with no models",
    "break_started — Break started",
    "break_ended — Break ended",
    "break_exceeded — Break over 45 minutes",
    "break_too_long — Break duration limit exceeded",
  ],
  task: [
    "task_started — VA starts a task shift",
    "task_finished — VA ends a task shift",
    "task_completed — VA completes an assigned task",
    "task_overdue — VA task past due date",
    "tasks_not_started — Tasks not started on schedule",
    "va_task_reminder — Reminder before VA task due",
    "model_content_scheduled — Model schedules content assignment",
    "model_content_completed — Model marks content complete",
    "va_content_assigned — VA receives a content assignment",
    "va_content_scheduled — VA content delivery scheduled",
    "va_content_completed — VA content marked complete",
    "custom_request_uploaded — Custom request file uploaded",
  ],
  phase: [
    "phase_task_completed — VA completes a phase checklist item",
    "phase_completed — VA completes all items in a phase",
    "phase_overdue — VA phase missed deadline",
    "all_phases_completed — All phases done for a VA task",
  ],
  model: [
    "model_became_free — Model becomes available on floor",
    "model_taken — Chatter enters a model session",
    "model_live_started — Model goes live",
    "model_live_ended — Model live stream ended",
    "model_live_scheduled — Upcoming live stream reminder",
    "model_missed_live — Model missed scheduled live",
  ],
  period: [
    "period_3_day_reminder — Period expected in ~3 days",
    "period_predicted_day — Predicted period start today",
    "period_confirmed_early — Period logged earlier than predicted",
    "period_overdue — Period logging overdue",
    "period_prediction_reset — Period prediction reset",
  ],
  whale: [
    "whale_registered — New whale registered",
    "whale_assigned — Whale assigned to chatter or model",
    "whale_spent — Whale spending logged",
    "whale_followup — Whale follow-up due",
    "whale_session_submitted — Chatter logs a whale session",
  ],
  mistake: [
    {
      key: "chatter_mistake",
      label: "Mistake logged or updated",
      note: "Entity-gated: uses chatter_mistake entity_type; event_type is chatter_mistake on approve/reject.",
    },
  ],
  fine_bonus: [
    {
      key: "fine_bonus",
      label: "Fine or bonus submitted or reviewed",
      note: "Entity-gated only — no standalone event_type; preference follows fine_bonus entity_type.",
    },
  ],
  reward: [
    "points_awarded — Points earned",
    "level_up — Rewards tier level up",
    "spin_available — Spin wheel credit available",
    "challenge_completed — Live challenge completed",
  ],
  marketing: [
    {
      key: "shadowban_report",
      label: "Shadowban report submitted or reviewed",
      note: "Entity-gated: event_type shadowban_report on review; entity_type shadowban_report.",
    },
  ],
  custom_request_alerts: [
    "custom_request_created — New custom request submitted",
    "custom_request_submitted — Custom request sent to agency",
    "custom_request_updated — Custom request details updated",
    "custom_status_changed — Custom request status changed",
    "custom_approved — Custom request approved by agency",
    "custom_rejected — Custom request rejected",
    "custom_declined — Custom request declined by agency",
    "custom_edited — Custom request terms edited",
    "custom_uploaded — Custom content uploaded",
    "custom_scheduled — Custom delivery scheduled",
    "custom_deadline_approaching — Custom deadline in 48h",
    "custom_overdue — Custom request past deadline",
  ],
  billing_alerts: [
    "billing_cycle_announced — Client billing cycle announced",
    "billing_due_reminder — Client payment due reminder",
    "payment_submitted — Client payment proof submitted",
    "payment_confirmed — Client payment confirmed",
    "payment_rejected — Client payment rejected",
    "expense_approved — Expense request approved",
    "expense_rejected — Expense request declined",
  ],
  training_alerts: [
    "sop_academy_reminder — SOP Academy training reminder",
    "sop_academy_training_complete — SOP Academy training complete",
    "sop_academy_signed_off — SOP Academy sign-off",
  ],
  schedule_alerts: [
    "schedule_updated — Weekly schedule updated",
    "weekly_availability_friday_reminder — Friday availability reminder",
    "availability_submitted — Availability submitted",
  ],
  system: [
    "system_alert — General system message",
    "user_created — New user account created",
    "role_changed — User role changed",
    "account_deleted — Account deleted",
    "account_update — Account settings changed",
    "daily_summary — Daily operations summary",
    "form_submitted — Form submitted",
  ],
};

function buildCategoryOnlyDefaults(
  categories: Record<NotificationRoleCategoryKey, boolean>
): NotificationRoleDefaults {
  return { ...categories };
}

function withEventDefaults(
  categories: Record<NotificationRoleCategoryKey, boolean>
): NotificationRoleDefaults {
  const result = buildCategoryOnlyDefaults(categories);
  for (const catKey of NOTIFICATION_ROLE_DEFAULT_KEYS) {
    for (const entry of NOTIFICATION_CATEGORY_EVENTS[catKey]) {
      const eventKey = parseEventKeyFromEntry(entry);
      (result as Record<string, boolean>)[eventKey] = categories[catKey];
    }
  }
  return result;
}

const ALL_TRUE_CATEGORIES = Object.fromEntries(
  NOTIFICATION_ROLE_DEFAULT_KEYS.map((k) => [k, true])
) as Record<NotificationRoleCategoryKey, boolean>;

const ALL_FALSE_CATEGORIES = Object.fromEntries(
  NOTIFICATION_ROLE_DEFAULT_KEYS.map((k) => [k, false])
) as Record<NotificationRoleCategoryKey, boolean>;

const ALL_TRUE = withEventDefaults(ALL_TRUE_CATEGORIES);
const ALL_FALSE = withEventDefaults(ALL_FALSE_CATEGORIES);

/** Built-in defaults per system role slug (lowercase). */
export const DEFAULT_NOTIFICATION_DEFAULTS: Record<UserRole, NotificationRoleDefaults> = {
  admin: { ...ALL_TRUE },
  manager: { ...ALL_TRUE },
  chatter: withEventDefaults({
    ...ALL_FALSE_CATEGORIES,
    shift: true,
    whale: true,
    model: true,
    mistake: true,
    fine_bonus: true,
    reward: true,
    system: true,
    custom_request_alerts: true,
    training_alerts: true,
    schedule_alerts: true,
  }),
  virtual_assistant: withEventDefaults({
    ...ALL_FALSE_CATEGORIES,
    task: true,
    phase: true,
    model: true,
    system: true,
    marketing: true,
    custom_request_alerts: true,
    training_alerts: true,
    schedule_alerts: true,
  }),
  model: withEventDefaults({
    ...ALL_FALSE_CATEGORIES,
    model: true,
    period: true,
    system: true,
    custom_request_alerts: true,
  }),
  client: withEventDefaults({
    ...ALL_FALSE_CATEGORIES,
    system: true,
    billing_alerts: true,
  }),
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
    getBuiltInNotificationDefaults(roleName) ?? { ...ALL_TRUE }
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
