import type { UserRole } from "@/types";

/** Resource:action permission strings — single source of truth for RBAC. */
export const PERMISSIONS = {
  BILLING_VIEW: "billing:view",
  BILLING_MANAGE: "billing:manage",

  ACCOUNTS_VIEW: "accounts:view",
  ACCOUNTS_CREATE: "accounts:create",
  ACCOUNTS_EDIT: "accounts:edit",
  ACCOUNTS_DELETE: "accounts:delete",
  ACCOUNTS_RESET_PASSWORD: "accounts:reset-password",

  EARNINGS_VIEW: "earnings:view",
  EARNINGS_CONFIG: "earnings:config",

  INFLOWW_STATS_VIEW_OWN: "infloww_stats:view_own",
  INFLOWW_STATS_VIEW_ALL: "infloww_stats:view_all",

  MISTAKES_VIEW: "mistakes:view",
  MISTAKES_MANAGE: "mistakes:manage",
  MISTAKES_REASONS_MANAGE: "mistakes:reasons-manage",

  CHALLENGES_VIEW: "challenges:view",
  CHALLENGES_MANAGE: "challenges:manage",

  REWARDS_VIEW: "rewards:view",
  REWARDS_CONFIG: "rewards:config",
  REWARDS_MANAGE: "rewards:manage",

  SHIFTS_VIEW: "shifts:view",
  SHIFTS_MANAGE: "shifts:manage",
  SHIFTS_START: "shifts:start",
  SHIFTS_ACTIVE_VIEW: "shifts:active-view",

  FINES_VIEW: "fines:view",
  FINES_MANAGE: "fines:manage",
  FINES_REVIEW: "fines:review",

  MODELS_VIEW: "models:view",
  MODELS_MANAGE: "models:manage",
  MODELS_SCHEDULES: "models:schedules",
  MODELS_AVAILABILITY: "models:availability",

  CLIENTS_VIEW: "clients:view",
  CLIENTS_MANAGE: "clients:manage",

  WHALES_VIEW: "whales:view",
  WHALES_MANAGE: "whales:manage",
  WHALES_ASSIGN: "whales:assign",

  MARKETING_VIEW: "marketing:view",
  MARKETING_MANAGE: "marketing:manage",
  MARKETING_SHADOWBAN_REPORT: "marketing:shadowban-report",

  /** Admin Instagram Insights (ClarioSuite) within Marketing. */
  INSTAGRAM_INSIGHTS_VIEW: "instagram_insights:view",

  VA_TASKS_VIEW: "va-tasks:view",
  VA_TASKS_MANAGE: "va-tasks:manage",
  VA_TASKS_ASSIGN: "va-tasks:assign",
  TASK_PROGRESS_VIEW: "task_progress:view",
  TASK_TEMPLATES_MANAGE: "task_templates:manage",
  VA_STATISTICS_VIEW: "va_statistics:view",

  SOPS_VIEW: "sops:view",
  SOPS_MANAGE: "sops:manage",
  SOPS_SIGN_OFF: "sops:sign-off",
  SOPS_QUIZ: "sops:quiz",

  PDF_MAKER_MANAGE: "pdf_maker:manage",

  SPOTCHECK_SUBMIT: "spotcheck:submit",
  SPOTCHECK_MANAGE: "spotcheck:manage",

  WINNER_VIDEOS_SUBMIT: "winner_videos:submit",
  WINNER_VIDEOS_MANAGE: "winner_videos:manage",

  /** Marketing Exec winner/superwinner sourcing + researcher bunch fill (distinct from Research). */
  WINNER_SOURCING_SUBMIT: "winner_sourcing:submit",
  WINNER_SOURCING_MANAGE: "winner_sourcing:manage",

  CREATIVE_SCRIPTS_SUBMIT: "creative_scripts:submit",
  CREATIVE_SCRIPTS_MANAGE: "creative_scripts:manage",

  /** Filmer shoot assignments + filming calendar (opt-in via Roles UI — no hardcoded filmer role). */
  FILMING_VIEW_ASSIGNMENTS: "filming:view_assignments",
  FILMING_MANAGE: "filming:manage",

  /** Editor assignments after filming upload (opt-in via Roles UI — no hardcoded editor role). */
  EDITING_VIEW_ASSIGNMENTS: "editing:view_assignments",
  EDITING_MANAGE: "editing:manage",

  /** iCloud folder organization after editing upload (opt-in via Roles UI — no hardcoded icloud role). */
  ICLOUD_MANAGEMENT_VIEW: "icloud_management:view",
  ICLOUD_MANAGEMENT_MANAGE: "icloud_management:manage",

  DAILY_REVIEW_SUBMIT: "daily_review:submit",
  DAILY_REVIEW_MANAGE: "daily_review:manage",

  CONTENT_VIEW: "content:view",
  CONTENT_MANAGE: "content:manage",
  CONTENT_ASSIGN: "content:assign",

  SPIN_WHEEL_VIEW: "spin-wheel:view",
  SPIN_WHEEL_MANAGE: "spin-wheel:manage",

  NOTIFICATIONS_VIEW: "notifications:view",
  NOTIFICATIONS_MANAGE: "notifications:manage",
  NOTIFICATIONS_DIAGNOSTIC: "notifications:diagnostic",

  CUSTOM_REQUESTS_VIEW: "custom-requests:view",
  CUSTOM_REQUESTS_MANAGE: "custom-requests:manage",
  CUSTOM_REQUESTS_APPROVE: "custom-requests:approve",

  WEEKLY_PROGRAM_VIEW: "weekly-program:view",
  WEEKLY_PROGRAM_MANAGE: "weekly-program:manage",

  CHATTER_PROGRAM_VIEW: "chatter_program:view",
  CHATTER_PROGRAM_MANAGE: "chatter_program:manage",
  VA_PROGRAM_VIEW: "va_program:view",
  VA_PROGRAM_MANAGE: "va_program:manage",

  PAYMENTS_VIEW: "payments:view",
  PAYMENTS_SUBMIT: "payments:submit",
  PAYMENTS_MANAGE: "payments:manage",

  SETTINGS_VIEW: "settings:view",
  SETTINGS_MANAGE: "settings:manage",

  ROLES_VIEW: "roles:view",
  ROLES_MANAGE: "roles:manage",

  FEEDBACK_VIEW: "feedback:view",
  FEEDBACK_MANAGE: "feedback:manage",

  INFORMATIONS_VIEW: "informations:view",
  INFORMATIONS_MANAGE: "informations:manage",

  PRICING_VIEW: "pricing:view",
  PRICING_MANAGE: "pricing:manage",

  MASS_LISTS_VIEW: "mass-lists:view",
  MASS_LISTS_MANAGE: "mass-lists:manage",

  LINK_PAGES_VIEW: "link-pages:view",
  LINK_PAGES_MANAGE: "link-pages:manage",

  VIDEO_TRANSCRIBE_ACCESS: "video_transcribe:access",

  BLUR_TOOL_ACCESS: "blur_tool:access",

  MY_PROFILES_VIEW: "my_profiles:view",

  ACTIVITY_LOGS_VIEW: "activity_logs:view",

  /** Encrypted credentials vault — opt-in via Roles UI (admin default only). */
  CREDENTIALS_VIEW: "credentials:view",
  CREDENTIALS_MANAGE: "credentials:manage",

} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

