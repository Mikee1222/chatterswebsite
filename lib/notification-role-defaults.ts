import type { NotificationPreference, NotificationRoleDefaults, UserRole } from "@/types";

export type { NotificationRoleDefaults };

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
] as const satisfies readonly (keyof NotificationRoleDefaults)[];

const ALL_TRUE: NotificationRoleDefaults = {
  shift: true,
  whale: true,
  model: true,
  system: true,
  task: true,
  mistake: true,
  fine_bonus: true,
  period: true,
  marketing: true,
  phase: true,
  reward: true,
};

const ALL_FALSE: NotificationRoleDefaults = {
  shift: false,
  whale: false,
  model: false,
  system: false,
  task: false,
  mistake: false,
  fine_bonus: false,
  period: false,
  marketing: false,
  phase: false,
  reward: false,
};

/** Built-in defaults per system role slug (lowercase). */
export const DEFAULT_NOTIFICATION_DEFAULTS: Record<UserRole, NotificationRoleDefaults> = {
  admin: { ...ALL_TRUE },
  manager: { ...ALL_TRUE },
  chatter: {
    ...ALL_FALSE,
    shift: true,
    whale: true,
    mistake: true,
    fine_bonus: true,
    reward: true,
    system: true,
  },
  virtual_assistant: {
    ...ALL_FALSE,
    task: true,
    phase: true,
    model: true,
    system: true,
    marketing: true,
  },
  model: {
    ...ALL_FALSE,
    model: true,
    period: true,
    system: true,
  },
  client: {
    ...ALL_FALSE,
    system: true,
    period: true,
  },
};

export function getBuiltInNotificationDefaults(roleName: string): NotificationRoleDefaults | null {
  const key = roleName.trim().toLowerCase();
  if (key in DEFAULT_NOTIFICATION_DEFAULTS) {
    return { ...DEFAULT_NOTIFICATION_DEFAULTS[key as UserRole] };
  }
  return null;
}

export function getFallbackNotificationDefaults(roleName: string): NotificationRoleDefaults {
  return getBuiltInNotificationDefaults(roleName) ?? { ...ALL_TRUE };
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
    return result;
  } catch {
    return null;
  }
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
): NotificationRoleDefaults {
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

export function notificationDefaultsEqual(
  a: NotificationRoleDefaults,
  b: NotificationRoleDefaults
): boolean {
  return NOTIFICATION_ROLE_DEFAULT_KEYS.every((key) => a[key] === b[key]);
}

/**
 * Human-readable event lists per notification preference category (role default keys).
 * Each entry: "event_type — short description". Used in Admin → Roles → Notifications tab.
 */
export const NOTIFICATION_CATEGORY_EVENTS: Record<keyof NotificationRoleDefaults, readonly string[]> = {
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
    "billing_cycle_announced — Client billing cycle announced",
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
    "custom_request_created — New custom request",
    "custom_request_updated — Custom request updated",
    "custom_request_submitted — Custom request submitted",
    "custom_status_changed — Custom status changed",
    "custom_approved — Custom approved",
    "custom_rejected — Custom rejected",
    "custom_declined — Custom declined by agency",
    "custom_edited — Custom terms edited",
    "custom_uploaded — Custom content uploaded",
    "custom_scheduled — Custom delivery scheduled",
    "custom_deadline_approaching — Custom deadline in 48h",
    "custom_overdue — Custom past deadline",
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
    "expense_approved — Expense request approved",
    "expense_rejected — Expense request rejected",
    "billing_due_reminder — Client payment due reminder",
    "payment_submitted — Client payment proof submitted",
    "payment_confirmed — Client payment confirmed",
    "payment_rejected — Client payment rejected",
  ],
};

export const NOTIFICATION_CATEGORY_GROUPS: Array<{
  key: string;
  label: string;
  categories: Array<{
    key: keyof NotificationRoleDefaults;
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
