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