const PERMISSION_SET: ReadonlySet<string> = new Set(ALL_PERMISSIONS);

/** True when `value` is a known permission from {@link PERMISSIONS}. */
export function isPermission(value: unknown): value is Permission {
  return typeof value === "string" && PERMISSION_SET.has(value);
}

/**
 * Keep only known permissions (order-preserving, de-duped).
 * Drops legacy/removed strings (e.g. old `content_pipeline:*`) so Roles UI saves
 * are not blocked by stale JSON still stored on role rows.
 */
export function sanitizePermissions(values: readonly unknown[]): Permission[] {
  const out: Permission[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (!isPermission(value) || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

const ACTION_LABELS: Record<string, string> = {
  access: "Access",
  view: "View",
  manage: "Manage",
  create: "Create",
  edit: "Edit",
  delete: "Delete",
  "reset-password": "Reset password",
  config: "Configure",
  "reasons-manage": "Manage reasons",
  "sign-off": "Sign off",
  quiz: "Take quiz",
  qa: "QA",
  assign: "Assign",
  approve: "Approve",
  submit: "Submit",
  start: "Start",
  "active-view": "View active",
  review: "Review",
  schedules: "Schedules",
  availability: "Availability",
  "shadowban-report": "Shadowban report",
  diagnostic: "Diagnostic",
  view_own: "View own",
  view_all: "View all",
  view_assignments: "View assignments",
};

/** Human-readable labels for permission categories (prefix before `:`). */
export const PERMISSION_CATEGORY_LABELS: Record<string, string> = {
  billing: "Billing",
  accounts: "Accounts",
  earnings: "Earnings",
  infloww_stats: "Infloww performance",
  mistakes: "Mistakes",
  challenges: "Challenges",
  rewards: "Rewards",
  shifts: "Shifts",
  fines: "Fines & bonuses",
  models: "Models",
  clients: "Clients",
  whales: "Whales",
  marketing: "Marketing",
  instagram_insights: "Instagram Insights",
  "va-tasks": "Tasks",
  task_progress: "Task progress",
  task_templates: "Task templates",
  va_statistics: "VA statistics",
  sops: "SOPs / training",
  pdf_maker: "PDF Maker",
  spotcheck: "Spot checks",
  winner_videos: "Winner videos",
  winner_sourcing: "Approved Ideas",
  creative_scripts: "Creative scripts",
  filming: "Filming",
  editing: "Editing",
  icloud_management: "iCloud management",
  daily_review: "Daily review",
  content: "Content",
  "spin-wheel": "Spin wheel",
  notifications: "Notifications",
  "custom-requests": "Custom requests",
  "weekly-program": "Weekly program",
  chatter_program: "Chatter program",
  va_program: "VA program",
  payments: "Payments",
  settings: "Settings",
  roles: "Roles & permissions",
  feedback: "Feedback",
  informations: "Informations",
  pricing: "Pricing",
  "mass-lists": "Mass lists",
  "link-pages": "Link pages",
  video_transcribe: "Transcript videos",
  blur_tool: "Blur tool",
  my_profiles: "My profiles",
  activity_logs: "Activity logs",
  credentials: "Credentials vault",
};

function humanizePermissionSegment(segment: string): string {
  if (ACTION_LABELS[segment]) return ACTION_LABELS[segment];
  return segment
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Human-readable label for each permission string. */
export const PERMISSION_LABELS: Record<Permission, string> = Object.fromEntries(
  ALL_PERMISSIONS.map((p) => {
    const [category, action] = p.split(":");
    const catLabel = PERMISSION_CATEGORY_LABELS[category] ?? humanizePermissionSegment(category);
    const actLabel = humanizePermissionSegment(action ?? p);
    return [p, `${catLabel} — ${actLabel}`];
  })
) as Record<Permission, string>;

/** Short Greek descriptions of what each permission allows. */
export const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  "billing:view": "Προβολή κύκλων χρέωσης και εσόδων",
  "billing:manage": "Δημιουργία και διαχείριση κύκλων χρέωσης",

  "accounts:view": "Προβολή λογαριασμών χρηστών συστήματος",
  "accounts:create": "Δημιουργία νέων λογαριασμών χρηστών",
  "accounts:edit": "Επεξεργασία στοιχείων λογαριασμών χρηστών",
  "accounts:delete": "Διαγραφή λογαριασμών χρηστών συστήματος",
  "accounts:reset-password": "Επαναφορά κωδικού πρόσβασης χρηστών",

  "earnings:view": "Προβολή απολογισμών και κερδών",
  "earnings:config": "Ρύθμιση κανόνων υπολογισμού κερδών",

  "infloww_stats:view_own": "Προβολή προσωπικών στατιστικών απόδοσης Infloww (πωλήσεις / chat)",
  "infloww_stats:view_all": "Προβολή στατιστικών απόδοσης Infloww για όλους τους chatters",

  "mistakes:view": "Προβολή σφαλμάτων και μητρώου λαθών",
  "mistakes:manage": "Καταχώρηση και διαχείριση σφαλμάτων χειριστών",
  "mistakes:reasons-manage": "Διαχείριση αιτιών και κατηγοριών σφαλμάτων",

  "challenges:view": "Προβολή προκλήσεων και προόδου συμμετεχόντων",
  "challenges:manage": "Δημιουργία και διαχείριση προκλήσεων",

  "rewards:view": "Προβολή ανταμοιβών και σημείων",
  "rewards:config": "Ρύθμιση κανόνων και επιπέδων ανταμοιβών",
  "rewards:manage": "Απονομή και διαχείριση ανταμοιβών χρηστών",

  "shifts:view": "Προβολή βαρδιών και ιστορικού ωραρίου",
  "shifts:manage": "Προγραμματισμός και διαχείριση βαρδιών",
  "shifts:start": "Έναρξη και τερματισμός δικής βάρδιας",
  "shifts:active-view": "Προβολή ενεργών βαρδιών σε πραγματικό χρόνο",

  "fines:view": "Προβολή προστίμων και μπόνους",
  "fines:manage": "Καταχώρηση προστίμων και μπόνους χρηστών",
  "fines:review": "Έγκριση ή απόρριψη προστίμων και μπόνους",

  "models:view": "Προβολή προφίλ και στοιχείων μοντέλων",
  "models:manage": "Δημιουργία και επεξεργασία μοντέλων",
  "models:schedules": "Διαχείριση προγράμματος βαρδιών μοντέλων",
  "models:availability": "Διαχείριση διαθεσιμότητας μοντέλων ανά εβδομάδα",

  "clients:view": "Προβολή στοιχείων και συμβολαίων πελατών",
  "clients:manage": "Δημιουργία και διαχείριση πελατών",

  "whales:view": "Προβολή πελατών-φάλαινων και ιστορικού",
  "whales:manage": "Επεξεργασία δεδομένων πελατών-φάλαινων",
  "whales:assign": "Ανάθεση φάλαινων σε χειριστές",

  "marketing:view": "Προβολή καμπανιών και λογαριασμών marketing",
  "marketing:manage": "Δημιουργία και διαχείριση marketing εργαλείων",
  "marketing:shadowban-report": "Αναφορά και καταγραφή shadowban περιστατικών",

  "instagram_insights:view": "Προβολή Instagram Insights (ClarioSuite) ανά μοντέλο",

  "va-tasks:view": "Προβολή εργασιών εικονικού βοηθού",
  "va-tasks:manage": "Δημιουργία και επεξεργασία εργασιών VA",
  "va-tasks:assign": "Ανάθεση εργασιών σε εικονικούς βοηθούς",
  "task_progress:view": "Προβολή συνολικής προόδου εργασιών VA (Progress Overview)",
  "task_templates:manage": "Δημιουργία και διαχείριση προτύπων εργασιών VA",
  "va_statistics:view": "Προβολή ιστορικών στατιστικών απόδοσης VA (εργασίες / βάρδιες)",

  "sops:view": "Προβολή οδηγιών και εκπαιδευτικού υλικού",
  "sops:manage": "Δημιουργία και επεξεργασία οδηγιών SOP",
  "sops:sign-off": "Επιβεβαίωση αποδοχής οδηγιών SOP",
  "sops:quiz": "Συμμετοχή σε κουίζ εκπαίδευσης SOP",

  "pdf_maker:manage": "Δημιουργία και διαχείριση εγγράφων PDF",

  "spotcheck:submit": "Υποβολή spot check ευρημάτων QA marketing",
  "spotcheck:manage": "Διαχείριση και προβολή όλων των spot checks marketing",

  "winner_videos:submit": "Υποβολή winner video tracking submissions",
  "winner_videos:manage": "Διαχείριση και έγκριση winner video submissions",

  "winner_sourcing:submit": "Υποβολή Winner/Super Winner και συμπλήρωση recreate slots σε bunches",
  "winner_sourcing:manage": "Διαχείριση Approved Ideas hub, queue και video bunches",

  "creative_scripts:submit": "Συγγραφή scripts για approved winner videos",
  "creative_scripts:manage": "Έλεγχος, επεξεργασία και έγκριση creative scripts",

  "filming:view_assignments": "Προβολή ανατεθειμένων bunches/scripts προς γύρισμα (Shoot Assignments)",
  "filming:manage": "Ανάθεση bunches σε filmers και διαχείριση ημερολογίου γυρισμάτων",

  "editing:view_assignments": "Προβολή ανατεθειμένων bunches προς επεξεργασία (Edit Assignments)",
  "editing:manage": "Ανάθεση bunches σε editors μετά το upload γυρίσματος",

  "icloud_management:view": "Οργάνωση iCloud φακέλων για bunches μετά το editing upload",
  "icloud_management:manage": "Διαχείριση iCloud οργάνωσης και material runway alerts",

  "daily_review:submit": "Υποβολή ημερήσιας αξιολόγησης marketing εποπτείας",
  "daily_review:manage": "Διαχείριση ημερήσιων αξιολογήσεων και exec audits marketing",

  "content:view": "Προβολή αιτημάτων και ημερολογίου περιεχομένου",
  "content:manage": "Διαχείριση αιτημάτων και περιεχομένου μοντέλων",
  "content:assign": "Ανάθεση εργασιών περιεχομένου σε VA",

  "spin-wheel:view": "Προβολή τροχού τύχης και αποτελεσμάτων",
  "spin-wheel:manage": "Ρύθμιση βραβείων και τροχού τύχης",

  "notifications:view": "Προβολή ειδοποιήσεων συστήματος",
  "notifications:manage": "Ρύθμιση και αποστολή ειδοποιήσεων",
  "notifications:diagnostic": "Διάγνωση προβλημάτων συστήματος ειδοποιήσεων",

  "custom-requests:view": "Προβολή αιτημάτων custom περιεχομένου",
  "custom-requests:manage": "Διαχείριση αιτημάτων custom περιεχομένου",
  "custom-requests:approve": "Έγκριση ή απόρριψη custom αιτημάτων",

  "weekly-program:view": "Προβολή εβδομαδιαίου προγράμματος βαρδιών",
  "weekly-program:manage": "Διαχείριση εβδομαδιαίου προγράμματος βαρδιών",

  "chatter_program:view": "Προβολή εβδομαδιαίου προγράμματος chatters",
  "chatter_program:manage": "Δημιουργία και επεξεργασία προγράμματος chatters",
  "va_program:view": "Προβολή εβδομαδιαίου προγράμματος VA",
  "va_program:manage": "Δημιουργία και επεξεργασία προγράμματος VA",

  "payments:view": "Προβολή πληρωμών και ιστορικού",
  "payments:submit": "Υποβολή πληρωμών και στοιχείων πελατών",
  "payments:manage": "Διαχείριση και επιβεβαίωση πληρωμών",

  "settings:view": "Προβολή ρυθμίσεων συστήματος",
  "settings:manage": "Αλλαγή γενικών ρυθμίσεων συστήματος",

  "roles:view": "Προβολή ρόλων και δικαιωμάτων",
  "roles:manage": "Δημιουργία και επεξεργασία ρόλων",

  "feedback:view": "Προβολή ανατροφοδότησης χρηστών",
  "feedback:manage": "Διαχείριση και απάντηση ανατροφοδότησης",

  "informations:view": "Προβολή mass lists, model tiers και pricing",
  "informations:manage": "Δημιουργία και επεξεργασία mass lists, model tiers και pricing",

  "pricing:view": "Προβολή τιμολογίου υπηρεσιών και πακέτων",
  "pricing:manage": "Ρύθμιση τιμών και πακέτων υπηρεσιών",

  "mass-lists:view": "Προβολή μαζικών λιστών επικοινωνίας",
  "mass-lists:manage": "Δημιουργία και διαχείριση μαζικών λιστών",

  "link-pages:view": "Προβολή link-in-bio σελίδων",
  "link-pages:manage": "Δημιουργία και διαχείριση link-in-bio σελίδων",

  "video_transcribe:access": "Μεταγραφή βίντεο σε κείμενο (upload + transcript)",

  "blur_tool:access": "Πρόσβαση στο εργαλείο θολώματος εικόνων (blur tool)",

  "my_profiles:view": "Προβολή ανατεθειμένων μοντέλων, λογαριασμών και τηλεφώνων VA",

  "activity_logs:view": "Προβολή αρχείου καταγραφής δραστηριότητας συστήματος",

  "credentials:view": "Προβολή κρυπτογραφημένου θησαυροφυλακίου credentials (masked, reveal/copy με audit)",
  "credentials:manage": "Δημιουργία, επεξεργασία, διαγραφή credentials και προβολή audit log",
};

export type PermissionGroup = {
  key: string;
  label: string;
  permissions: Permission[];
};

/** Group all permissions by resource prefix for the roles editor UI. */
export function getPermissionGroups(): PermissionGroup[] {
  const byCategory = new Map<string, Permission[]>();
  for (const p of ALL_PERMISSIONS) {
    const [cat] = p.split(":");
    if (!cat) continue;
    const list = byCategory.get(cat) ?? [];
    list.push(p);
    byCategory.set(cat, list);
  }
  return [...byCategory.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, permissions]) => ({
      key,
      label: PERMISSION_CATEGORY_LABELS[key] ?? humanizePermissionSegment(key),
      permissions: [...permissions].sort(),
    }));
}

const MANAGER_EXCLUDED: Permission[] = [
  PERMISSIONS.ROLES_MANAGE,
  PERMISSIONS.ACCOUNTS_DELETE,
  PERMISSIONS.EARNINGS_CONFIG,
  PERMISSIONS.NOTIFICATIONS_DIAGNOSTIC,
  PERMISSIONS.REWARDS_CONFIG,
  PERMISSIONS.MISTAKES_REASONS_MANAGE,
  // Opt-in tool access — grant per role via Roles UI; not an implicit manager default.
  PERMISSIONS.VIDEO_TRANSCRIBE_ACCESS,
  PERMISSIONS.CREDENTIALS_VIEW,
  PERMISSIONS.CREDENTIALS_MANAGE,
];

const CHATTER_PERMISSIONS: Permission[] = [
  PERMISSIONS.SHIFTS_START,
  PERMISSIONS.SHIFTS_VIEW,
  PERMISSIONS.INFLOWW_STATS_VIEW_OWN,
  // Baseline for Informations nav (/informations) — core chatter reference data, not toggleable off.
  PERMISSIONS.INFORMATIONS_VIEW,
  PERMISSIONS.WHALES_VIEW,
  PERMISSIONS.WHALES_MANAGE,
  PERMISSIONS.CUSTOM_REQUESTS_VIEW,
  PERMISSIONS.CUSTOM_REQUESTS_MANAGE,
  PERMISSIONS.FINES_VIEW,
  PERMISSIONS.REWARDS_VIEW,
  PERMISSIONS.SOPS_VIEW,
  PERMISSIONS.SOPS_SIGN_OFF,
  PERMISSIONS.SOPS_QUIZ,
  PERMISSIONS.SPIN_WHEEL_VIEW,
  PERMISSIONS.SETTINGS_VIEW,
  // mistakes:view intentionally NOT a chatter default — chatters do not submit/record
  // mistakes (VA/admin only). Admins can still grant mistakes:view via Roles UI for
  // read-only "My mistakes" if desired. Kept out of defaults so resolveRolePermissions()
  // floor does not force it on every chatter role.
];

const VA_PERMISSIONS: Permission[] = [
  PERMISSIONS.VA_TASKS_VIEW,
  // VA mistakes submission + mistake shift feature (Mistakes nav item, /va/mistakes, /va-shift).
  PERMISSIONS.MISTAKES_VIEW,
  // Baseline for VA informations access — core reference data, not toggleable off.
  PERMISSIONS.INFORMATIONS_VIEW,
  PERMISSIONS.MARKETING_VIEW,
  PERMISSIONS.MARKETING_SHADOWBAN_REPORT,
  PERMISSIONS.CONTENT_VIEW,
  PERMISSIONS.CONTENT_MANAGE,
  PERMISSIONS.WHALES_VIEW,
  PERMISSIONS.SOPS_VIEW,
  PERMISSIONS.SOPS_SIGN_OFF,
  PERMISSIONS.SOPS_QUIZ,
  PERMISSIONS.SETTINGS_VIEW,
  // Baseline for VA weekly program admin view (/admin/weekly-program-va) — all VAs need schedule visibility.
  PERMISSIONS.VA_PROGRAM_VIEW,
  // NOTE: blur_tool:access, my_profiles:view, winner_videos:submit, winner_sourcing:submit,
  // video_transcribe:access, and similar opt-in tool permissions
  // are intentionally NOT VA defaults. Because resolveRolePermissions() unions code defaults
  // into stored perms (defaults act as a mandatory floor), any permission listed here can
  // NEVER be toggled off in the UI. Keep opt-in permissions out of VA/chatter defaults; for
  // manager, add them to MANAGER_EXCLUDED so the Airtable toggle stays authoritative.
  // winner_sourcing:* is granted to marketing-executive / researcher via Roles UI (custom roles).
  // daily_review:submit is opt-in via Roles UI only — NOT a code default for any built-in role
  // below, and must NOT be re-granted to marketing-executive (product decision).
];

const MODEL_PERMISSIONS: Permission[] = [
  PERMISSIONS.MODELS_VIEW,
  PERMISSIONS.CONTENT_VIEW,
  PERMISSIONS.SETTINGS_VIEW,
  // Own creator earnings at /model/earnings (API scopes to linked_model_id).
  PERMISSIONS.EARNINGS_VIEW,
];

const CLIENT_PERMISSIONS: Permission[] = [
  PERMISSIONS.PAYMENTS_VIEW,
  PERMISSIONS.PAYMENTS_SUBMIT,
  PERMISSIONS.CLIENTS_VIEW,
];

/** Default permission sets per role — mirrors pre-RBAC behavior. */
export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [...ALL_PERMISSIONS],
  manager: ALL_PERMISSIONS.filter((p) => !MANAGER_EXCLUDED.includes(p)),
  chatter: CHATTER_PERMISSIONS,
  virtual_assistant: VA_PERMISSIONS,
  model: MODEL_PERMISSIONS,
  client: CLIENT_PERMISSIONS,
};
