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
] as const satisfies readonly NotificationRoleCategoryKey[];

/** Parse event key from strings like "shift_started — description". */
export function parseEventKeyFromEntry(entry: string): string {
  return entry.split(" — ")[0]?.trim() ?? entry.trim();
}

/** Parse description from strings like "shift_started — description". */
export function parseEventDescriptionFromEntry(entry: string): string {
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
export const NOTIFICATION_CATEGORY_EVENTS: Record<NotificationRoleCategoryKey, readonly string[]> = {
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
    "custom_request_created — New custom request",
    "custom_request_updated — Custom request updated",
    "custom_request_submitted — Custom request submitted",
    "custom_status_changed — Custom status changed",
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
    "custom_approved — Custom approved",
    "custom_rejected — Custom rejected",
    "custom_declined — Custom declined by agency",
    "custom_edited — Custom terms edited",
    "custom_uploaded — Custom content uploaded",
    "custom_scheduled — Custom delivery scheduled",
    "custom_deadline_approaching — Custom deadline in 48h",
    "custom_overdue — Custom past deadline",
    "expense_approved — Expense request approved",
    "expense_rejected — Expense request rejected",
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
    "chatter_mistake — Mistake logged or updated (entity-gated)",
  ],
  fine_bonus: [
    "fine_bonus — Fine or bonus submitted or reviewed (entity-gated)",
  ],
  reward: [
    "points_awarded — Points earned",
    "level_up — Rewards tier level up",
    "spin_available — Spin wheel credit available",
    "challenge_completed — Live challenge completed",
  ],
  marketing: [
    "shadowban_report — Shadowban report submitted or reviewed (entity-gated)",
  ],
  system: [
    "form_submitted — Form submitted",
    "schedule_updated — Weekly schedule updated",
    "weekly_availability_friday_reminder — Friday availability reminder",
    "availability_submitted — Availability submitted",
    "system_alert — General system alerts",
    "user_created — New user account",
    "role_changed — User role changed",
    "account_deleted — Account deleted",
    "account_update — Account settings changed",
    "daily_summary — Daily ops summary",
    "sop_academy_reminder — SOP Academy training reminder",
    "sop_academy_training_complete — SOP Academy training complete",
    "sop_academy_signed_off — SOP Academy sign-off",
    "billing_cycle_announced — Client billing cycle announced",
    "billing_due_reminder — Client payment due reminder",
    "payment_submitted — Client payment proof submitted",
    "payment_confirmed — Client payment confirmed",
    "payment_rejected — Client payment rejected",
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
  }),
  virtual_assistant: withEventDefaults({
    ...ALL_FALSE_CATEGORIES,
    task: true,
    phase: true,
    model: true,
    system: true,
    marketing: true,
  }),
  model: withEventDefaults({
    ...ALL_FALSE_CATEGORIES,
    model: true,
    period: true,
    system: true,
  }),
  client: withEventDefaults({
    ...ALL_FALSE_CATEGORIES,
    system: true,
    period: true,
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
        label: "Shift alerts",
        description: "Ειδοποιήσεις για βάρδιες, καθυστερήσεις και απουσίες.",
      },
      {
        key: "task",
        label: "Task alerts",
        description: "Ειδοποιήσεις για εργασίες VA και υπενθυμίσεις.",
      },
      {
        key: "phase",
        label: "Phase alerts",
        description: "Ειδοποιήσεις για φάσεις onboarding και προόδου.",
      },
    ],
  },
  {
    key: "models_content",
    label: "MODELS & CONTENT",
    categories: [
      {
        key: "model",
        label: "Model alerts",
        description: "Ειδοποιήσεις για μοντέλα, live και διαθεσιμότητα.",
      },
      {
        key: "period",
        label: "Period alerts",
        description: "Ειδοποιήσεις για περίοδο και σχετικές υπενθυμίσεις.",
      },
      {
        key: "whale",
        label: "Whale alerts",
        description: "Ειδοποιήσεις για whales, ανάθεση και δραστηριότητα.",
      },
    ],
  },
  {
    key: "performance",
    label: "PERFORMANCE",
    categories: [
      {
        key: "mistake",
        label: "Mistake alerts",
        description: "Ειδοποιήσεις για λάθη και διορθωτικές ενέργειες.",
      },
      {
        key: "fine_bonus",
        label: "Fine/bonus alerts",
        description: "Ειδοποιήσεις για πρόστιμα, μπόνους και οικονομικές κινήσεις.",
      },
      {
        key: "reward",
        label: "Reward alerts",
        description: "Ειδοποιήσεις για πόντους, επιπέδα και ανταμοιβές.",
      },
      {
        key: "marketing",
        label: "Marketing alerts",
        description: "Ειδοποιήσεις για marketing, shadowban και social.",
      },
    ],
  },
  {
    key: "system",
    label: "SYSTEM",
    categories: [
      {
        key: "system",
        label: "System alerts",
        description: "Γενικές ειδοποιήσεις συστήματος και λογαριασμού.",
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
