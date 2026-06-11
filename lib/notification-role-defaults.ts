import type {
  NotificationEventType,
  NotificationPreference,
  NotificationRoleCategoryKey,
  NotificationRoleDefaults,
  UserRole,
} from "@/types";
import {
  hasAdminVariant,
  MONITORING_ACTOR_ROLES,
} from "@/lib/notification-admin-variants";

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

export const NOTIFICATION_SCOPE_ROLES = [
  "admin",
  "manager",
  "chatter",
  "virtual_assistant",
  "model",
  "client",
] as const satisfies readonly UserRole[];

export type NotificationScopeRole = (typeof NOTIFICATION_SCOPE_ROLES)[number];
export type NotificationRoleScope = "broadcast" | "personal" | "none";

export type NotificationEventEntry = {
  key: string;
  label: string;
  note?: string;
  scope: Record<NotificationScopeRole, NotificationRoleScope>;
};

/** @deprecated Legacy string entries — all events use NotificationEventEntry objects now. */
export type NotificationCategoryEventEntry = NotificationEventEntry;


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

/** Scope for a specific role on an event entry. */
export function getScopeForRole(
  entry: NotificationCategoryEventEntry,
  roleId: string
): NotificationRoleScope {
  const slug = normalizeRoleSlug(roleId);
  if (!slug) return "none";
  return entry.scope[slug];
}

/** Parse description (alias for label on object entries). */
export function parseEventDescriptionFromEntry(entry: NotificationCategoryEventEntry): string {
  return entry.label;
}

export const NOTIFICATION_SCOPE_LABELS: Record<
  NotificationRoleScope,
  { badge: string; className: string }
> = {
  personal: { badge: "Personal", className: "bg-blue-500/20 text-blue-200 border-blue-400/30" },
  broadcast: { badge: "Broadcast", className: "bg-amber-500/20 text-amber-200 border-amber-400/30" },
  none: { badge: "—", className: "bg-white/5 text-white/30 border-white/10" },
};

function normalizeRoleSlug(roleId: string): NotificationScopeRole | null {
  const slug = roleId.trim().toLowerCase();
  return (NOTIFICATION_SCOPE_ROLES as readonly string[]).includes(slug)
    ? (slug as NotificationScopeRole)
    : null;
}

/** Roles that receive personal (assigned-party) notifications for each event. */
export const EVENT_TARGET_ROLES: Partial<Record<string, readonly UserRole[]>> = {
  shift_late: ["chatter", "virtual_assistant"],
  shift_no_show: ["chatter", "virtual_assistant"],
  shift_overtime: ["chatter", "virtual_assistant"],
  shift_running_long: ["chatter", "virtual_assistant"],
  shift_starting_soon: ["chatter", "virtual_assistant"],
  chatter_no_models: ["chatter"],
  model_became_free: ["chatter"],
  model_live_started: ["chatter", "model"],
  model_live_ended: ["chatter", "model"],
  model_taken: ["chatter", "model"],
  model_missed_live: ["model"],
  break_exceeded: ["chatter"],
  break_too_long: ["chatter"],
  va_task_reminder: ["virtual_assistant"],
  va_content_assigned: ["virtual_assistant"],
  va_content_scheduled: ["model"],
  va_content_completed: ["model"],
  model_content_scheduled: ["model", "virtual_assistant"],
  model_content_completed: ["model", "virtual_assistant"],
  task_completed: ["virtual_assistant"],
  task_overdue: ["virtual_assistant"],
  custom_request_uploaded: ["chatter", "model", "virtual_assistant"],
  custom_request_created: ["chatter", "model"],
  custom_request_submitted: ["chatter", "model", "virtual_assistant"],
  custom_request_updated: ["chatter", "model", "virtual_assistant"],
  custom_status_changed: ["chatter", "model", "virtual_assistant"],
  custom_approved: ["model"],
  custom_rejected: ["model"],
  custom_declined: ["model"],
  custom_edited: ["chatter", "model", "virtual_assistant"],
  custom_uploaded: ["chatter", "model", "virtual_assistant"],
  custom_scheduled: ["chatter", "model", "virtual_assistant"],
  custom_deadline_approaching: ["chatter", "model"],
  custom_overdue: ["chatter", "model"],
  phase_task_completed: ["virtual_assistant"],
  phase_completed: ["virtual_assistant"],
  phase_overdue: ["virtual_assistant", "chatter"],
  all_phases_completed: ["virtual_assistant"],
  model_live_scheduled: ["model"],
  period_3_day_reminder: ["model"],
  period_predicted_day: ["model"],
  period_confirmed_early: ["model"],
  period_overdue: ["model"],
  period_prediction_reset: ["model"],
  whale_registered: ["chatter"],
  whale_assigned: ["chatter"],
  whale_spent: ["chatter"],
  whale_followup: ["chatter"],
  whale_session_submitted: ["chatter"],
  chatter_mistake: ["chatter", "virtual_assistant"],
  chatter_mistake_reviewed: ["chatter", "virtual_assistant"],
  fine_bonus: ["chatter", "virtual_assistant"],
  fine_issued: ["chatter", "virtual_assistant"],
  bonus_awarded: ["chatter", "virtual_assistant"],
  fine_bonus_reviewed: ["chatter", "virtual_assistant"],
  points_awarded: ["chatter", "virtual_assistant"],
  level_up: ["chatter", "virtual_assistant"],
  spin_available: ["chatter", "virtual_assistant"],
  challenge_completed: ["chatter", "virtual_assistant"],
  spin_result: ["chatter", "virtual_assistant"],
  shadowban_report: ["virtual_assistant", "model"],
  shadowban_submitted: ["virtual_assistant", "model"],
  shadowban_resolved: ["virtual_assistant", "model"],
  billing_cycle_announced: ["client"],
  payment_submitted: ["client"],
  sop_quiz_passed: ["chatter", "virtual_assistant"],
  sop_quiz_failed: ["chatter", "virtual_assistant"],
  schedule_published: ["chatter", "virtual_assistant"],
  login_new_device: ["admin", "manager", "chatter", "virtual_assistant", "model", "client"],
  password_changed: ["admin", "manager", "chatter", "virtual_assistant", "model", "client"],
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
};

/** Build per-role scope for personal (non-_admin) events. Admin/manager use _admin variants instead. */
function buildEventScope(eventKey: string): NotificationEventEntry["scope"] {
  const targets = EVENT_TARGET_ROLES[eventKey];
  const actorRoles = MONITORING_ACTOR_ROLES[eventKey as keyof typeof MONITORING_ACTOR_ROLES];
  const scope = {} as NotificationEventEntry["scope"];
  for (const role of NOTIFICATION_SCOPE_ROLES) {
    if (targets?.includes(role) || actorRoles?.includes(role)) {
      scope[role] = "personal";
    } else {
      scope[role] = "none";
    }
  }
  return scope;
}

function buildAdminScope(): NotificationEventEntry["scope"] {
  const scope = {} as NotificationEventEntry["scope"];
  for (const role of NOTIFICATION_SCOPE_ROLES) {
    scope[role] = role === "admin" || role === "manager" ? "broadcast" : "none";
  }
  return scope;
}

function eventEntry(key: string, label: string, note?: string): NotificationEventEntry {
  const scope = buildEventScope(key);
  return note ? { key, label, scope, note } : { key, label, scope };
}

function adminEventEntry(personalKey: string, adminLabel: string, note?: string): NotificationEventEntry {
  const scope = buildAdminScope();
  return note
    ? { key: `${personalKey}_admin`, label: adminLabel, scope, note }
    : { key: `${personalKey}_admin`, label: adminLabel, scope };
}

/** Personal event + optional paired _admin monitoring event. */
function pairedEvents(
  key: string,
  personalLabel: string,
  adminLabel: string,
  note?: string
): readonly NotificationEventEntry[] {
  const entries: NotificationEventEntry[] = [eventEntry(key, personalLabel, note)];
  if (hasAdminVariant(key)) {
    entries.push(adminEventEntry(key, adminLabel, note));
  }
  return entries;
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
  readonly NotificationEventEntry[]
> = {
  shift: [
    ...pairedEvents("shift_started", "Ξεκίνησες βάρδια", "Κάποιος ξεκίνησε βάρδια"),
    ...pairedEvents("shift_ended", "Τελείωσες βάρδια", "Κάποιος τελείωσε βάρδια"),
    ...pairedEvents("shift_late", "Άργησες στη βάρδια", "Κάποιος άργησε στη βάρδια"),
    ...pairedEvents("shift_no_show", "Απουσία από βάρδια", "Απουσία από προγραμματισμένη βάρδια"),
    ...pairedEvents("shift_overtime", "Υπερωρία βάρδιας", "Υπερωρία βάρδιας (παρακολούθηση)"),
    ...pairedEvents("shift_running_long", "Μακρά βάρδια", "Βάρδια τρέχει longer than expected"),
    eventEntry("shift_starting_soon", "Reminder before shift starts"),
    ...pairedEvents("chatter_no_models", "Chatter on shift with no models", "Chatter on shift with no models (admin)"),
    ...pairedEvents("break_started", "Ξεκίνησες διάλειμμα", "Κάποιος ξεκίνησε διάλειμμα"),
    ...pairedEvents("break_ended", "Τελείωσε το διάλειμμα", "Κάποιος επέστρεψε από διάλειμμα"),
    ...pairedEvents("break_exceeded", "Break over 45 minutes", "Break over 45 minutes (admin)"),
    ...pairedEvents("break_too_long", "Break duration limit exceeded", "Break duration limit exceeded (admin)"),
  ],
  task: [
    ...pairedEvents("task_started", "VA starts a task shift", "VA starts a task shift (admin)"),
    ...pairedEvents("task_finished", "VA ends a task shift", "VA ends a task shift (admin)"),
    ...pairedEvents("task_shift_started", "VA task shift session started", "VA task shift session started (admin)"),
    ...pairedEvents("task_shift_ended", "VA task shift session ended", "VA task shift session ended (admin)"),
    ...pairedEvents("task_completed", "VA completes an assigned task", "VA completes an assigned task (admin)"),
    ...pairedEvents("task_overdue", "VA task past due date", "VA task past due date (admin)"),
    ...pairedEvents("tasks_not_started", "Tasks not started on schedule", "Tasks not started on schedule (admin)"),
    eventEntry("va_task_reminder", "Reminder before VA task due"),
    ...pairedEvents("model_content_scheduled", "Model schedules content assignment", "Model schedules content (admin)"),
    ...pairedEvents("model_content_completed", "Model marks content complete", "Model marks content complete (admin)"),
    ...pairedEvents("va_content_assigned", "VA receives a content assignment", "VA content assignment created (admin)"),
    ...pairedEvents("va_content_scheduled", "VA content delivery scheduled", "VA content delivery scheduled (admin)"),
    ...pairedEvents("va_content_completed", "VA content marked complete", "VA content marked complete (admin)"),
    ...pairedEvents("custom_request_uploaded", "Custom request file uploaded", "Custom request file uploaded (admin)"),
  ],
  phase: [
    ...pairedEvents("phase_task_completed", "VA completes a phase checklist item", "VA phase checklist progress (admin)"),
    ...pairedEvents("phase_completed", "VA completes all items in a phase", "VA phase completed (admin)"),
    ...pairedEvents("phase_overdue", "VA phase missed deadline", "VA phase overdue (admin)"),
    ...pairedEvents("all_phases_completed", "All phases done for a VA task", "All VA phases completed (admin)"),
  ],
  model: [
    ...pairedEvents("model_became_free", "Model becomes available on floor", "Model available on floor (admin)"),
    ...pairedEvents("model_taken", "Chatter enters a model session", "Chatter entered model session (admin)"),
    ...pairedEvents("model_live_started", "Model goes live", "Model went live (admin)"),
    ...pairedEvents("model_live_ended", "Model live stream ended", "Model live stream ended (admin)"),
    eventEntry("model_live_scheduled", "Upcoming live stream reminder"),
    ...pairedEvents("model_missed_live", "Model missed scheduled live", "Model missed scheduled live (admin)"),
  ],
  period: [
    eventEntry("period_3_day_reminder", "Period expected in ~3 days"),
    eventEntry("period_predicted_day", "Predicted period start today"),
    eventEntry("period_confirmed_early", "Period logged earlier than predicted"),
    ...pairedEvents("period_overdue", "Period logging overdue", "Period overdue — admin monitoring"),
    eventEntry("period_prediction_reset", "Period prediction reset"),
  ],
  whale: [
    ...pairedEvents("whale_registered", "New whale registered", "New whale registered (admin)"),
    ...pairedEvents("whale_assigned", "Whale assigned to chatter or model", "Whale assigned (admin)"),
    ...pairedEvents("whale_spent", "Whale spending logged", "Whale spending logged (admin)"),
    ...pairedEvents("whale_followup", "Whale follow-up due", "Whale follow-up due (admin)"),
    ...pairedEvents("whale_session_submitted", "Chatter logs a whale session", "Whale session submitted (admin)"),
  ],
  mistake: [
    eventEntry(
      "chatter_mistake",
      "Mistake logged or updated",
      "Entity-gated: uses chatter_mistake entity_type; event_type is chatter_mistake on approve/reject."
    ),
    adminEventEntry(
      "chatter_mistake",
      "Λάθος καταχωρήθηκε (admin)",
      "Entity-gated: admin monitoring for chatter mistakes."
    ),
    ...pairedEvents(
      "chatter_mistake_reviewed",
      "Το λάθος σου κρίθηκε από admin",
      "Λάθος κρίθηκε (admin)"
    ),
  ],
  fine_bonus: [
    eventEntry(
      "fine_bonus",
      "Πρόστιμα/μπόνους (legacy)",
      "Entity-gated only — backward compat; preference follows fine_bonus entity_type."
    ),
    {
      key: "fine_bonus_admin",
      label: "Πρόστιμα/μπόνους (legacy admin)",
      scope: buildAdminScope(),
      note: "Entity-gated admin monitoring for fines and bonuses (legacy).",
    },
    ...pairedEvents("fine_issued", "Σου επιβλήθηκε πρόστιμο", "Πρόστιμο επιβλήθηκε"),
    ...pairedEvents("bonus_awarded", "Πήρες μπόνους!", "Μπόνους δόθηκε"),
    ...pairedEvents(
      "fine_bonus_reviewed",
      "Το πρόστιμο/μπόνους σου κρίθηκε",
      "Πρόστιμο/μπόνους κρίθηκε"
    ),
  ],
  reward: [
    ...pairedEvents("points_awarded", "Points earned", "Points awarded (admin)"),
    ...pairedEvents("level_up", "Rewards tier level up", "Level up (admin)"),
    eventEntry("spin_available", "Spin wheel credit available"),
    ...pairedEvents("challenge_completed", "Live challenge completed", "Challenge completed (admin)"),
    {
      key: "spin_result",
      label: "Αποτέλεσμα spin wheel",
      scope: {
        chatter: "personal",
        virtual_assistant: "personal",
        admin: "none",
        manager: "none",
        model: "none",
        client: "none",
      },
    },
    {
      key: "spin_result_admin",
      label: "Spin wheel αποτέλεσμα (admin)",
      scope: {
        admin: "broadcast",
        manager: "broadcast",
        chatter: "none",
        virtual_assistant: "none",
        model: "none",
        client: "none",
      },
    },
  ],
  marketing: [
    eventEntry(
      "shadowban_report",
      "Shadowban report (legacy)",
      "Entity-gated legacy; prefer shadowban_submitted / shadowban_resolved."
    ),
    adminEventEntry(
      "shadowban_report",
      "Shadowban report (legacy admin)",
      "Entity-gated admin monitoring for shadowban reports (legacy)."
    ),
    ...pairedEvents("shadowban_submitted", "Shadowban report submitted", "Shadowban report submitted (admin)"),
    ...pairedEvents("shadowban_resolved", "Shadowban report resolved", "Shadowban report resolved (admin)"),
  ],
  custom_request_alerts: [
    ...pairedEvents("custom_request_created", "New custom request submitted", "New custom request (admin)"),
    ...pairedEvents("custom_request_submitted", "Custom request sent to agency", "Custom request submitted (admin)"),
    ...pairedEvents("custom_request_updated", "Custom request details updated", "Custom request updated (admin)"),
    ...pairedEvents("custom_status_changed", "Custom request status changed", "Custom status changed (admin)"),
    ...pairedEvents("custom_approved", "Custom request approved by agency", "Custom approved (admin)"),
    ...pairedEvents("custom_rejected", "Custom request rejected", "Custom rejected (admin)"),
    ...pairedEvents("custom_declined", "Custom request declined by agency", "Custom declined (admin)"),
    ...pairedEvents("custom_edited", "Custom request terms edited", "Custom edited (admin)"),
    ...pairedEvents("custom_uploaded", "Custom content uploaded", "Custom uploaded (admin)"),
    ...pairedEvents("custom_scheduled", "Custom delivery scheduled", "Custom scheduled (admin)"),
    ...pairedEvents("custom_deadline_approaching", "Custom deadline in 48h", "Custom deadline approaching (admin)"),
    ...pairedEvents("custom_overdue", "Custom request past deadline", "Custom overdue (admin)"),
  ],
  billing_alerts: [
    ...pairedEvents("billing_cycle_announced", "Client billing cycle announced", "Billing cycle announced (admin)"),
    eventEntry("billing_due_reminder", "Client payment due reminder"),
    ...pairedEvents("payment_submitted", "Client payment proof submitted", "Client payment proof submitted (admin)"),
    ...pairedEvents("billing_payment_submitted", "Client payment proof submitted (legacy)", "Client payment proof (admin)"),
    eventEntry("payment_confirmed", "Client payment confirmed"),
    eventEntry("payment_rejected", "Client payment rejected"),
    ...pairedEvents("expense_approved", "Expense request approved", "Expense request approved (admin)"),
    ...pairedEvents("expense_rejected", "Expense request declined", "Expense request declined (admin)"),
  ],
  training_alerts: [
    eventEntry("sop_academy_reminder", "SOP Academy training reminder"),
    ...pairedEvents("sop_academy_training_complete", "SOP Academy training complete", "SOP Academy training complete (admin)"),
    ...pairedEvents("sop_academy_signed_off", "SOP Academy sign-off", "SOP Academy sign-off (admin)"),
    ...pairedEvents("sop_quiz_passed", "SOP quiz passed", "SOP quiz passed (admin)"),
    eventEntry("sop_quiz_failed", "SOP quiz failed — retry"),
  ],
  schedule_alerts: [
    ...pairedEvents("schedule_published", "Weekly schedule published", "Weekly schedule published (admin)"),
    ...pairedEvents("schedule_updated", "Weekly schedule updated", "Weekly schedule updated (admin)"),
    eventEntry("weekly_availability_friday_reminder", "Friday availability reminder"),
    ...pairedEvents("availability_submitted", "Availability submitted", "Availability submitted (admin)"),
  ],
  system: [
    eventEntry("system_alert", "General system message"),
    ...pairedEvents("user_created", "New user account created", "New user account created (admin)"),
    eventEntry("role_changed", "User role changed"),
    eventEntry("account_deleted", "Account deleted"),
    eventEntry("account_update", "Account settings changed"),
    eventEntry("daily_summary", "Daily operations summary"),
    eventEntry("login_new_device", "New login from unrecognized device"),
    eventEntry("password_changed", "Account password changed"),
    ...pairedEvents("form_submitted", "Form submitted", "Form submitted (admin)"),
  ],
};

/** Derive per-event default from role-specific scope. */
export function deriveEventDefaultForRole(scope: NotificationRoleScope): boolean {
  return scope !== "none";
}

export function getNotificationEventEntry(eventKey: string): NotificationEventEntry | undefined {
  for (const catKey of NOTIFICATION_ROLE_DEFAULT_KEYS) {
    const found = NOTIFICATION_CATEGORY_EVENTS[catKey].find((e) => e.key === eventKey);
    if (found) return found;
  }
  return undefined;
}

function buildScopedRoleDefaults(role: UserRole): NotificationRoleDefaults {
  const categories = {} as Record<NotificationRoleCategoryKey, boolean>;
  const result = {} as NotificationRoleDefaults;

  for (const catKey of NOTIFICATION_ROLE_DEFAULT_KEYS) {
    let catOn = false;
    for (const entry of NOTIFICATION_CATEGORY_EVENTS[catKey]) {
      const eventKey = parseEventKeyFromEntry(entry);
      const scope = getScopeForRole(entry, role);
      const eventOn = deriveEventDefaultForRole(scope);
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
