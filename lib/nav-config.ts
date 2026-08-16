/**
 * Single source of truth for dashboard navigation.
 * Desktop (sidebar) and mobile (bottom tabs + More sheet) both use this config.
 * Same items, same order, same role-based visibility for all viewports.
 *
 * Hidden items: Airtable `system_settings` key `hidden_nav_items` (JSON per profile); see parseHiddenNavSettingJson / getNavItemsForRole.
 * `virtual_assistant` may be a flat string[] (legacy) or `{ chatting, marketing, both }` for per-va_type visibility.
 */

import { ROUTES } from "@/lib/routes";
import { PERMISSIONS, type Permission } from "@/lib/permissions";
import type { VaType } from "@/types";

/** Keys in stored JSON — admin + manager share `admin`. */
export type NavStorageProfile = "chatter" | "virtual_assistant" | "admin" | "model";

export type VaTypeNavKey = "chatting" | "marketing" | "both";

/** Per-va_type hidden href lists stored under `virtual_assistant` when extended. */
export type VaHiddenNavByType = Record<VaTypeNavKey, string[]>;

/** Default: nothing hidden for any profile (matches stored JSON shape). */
export const EMPTY_HIDDEN_NAV_BY_PROFILE: Record<NavStorageProfile, string[]> = {
  chatter: [],
  virtual_assistant: [],
  admin: [],
  model: [],
};

export const EMPTY_VA_HIDDEN_BY_TYPE: VaHiddenNavByType = {
  chatting: [],
  marketing: [],
  both: [],
};

export type ParsedHiddenNavConfig = {
  byProfile: Record<NavStorageProfile, string[]>;
  /** Set when `virtual_assistant` JSON value is an object with per-type lists. */
  vaByType: VaHiddenNavByType | null;
};

function parseStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

/** Parse `setting_value` JSON from system_settings `hidden_nav_items`. */
export function parseHiddenNavSettingJson(raw: string | null | undefined): ParsedHiddenNavConfig {
  const empty: ParsedHiddenNavConfig = {
    byProfile: { ...EMPTY_HIDDEN_NAV_BY_PROFILE },
    vaByType: null,
  };
  if (raw == null || String(raw).trim() === "") {
    return empty;
  }
  try {
    const parsed = JSON.parse(String(raw)) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return empty;
    }
    const record = parsed as Record<string, unknown>;
    const byProfile = { ...EMPTY_HIDDEN_NAV_BY_PROFILE };
    for (const k of Object.keys(byProfile) as NavStorageProfile[]) {
      if (k === "virtual_assistant") continue;
      byProfile[k] = parseStringArray(record[k]);
    }
    const vaRaw = record.virtual_assistant;
    let vaByType: VaHiddenNavByType | null = null;
    if (Array.isArray(vaRaw)) {
      byProfile.virtual_assistant = parseStringArray(vaRaw);
    } else if (typeof vaRaw === "object" && vaRaw !== null) {
      const vaObj = vaRaw as Record<string, unknown>;
      vaByType = {
        chatting: parseStringArray(vaObj.chatting),
        marketing: parseStringArray(vaObj.marketing),
        both: parseStringArray(vaObj.both),
      };
    }
    return { byProfile, vaByType };
  } catch {
    return empty;
  }
}

/** Serialize parsed config back to the stored JSON shape. */
export function serializeHiddenNavConfig(config: ParsedHiddenNavConfig): string {
  const out: Record<string, unknown> = {
    chatter: config.byProfile.chatter,
    admin: config.byProfile.admin,
    model: config.byProfile.model,
  };
  if (config.vaByType) {
    out.virtual_assistant = config.vaByType;
  } else {
    out.virtual_assistant = config.byProfile.virtual_assistant;
  }
  return JSON.stringify(out);
}

/**
 * Hidden hrefs for a VA by `va_type`.
 * Legacy (flat `virtual_assistant` array): same list for all types.
 * Extended: per-type lists; `both` users use UNION visibility (hidden only if hidden in BOTH chatting AND marketing).
 * Null `va_type` (legacy users): nothing hidden — safe default.
 */
export function getHiddenNavForVaType(
  vaType: VaType | null | undefined,
  config: ParsedHiddenNavConfig
): string[] {
  if (vaType == null) return [];
  if (!config.vaByType) {
    return config.byProfile.virtual_assistant;
  }
  const { chatting, marketing } = config.vaByType;
  if (vaType === "chatting") return chatting;
  if (vaType === "marketing") return marketing;
  const marketingSet = new Set(marketing);
  return chatting.filter((h) => marketingSet.has(h));
}

/** Resolve hidden nav hrefs for the active session role (va_type-aware for virtual_assistant). */
export function resolveHiddenNavItemsForSession(
  role: NavRoleKey,
  config: ParsedHiddenNavConfig,
  vaType?: VaType | null
): string[] {
  if (role !== "virtual_assistant") {
    const profile = navStorageProfileForRole(role);
    return config.byProfile[profile] ?? [];
  }
  return getHiddenNavForVaType(vaType, config);
}

/** Effective hidden set for `both`-type VAs (intersection of chatting + marketing hidden lists). */
export function getBothTypeHiddenNavPreview(config: VaHiddenNavByType): string[] {
  const marketingSet = new Set(config.marketing);
  return config.chatting.filter((h) => marketingSet.has(h));
}

export type NavIconKey =
  | "Home"| "Calendar"| "CalendarCheck"| "PlayCircle"| "FileText"| "Users"| "Receipt"| "Wrench"| "Radio"| "UserCheck"| "Activity"| "Package"| "UserCog"| "LayoutDashboard"| "ListTodo"| "Settings"| "Sparkles"| "Trophy"| "Target"| "LineChart"| "CalendarDays"| "CalendarClock"| "Clock"| "MessageSquarePlus"| "ImageOff"| "AlertTriangle"| "AlertCircle"| "Settings2"| "Coins"| "TrendingUp"| "Info"| "CreditCard"| "BookOpen"| "Link2"| "FolderOpen";

/** Active state for a nav href: exact match, or prefix only if no longer href in the set also matches. */
export function navHrefIsActive(pathname: string, href: string, allHrefs: readonly string[]): boolean {
  if (pathname === href) return true;
  if (href === "/" || !pathname.startsWith(`${href}/`)) return false;
  return !allHrefs.some(
    (o) => o !== href && o.length > href.length && (pathname === o || pathname.startsWith(`${o}/`))
  );
}

export type NavItem = {
  href: string;
  label: string;
  iconKey: NavIconKey;
  /** When true, item is non-navigable (e.g. coming soon). */
  disabled?: boolean;
  /** Small pill next to label (e.g. "Coming soon"). */
  badge?: string;
  beta?: boolean;
  /** If true, only `admin` role sees this link (managers use the same admin nav profile but skip these). */
  adminOnly?: boolean;
  /** When set, item is hidden unless the user has this permission. */
  requiresPermission?: Permission;
  /** When set, item is shown if the user has any of these permissions. */
  requiresAnyPermission?: Permission[];
  /**
   * When set, item is hidden if the user HAS this permission.
   * Used to dedupe submit-only nav items for users who also have the manage permission
   * (they see the richer MANAGER REVIEW item instead).
   */
  hiddenIfPermission?: Permission;
  /** When set, item is hidden if the user has any of these permissions. */
  hiddenIfAnyPermission?: Permission[];
  /** When true, item never fills a mobile bottom-bar slot (stays in the More sheet only). */
  excludeFromMobileMainTabs?: boolean;
  /**
   * When set, a non-interactive section label is rendered above this item (admin sidebar + mobile More list).
   * Omitted on all other items; change the string to start a new group.
   */
  navSection?: string;
  /**
   * Chatter mobile bottom bar: center tab uses FAB-style pink gradient + custom icon (see `MobileAppShell`).
   * `iconKey` is still used for sidebar / More menu.
   */
  isShiftButton?: boolean;
};

/**
 * Canonical category ORDER shared by EVERY role's nav (system + custom).
 *
 * Each nav item declares its `navSection` once at its definition site; the sidebar and
 * mobile More sheet both group permission-matched items by that label and render the
 * groups in THIS order, skipping empty categories. This is what makes any role's nav —
 * including a brand-new custom role with an arbitrary permission mix — well-organized by
 * construction rather than a flat/jumbled list.
 *
 * Admin's original relative ordering (OVERVIEW → TEAM → CREATORS → CONTENT → MARKETING →
 * REVIEW & QA → FINANCE → REWARDS → TOOLS → SETTINGS) is preserved; role-specific sections
 * (TASKS, WORK, REQUESTS, INFO) are interleaved at sensible positions. Sections a given role
 * never populates are simply skipped.
 */
export const NAV_SECTION_ORDER = [
  "OVERVIEW",
  "TEAM",
  "TASKS",
  "WORK",
  "CREATORS",
  "CONTENT",
  "MARKETING",
  "REQUESTS",
  "REVIEW & QA",
  "FINANCE",
  "INFO",
  "REWARDS",
  "TOOLS",
  "SETTINGS",
] as const;

/** Fallback bucket for any item missing a `navSection` (should not happen — every item defines one). */
export const NAV_SECTION_FALLBACK = "OTHER";

/**
 * Group nav items by their predefined `navSection`, ordered by {@link NAV_SECTION_ORDER}.
 * Within a section, items keep their source order. Empty sections are skipped; any unknown
 * section (or items with no `navSection`) is appended after the canonical ones so nothing is lost.
 * Shared by the desktop sidebar and the mobile More sheet so all viewports group identically.
 */
export function groupNavItemsBySection(items: NavItem[]): { section: string; items: NavItem[] }[] {
  const map = new Map<string, NavItem[]>();
  for (const item of items) {
    const section = item.navSection ?? NAV_SECTION_FALLBACK;
    const list = map.get(section) ?? [];
    list.push(item);
    map.set(section, list);
  }
  const ordered: { section: string; items: NavItem[] }[] = [];
  for (const section of NAV_SECTION_ORDER) {
    const sectionItems = map.get(section);
    if (sectionItems?.length) ordered.push({ section, items: sectionItems });
    map.delete(section);
  }
  for (const [section, sectionItems] of map) {
    if (sectionItems.length) ordered.push({ section, items: sectionItems });
  }
  return ordered;
}

export type NavRole = "chatter" | "virtual_assistant" | "admin" | "manager" | "model";

const SYSTEM_NAV_ROLES = new Set<string>([
  "admin",
  "manager",
  "chatter",
  "virtual_assistant",
  "model",
  "client",
]);

/** Session role slug — system roles or a custom role_id from Airtable. */
export type NavRoleKey = NavRole | (string & {});

export function isSystemNavRole(role: string): boolean {
  return SYSTEM_NAV_ROLES.has(role.trim().toLowerCase());
}

export function isCustomNavRole(role: string): boolean {
  return !isSystemNavRole(role);
}

export function navStorageProfileForRole(role: NavRoleKey): NavStorageProfile {
  const r = (typeof role === "string" ? role.toLowerCase() : "") as NavRole;
  if (r === "admin" || r === "manager") return "admin";
  if (!isSystemNavRole(r)) return "admin";
  if (r === "virtual_assistant") return "virtual_assistant";
  if (r === "model") return "model";
  return "chatter";
}

/**
 * Core destinations — settings stays in More menu on mobile (not bottom tabs).
 * Grouped by `navSection` (see NAV_SECTION_ORDER): OVERVIEW (home/schedule/shift),
 * WORK (whales/rebills/mistakes), FINANCE, INFO (informations/SOPs), REWARDS, SETTINGS.
 */
const chatterNav: NavItem[] = [
  // ── OVERVIEW ──
  { href: ROUTES.chatter.home, label: "Home", iconKey: "Home", navSection: "OVERVIEW" },
  { href: ROUTES.chatter.weeklyProgram, label: "Weekly program", iconKey: "Calendar", navSection: "OVERVIEW" },
  {
    href: ROUTES.chatter.shift,
    label: "Shift",
    iconKey: "PlayCircle",
    isShiftButton: true,
    navSection: "OVERVIEW",
  },

  // ── WORK ──
  { href: ROUTES.chatter.myWhales, label: "My whales", iconKey: "Users", beta: true, navSection: "WORK" },
  { href: ROUTES.chatter.myRebills, label: "My rebills", iconKey: "TrendingUp", excludeFromMobileMainTabs: true, navSection: "WORK" },
  { href: ROUTES.chatter.mistakes, label: "My mistakes", iconKey: "AlertCircle", excludeFromMobileMainTabs: true, navSection: "WORK", requiresPermission: PERMISSIONS.MISTAKES_VIEW },
  {
    href: ROUTES.chatter.myPerformance,
    label: "My Performance",
    iconKey: "LineChart",
    excludeFromMobileMainTabs: true,
    navSection: "WORK",
    requiresPermission: PERMISSIONS.INFLOWW_STATS_VIEW_OWN,
  },

  // ── FINANCE ──
  { href: ROUTES.finesBonuses, label: "Fines & Bonuses", iconKey: "Coins", excludeFromMobileMainTabs: true, navSection: "FINANCE" },

  // ── INFO ──
  {
    href: ROUTES.chatter.informations,
    label: "Informations",
    iconKey: "Info",
    excludeFromMobileMainTabs: true,
    navSection: "INFO",
    requiresPermission: PERMISSIONS.INFORMATIONS_VIEW,
  },
  { href: ROUTES.sops, label: "SOPs / Training", iconKey: "BookOpen", excludeFromMobileMainTabs: true, navSection: "INFO" },

  // ── REWARDS ──
  { href: ROUTES.chatter.rewards, label: "Rewards", iconKey: "Trophy", excludeFromMobileMainTabs: true, navSection: "REWARDS" },
  { href: ROUTES.chatter.challenges, label: "Challenges", iconKey: "Target", excludeFromMobileMainTabs: true, navSection: "REWARDS" },

  // ── SETTINGS ──
  { href: ROUTES.settings, label: "Settings", iconKey: "Settings", excludeFromMobileMainTabs: true, navSection: "SETTINGS" },
];

/**
 * VA nav grouped by `navSection`: OVERVIEW (home/schedules/availability), TASKS (VA tasks,
 * whales, content, customs), INFO (SOPs), FINANCE, SETTINGS. MARKETING and TOOLS items
 * (Marketing, Blur tool, My Profiles, Transcript Videos) arrive via `sharedPermissionNavItems`.
 */
const vaNav: NavItem[] = [
  // ── OVERVIEW ──
  { href: ROUTES.va.home, label: "Home", iconKey: "Home", navSection: "OVERVIEW" },
  { href: ROUTES.va.schedule, label: "My schedule", iconKey: "Calendar", navSection: "OVERVIEW" },
  { href: ROUTES.va.scheduleOverview, label: "Schedule overview", iconKey: "CalendarDays", navSection: "OVERVIEW" },
  { href: ROUTES.va.weeklyAvailability, label: "My weekly availability", iconKey: "CalendarCheck", navSection: "OVERVIEW" },

  // ── TASKS ──
  { href: ROUTES.va.tasks, label: "Tasks", iconKey: "ListTodo", navSection: "TASKS" },
  { href: ROUTES.va.whales, label: "Whales", iconKey: "Users", navSection: "TASKS" },
  { href: ROUTES.va.contentAssignments, label: "Chatting Content", iconKey: "FileText", navSection: "TASKS" },
  { href: ROUTES.va.customRequests, label: "Custom requests", iconKey: "Package", navSection: "TASKS" },
  // NOTE: "Mistakes" (MISTAKES_VIEW) moved to `sharedPermissionNavItems` so the VA mistakes
  // feature is gated by a permission and can be toggled per role in Roles & Permissions.

  // ── MARKETING ──
  // NOTE: "Marketing" (MARKETING_VIEW) moved to `sharedPermissionNavItems` so the VA-facing
  // marketing page is gated by permission and can be toggled per role in Roles & Permissions.
  // Admins still hide it for the `chatting` va_type via hidden_nav (getHiddenNavForVaType).

  // ── INFO ──
  // NOTE: "Blur tool" (BLUR_TOOL_ACCESS) moved to `sharedPermissionNavItems`.
  { href: ROUTES.sops, label: "SOPs / Training", iconKey: "BookOpen", excludeFromMobileMainTabs: true, navSection: "INFO" },

  // ── FINANCE ──
  { href: ROUTES.finesBonuses, label: "Fines & Bonuses", iconKey: "Coins", excludeFromMobileMainTabs: true, navSection: "FINANCE" },

  // ── SETTINGS ──
  { href: ROUTES.settings, label: "Settings", iconKey: "Settings", navSection: "SETTINGS" },
];

const adminNav: NavItem[] = [
  // ── OVERVIEW ──
  { href: ROUTES.admin.home, label: "Home", iconKey: "Home", navSection: "OVERVIEW" },
  {
    href: ROUTES.admin.liveShifts,
    label: "Live shifts",
    iconKey: "Radio",
    navSection: "OVERVIEW",
    requiresPermission: PERMISSIONS.SHIFTS_ACTIVE_VIEW,
  },
  {
    href: ROUTES.admin.shiftActivity,
    label: "Shift activity",
    iconKey: "Clock",
    navSection: "OVERVIEW",
    requiresPermission: PERMISSIONS.SHIFTS_VIEW,
  },
  {
    href: ROUTES.admin.modelSchedulesOverview,
    label: "Schedule overview",
    iconKey: "CalendarDays",
    navSection: "OVERVIEW",
    requiresPermission: PERMISSIONS.MODELS_SCHEDULES,
  },

  // ── TEAM ──
  // Staff management + team programs. NOTE: "Accounts" and the weekly programs live in
  // `sharedPermissionNavItems` (also TEAM section) so any role granted the permission — not
  // just admin — surfaces the link, matching each page's bare hasPermission guard.
  {
    href: ROUTES.admin.vaTasks,
    label: "Tasks",
    iconKey: "ListTodo",
    navSection: "TEAM",
    requiresAnyPermission: [PERMISSIONS.VA_TASKS_MANAGE, PERMISSIONS.TASK_PROGRESS_VIEW],
  },
  {
    href: ROUTES.admin.taskTemplates,
    label: "Task Templates",
    // D3: distinct icon from "Tasks" (ListTodo) so the two are not confused in the sidebar.
    iconKey: "LayoutDashboard",
    navSection: "TEAM",
    requiresPermission: PERMISSIONS.TASK_TEMPLATES_MANAGE,
  },

  // ── CREATORS ──
  // Everything centered on the models/clients themselves + their scheduling and assets.
  {
    href: ROUTES.admin.models,
    label: "Models",
    iconKey: "UserCheck",
    navSection: "CREATORS",
    requiresPermission: PERMISSIONS.MODELS_VIEW,
  },
  {
    href: ROUTES.admin.modelAvailability,
    label: "Model availability",
    iconKey: "CalendarCheck",
    navSection: "CREATORS",
    requiresPermission: PERMISSIONS.MODELS_AVAILABILITY,
  },
  {
    href: ROUTES.admin.modelSchedules,
    label: "Model schedules",
    iconKey: "Calendar",
    navSection: "CREATORS",
    requiresPermission: PERMISSIONS.MODELS_SCHEDULES,
  },
  {
    href: ROUTES.admin.modelTasks,
    label: "Model tasks",
    iconKey: "FileText",
    navSection: "CREATORS",
    requiresPermission: PERMISSIONS.MODELS_MANAGE,
  },
  {
    href: ROUTES.admin.modelLiveStreams,
    label: "Model live streams",
    iconKey: "Radio",
    navSection: "CREATORS",
    beta: true,
    requiresPermission: PERMISSIONS.MODELS_VIEW,
  },
  {
    href: ROUTES.admin.modelCustoms,
    label: "Model customs",
    iconKey: "Package",
    navSection: "CREATORS",
    requiresPermission: PERMISSIONS.CUSTOM_REQUESTS_VIEW,
  },
  {
    href: ROUTES.admin.linkPages,
    label: "Link pages",
    iconKey: "Link2",
    navSection: "CREATORS",
    requiresPermission: PERMISSIONS.LINK_PAGES_VIEW,
  },
  {
    href: ROUTES.admin.credentialsVault,
    label: "Password Library",
    iconKey: "Settings2",
    navSection: "TOOLS",
    requiresPermission: PERMISSIONS.CREDENTIALS_VIEW,
  },
  {
    href: ROUTES.admin.clients,
    label: "Clients",
    iconKey: "Users",
    navSection: "CREATORS",
    requiresPermission: PERMISSIONS.CLIENTS_VIEW,
  },
  {
    href: ROUTES.admin.whales,
    label: "Whales",
    iconKey: "Users",
    navSection: "CREATORS",
    requiresPermission: PERMISSIONS.WHALES_MANAGE,
  },

  // ── CONTENT ──
  // NOTE: "PDF Maker" / "Transcript Videos" (utilities) live in `sharedPermissionNavItems`
  // under TOOLS; Fill Bunches + creative scripts also live there under CONTENT.
  {
    href: ROUTES.admin.vaContentAssignments,
    label: "Chatting Content",
    iconKey: "FileText",
    navSection: "CONTENT",
    requiresPermission: PERMISSIONS.CONTENT_ASSIGN,
  },
  {
    href: ROUTES.admin.modelContentRequests,
    label: "Model content requests",
    iconKey: "FileText",
    navSection: "CONTENT",
    requiresPermission: PERMISSIONS.CONTENT_VIEW,
  },
  {
    href: ROUTES.admin.winnerVideos,
    label: "Content Q/A",
    iconKey: "ListTodo",
    navSection: "CONTENT",
    requiresPermission: PERMISSIONS.WINNER_VIDEOS_MANAGE,
  },
  {
    href: ROUTES.admin.winnerVideosHub,
    label: "Winner Videos",
    iconKey: "Trophy",
    navSection: "CONTENT",
    requiresPermission: PERMISSIONS.WINNER_SOURCING_MANAGE,
  },
  {
    href: ROUTES.admin.bunches,
    label: "Bunches",
    iconKey: "FolderOpen",
    navSection: "CONTENT",
    requiresPermission: PERMISSIONS.WINNER_SOURCING_MANAGE,
  },
  {
    href: ROUTES.admin.sopLibrary,
    label: "SOP Library",
    iconKey: "BookOpen",
    navSection: "CONTENT",
    requiresPermission: PERMISSIONS.SOPS_MANAGE,
  },

  // ── MARKETING ──
  {
    href: ROUTES.admin.marketing,
    label: "Marketing",
    iconKey: "TrendingUp",
    navSection: "MARKETING",
    requiresPermission: PERMISSIONS.MARKETING_MANAGE,
  },
  {
    href: ROUTES.admin.instagramInsights,
    label: "Instagram Insights",
    iconKey: "LineChart",
    navSection: "MARKETING",
    requiresPermission: PERMISSIONS.INSTAGRAM_INSIGHTS_VIEW,
  },
  {
    href: ROUTES.admin.informations,
    label: "Informations",
    iconKey: "Info",
    navSection: "MARKETING",
    requiresPermission: PERMISSIONS.INFORMATIONS_VIEW,
  },

  // ── REVIEW & QA ──
  // Manage-tier supervision + mistakes review. The matching SUBMIT-tier items live in
  // `sharedPermissionNavItems` (also REVIEW & QA); `hiddenIfPermission` dedupes users who
  // hold the manage grant so they see this richer review item instead of the submit item.
  {
    href: ROUTES.admin.spotChecks,
    label: "Spot checks",
    iconKey: "ListTodo",
    navSection: "REVIEW & QA",
    requiresPermission: PERMISSIONS.SPOTCHECK_MANAGE,
  },
  {
    href: ROUTES.admin.dailyReview,
    label: "Daily review",
    iconKey: "CalendarCheck",
    navSection: "REVIEW & QA",
    requiresPermission: PERMISSIONS.DAILY_REVIEW_MANAGE,
  },
  {
    href: ROUTES.admin.mistakes,
    label: "Mistakes",
    iconKey: "AlertTriangle",
    navSection: "REVIEW & QA",
    requiresPermission: PERMISSIONS.MISTAKES_VIEW,
  },
  {
    href: ROUTES.admin.mistakeReasons,
    label: "Mistake reasons",
    iconKey: "Settings2",
    navSection: "REVIEW & QA",
    adminOnly: true,
    requiresPermission: PERMISSIONS.MISTAKES_REASONS_MANAGE,
  },

  // ── FINANCE ──
  {
    href: ROUTES.admin.billing,
    label: "Billing",
    iconKey: "Receipt",
    navSection: "FINANCE",
    requiresPermission: PERMISSIONS.BILLING_VIEW,
  },
  {
    href: ROUTES.admin.customRequests,
    label: "Custom requests",
    iconKey: "Receipt",
    navSection: "FINANCE",
    requiresPermission: PERMISSIONS.CUSTOM_REQUESTS_VIEW,
  },
  {
    href: ROUTES.admin.rebillsTips,
    label: "Rebills & Tips",
    iconKey: "Receipt",
    navSection: "FINANCE",
    requiresPermission: PERMISSIONS.BILLING_VIEW,
  },
  {
    href: ROUTES.admin.finesBonuses,
    label: "Fines & Bonuses",
    iconKey: "Coins",
    navSection: "FINANCE",
    requiresPermission: PERMISSIONS.FINES_VIEW,
  },
  {
    href: ROUTES.admin.expenseRequests,
    label: "Expense requests",
    iconKey: "Receipt",
    navSection: "FINANCE",
    requiresPermission: PERMISSIONS.PAYMENTS_MANAGE,
  },
  {
    href: ROUTES.admin.paymentMethods,
    label: "Payment Methods",
    iconKey: "CreditCard",
    navSection: "FINANCE",
    requiresPermission: PERMISSIONS.PAYMENTS_MANAGE,
  },
  {
    href: ROUTES.admin.submissions,
    label: "Submissions",
    iconKey: "FileText",
    navSection: "FINANCE",
    requiresPermission: PERMISSIONS.PAYMENTS_VIEW,
  },
  {
    href: ROUTES.admin.partnership,
    label: "Partnership",
    iconKey: "TrendingUp",
    navSection: "FINANCE",
    requiresPermission: PERMISSIONS.CLIENTS_VIEW,
  },
  {
    href: ROUTES.admin.earnings,
    label: "Earnings",
    iconKey: "LineChart",
    navSection: "FINANCE",
    adminOnly: true,
    requiresPermission: PERMISSIONS.EARNINGS_VIEW,
  },
  {
    href: ROUTES.admin.inflowwPerformance,
    label: "Chatter performance",
    iconKey: "TrendingUp",
    navSection: "FINANCE",
    requiresPermission: PERMISSIONS.INFLOWW_STATS_VIEW_ALL,
  },
  // Hidden from sidebar for now; route `/admin/earnings-config` still works if opened directly.
  // { href: ROUTES.admin.earningsConfig, label: "Earnings config", iconKey: "UserCog", adminOnly: true },

  // ── REWARDS ──
  // Gamification: points, rewards, challenges, spin wheel.
  {
    href: ROUTES.admin.rewards,
    label: "Rewards",
    iconKey: "Trophy",
    navSection: "REWARDS",
    requiresPermission: PERMISSIONS.REWARDS_VIEW,
  },
  {
    href: ROUTES.admin.challenges,
    label: "Challenges",
    iconKey: "Target",
    navSection: "REWARDS",
    adminOnly: true,
    requiresPermission: PERMISSIONS.CHALLENGES_MANAGE,
  },
  {
    href: ROUTES.admin.spinResults,
    label: "Spin results",
    iconKey: "Sparkles",
    navSection: "REWARDS",
    requiresPermission: PERMISSIONS.SPIN_WHEEL_VIEW,
  },
  {
    href: ROUTES.admin.rewardsConfig,
    label: "Rewards Config",
    iconKey: "Sparkles",
    navSection: "REWARDS",
    adminOnly: true,
    requiresPermission: PERMISSIONS.REWARDS_CONFIG,
  },

  // ── SETTINGS ──
  {
    href: ROUTES.admin.roles,
    label: "Roles",
    iconKey: "Settings2",
    navSection: "SETTINGS",
    adminOnly: true,
    requiresPermission: PERMISSIONS.ROLES_MANAGE,
  },
  {
    href: ROUTES.admin.feedback,
    label: "Feedback",
    iconKey: "MessageSquarePlus",
    navSection: "SETTINGS",
    requiresPermission: PERMISSIONS.FEEDBACK_VIEW,
  },
  // NOTE: "Blur tool" (BLUR_TOOL_ACCESS) moved to `sharedPermissionNavItems` (TOOLS).
  {
    href: ROUTES.settings,
    label: "Settings",
    iconKey: "Settings",
    navSection: "SETTINGS",
  },
  {
    href: ROUTES.activityLogs,
    label: "Activity logs",
    iconKey: "Activity",
    navSection: "SETTINGS",
    requiresPermission: PERMISSIONS.ACTIVITY_LOGS_VIEW,
  },
  {
    href: ROUTES.admin.notificationDiagnostic,
    label: "Notification diagnostic",
    iconKey: "Activity",
    navSection: "SETTINGS",
    adminOnly: true,
    excludeFromMobileMainTabs: true,
    requiresPermission: PERMISSIONS.NOTIFICATIONS_DIAGNOSTIC,
  },
];

/**
 * Model nav grouped by `navSection`: OVERVIEW (home/earnings/calendar/availability),
 * CONTENT (Chatting Assignments), REQUESTS (custom requests), SETTINGS. Customs / lives also on + menu.
 */
const modelNav: NavItem[] = [
  // ── OVERVIEW ──
  { href: ROUTES.model.home, label: "Home", iconKey: "Home", navSection: "OVERVIEW" },
  {
    href: ROUTES.model.myEarnings,
    label: "My earnings",
    iconKey: "LineChart",
    navSection: "OVERVIEW",
  },
  { href: ROUTES.model.contentCalendar, label: "Calendar", iconKey: "CalendarDays", navSection: "OVERVIEW" },
  { href: ROUTES.model.schedule, label: "Availability", iconKey: "CalendarClock", navSection: "OVERVIEW" },

  // ── CONTENT ──
  { href: ROUTES.model.contentAssignments, label: "Chatting Assignments", iconKey: "FileText", navSection: "CONTENT" },

  // ── REQUESTS ──
  { href: ROUTES.model.customs, label: "Custom requests", iconKey: "Package", navSection: "REQUESTS" },

  // ── SETTINGS ──
  { href: ROUTES.settings, label: "Settings", iconKey: "Settings", navSection: "SETTINGS" },
];

/**
 * Permission-gated nav items that must reach ANY role granted the underlying permission,
 * regardless of that role's base nav array (chatter/va/model/admin/manager/custom). These are
 * appended to every role's base list BEFORE permission filtering, so `requiresPermission`
 * decides show/hide. Add future permission-only shared items here.
 *
 * Covers unrelated features (submit-tier review items, creative scripts, standalone TOOLS).
 * Each item carries its own `navSection` so it renders under the correct group per viewport.
 *
 * For REVIEW & QA: only SUBMIT-tier items belong here. The manage-tier review items stay in
 * `adminNav` (also REVIEW & QA); `hiddenIfPermission` dedupes users who also hold the manage
 * grant (they see the richer manage-tier review item instead of the submit item).
 *
 * Ordered by target section (TEAM → CONTENT → REVIEW & QA → MARKETING → TOOLS) so the mobile More sheet
 * (which prints a section header whenever `navSection` changes) keeps each group contiguous.
 */
const sharedPermissionNavItems: NavItem[] = [
  // ── TEAM ──
  {
    href: ROUTES.admin.accounts,
    label: "Accounts",
    iconKey: "UserCog",
    navSection: "TEAM",
    requiresPermission: PERMISSIONS.ACCOUNTS_VIEW,
  },
  {
    href: ROUTES.admin.weeklyProgram,
    label: "Weekly program",
    iconKey: "Calendar",
    navSection: "TEAM",
    requiresPermission: PERMISSIONS.CHATTER_PROGRAM_VIEW,
  },
  {
    href: ROUTES.admin.weeklyProgramVa,
    label: "VA weekly program",
    iconKey: "CalendarCheck",
    navSection: "TEAM",
    requiresPermission: PERMISSIONS.VA_PROGRAM_VIEW,
  },
  {
    href: ROUTES.va.tasks,
    label: "Tasks",
    iconKey: "ListTodo",
    navSection: "TEAM",
    requiresPermission: PERMISSIONS.VA_TASKS_VIEW,
    // Users who can manage tasks or view Progress Overview see the admin item instead.
    hiddenIfAnyPermission: [PERMISSIONS.VA_TASKS_MANAGE, PERMISSIONS.TASK_PROGRESS_VIEW],
    excludeFromMobileMainTabs: true,
  },
  {
    href: ROUTES.admin.vaStatistics,
    label: "VA Statistics",
    iconKey: "LineChart",
    navSection: "TEAM",
    requiresPermission: PERMISSIONS.VA_STATISTICS_VIEW,
  },

  // ── CONTENT ──
  {
    href: ROUTES.winnerRecreates,
    label: "Fill Bunches",
    iconKey: "Trophy",
    navSection: "CONTENT",
    requiresPermission: PERMISSIONS.WINNER_SOURCING_SUBMIT,
    hiddenIfPermission: PERMISSIONS.WINNER_SOURCING_MANAGE,
    excludeFromMobileMainTabs: true,
  },
  {
    href: ROUTES.creativeScripts,
    label: "Scripts to Write",
    iconKey: "FileText",
    navSection: "CONTENT",
    requiresPermission: PERMISSIONS.CREATIVE_SCRIPTS_SUBMIT,
    // Users who can manage creative scripts see the admin Research review flow instead.
    hiddenIfPermission: PERMISSIONS.CREATIVE_SCRIPTS_MANAGE,
    excludeFromMobileMainTabs: true,
  },
  {
    href: ROUTES.shootAssignments,
    label: "Shoot Assignments",
    iconKey: "PlayCircle",
    navSection: "CONTENT",
    requiresPermission: PERMISSIONS.FILMING_VIEW_ASSIGNMENTS,
    hiddenIfPermission: PERMISSIONS.FILMING_MANAGE,
    excludeFromMobileMainTabs: true,
  },
  {
    href: ROUTES.filmingCalendar,
    label: "Filming Calendar",
    iconKey: "CalendarDays",
    navSection: "CONTENT",
    requiresAnyPermission: [PERMISSIONS.FILMING_VIEW_ASSIGNMENTS, PERMISSIONS.FILMING_MANAGE],
    excludeFromMobileMainTabs: true,
  },
  {
    href: ROUTES.editAssignments,
    label: "Edit Assignments",
    iconKey: "FileText",
    navSection: "CONTENT",
    requiresPermission: PERMISSIONS.EDITING_VIEW_ASSIGNMENTS,
    hiddenIfPermission: PERMISSIONS.EDITING_MANAGE,
    excludeFromMobileMainTabs: true,
  },
  {
    href: ROUTES.icloudOrganization,
    label: "iCloud Management",
    iconKey: "FolderOpen",
    navSection: "CONTENT",
    requiresPermission: PERMISSIONS.ICLOUD_MANAGEMENT_VIEW,
    // Manage holders still use this page (no per-bunch assign) — do not hide on manage.
    excludeFromMobileMainTabs: true,
  },

  // ── REVIEW & QA ──
  {
    href: ROUTES.spotChecks,
    label: "Spot Checks",
    iconKey: "ListTodo",
    navSection: "REVIEW & QA",
    requiresPermission: PERMISSIONS.SPOTCHECK_SUBMIT,
    // Users who can manage spot checks see the manage-tier review item instead.
    hiddenIfPermission: PERMISSIONS.SPOTCHECK_MANAGE,
    excludeFromMobileMainTabs: true,
  },
  {
    href: ROUTES.dailyReview,
    label: "Daily Review",
    iconKey: "CalendarCheck",
    navSection: "REVIEW & QA",
    requiresPermission: PERMISSIONS.DAILY_REVIEW_SUBMIT,
    // Users who can manage daily reviews see the manage-tier review item instead.
    hiddenIfPermission: PERMISSIONS.DAILY_REVIEW_MANAGE,
    excludeFromMobileMainTabs: true,
  },
  // VA mistakes submission ("Mistakes" → /va/mistakes). Gated by MISTAKES_VIEW so any role granted
  // it surfaces the link. Users who can MANAGE mistakes (admin/manager) see the admin
  // `/admin/mistakes` review item instead, so this VA submit link is hidden for them.
  {
    href: ROUTES.va.mistakes,
    label: "Mistakes",
    iconKey: "AlertTriangle",
    navSection: "REVIEW & QA",
    requiresPermission: PERMISSIONS.MISTAKES_VIEW,
    hiddenIfPermission: PERMISSIONS.MISTAKES_MANAGE,
    excludeFromMobileMainTabs: true,
  },

  // ── MARKETING ──
  // VA-facing Marketing (/va/marketing). Gated by MARKETING_VIEW so any role granted it
  // surfaces the link. Users who can MANAGE marketing (admin/manager) see the admin
  // `/admin/marketing` item instead, so this VA link is hidden for them.
  {
    href: ROUTES.va.marketingAccounts,
    label: "Marketing",
    iconKey: "Radio",
    navSection: "MARKETING",
    requiresPermission: PERMISSIONS.MARKETING_VIEW,
    hiddenIfPermission: PERMISSIONS.MARKETING_MANAGE,
    excludeFromMobileMainTabs: true,
  },

  // ── TOOLS ──
  {
    href: ROUTES.admin.pdfMaker,
    label: "PDF Maker",
    iconKey: "FileText",
    navSection: "TOOLS",
    requiresPermission: PERMISSIONS.PDF_MAKER_MANAGE,
    excludeFromMobileMainTabs: true,
  },
  {
    href: ROUTES.transcriptVideos,
    label: "Transcript Videos",
    iconKey: "FileText",
    navSection: "TOOLS",
    requiresPermission: PERMISSIONS.VIDEO_TRANSCRIBE_ACCESS,
    excludeFromMobileMainTabs: true,
  },
  {
    href: ROUTES.va.blurTool,
    label: "Blur tool",
    iconKey: "ImageOff",
    navSection: "TOOLS",
    requiresPermission: PERMISSIONS.BLUR_TOOL_ACCESS,
    excludeFromMobileMainTabs: true,
  },
  {
    href: ROUTES.myProfiles,
    label: "My Profiles",
    iconKey: "UserCheck",
    navSection: "TOOLS",
    requiresPermission: PERMISSIONS.MY_PROFILES_VIEW,
    excludeFromMobileMainTabs: true,
  },
];

type SharedAdminPathEntry = { path: string; permission: Permission };

/**
 * `/admin/*` paths from `sharedPermissionNavItems` — single source for middleware/layout
 * drift-safeguard (`permissionForSharedAdminPath` in va-schedule-overview-access.ts).
 */
export function getPermissionGatedSharedAdminPaths(): ReadonlyArray<SharedAdminPathEntry> {
  const paths: SharedAdminPathEntry[] = [];
  for (const item of sharedPermissionNavItems) {
    if (!item.href.startsWith("/admin/")) continue;
    if (item.requiresPermission) {
      paths.push({ path: item.href, permission: item.requiresPermission });
    }
  }
  return paths;
}

/** Append shared permission-gated items to a role's base list, skipping any already present. */
function appendSharedNavItems(base: NavItem[]): NavItem[] {
  const existing = new Set(base.map((i) => i.href));
  const shared = sharedPermissionNavItems.filter((i) => !existing.has(i.href));
  return shared.length === 0 ? base : [...base, ...shared];
}

/** Shared admin nav items shown to custom roles regardless of grants (Home, Settings, etc.). */
function getCustomRoleSharedAdminNavItems(): NavItem[] {
  return adminNav
    .filter(
      (item) =>
        !item.requiresPermission && !item.requiresAnyPermission && !item.adminOnly
    )
    .map((item) =>
      item.href === ROUTES.admin.home ? { ...item, href: ROUTES.admin.customRoleHome } : item
    );
}

/** Canonical lists before hide filter (settings UI + internal). */
export function getBaseNavItemsForRole(role: NavRoleKey): NavItem[] {
  const r = (typeof role === "string" ? role.toLowerCase() : "") as NavRole;
  // Every base list gets the shared permission-gated items appended before the caller
  // applies permission filtering, so granting e.g. spotcheck:submit surfaces the link
  // for chatter/va/model/custom roles too — not just admin.
  if (r === "chatter") return appendSharedNavItems([...chatterNav]);
  if (r === "virtual_assistant") return appendSharedNavItems([...vaNav]);
  if (r === "admin" || r === "manager") {
    const items = [...adminNav];
    if (r === "manager") return appendSharedNavItems(items.filter((i) => !i.adminOnly));
    return appendSharedNavItems(items);
  }
  if (r === "model") return appendSharedNavItems([...modelNav]);
  if (!isSystemNavRole(r)) {
    return appendSharedNavItems([
      ...adminNav.filter((item) => item.requiresPermission || item.requiresAnyPermission),
      ...getCustomRoleSharedAdminNavItems(),
    ]);
  }
  return appendSharedNavItems([{ href: ROUTES.dashboard, label: "Dashboard", iconKey: "LayoutDashboard", navSection: "OVERVIEW" }]);
}

/**
 * All nav items for the given role, minus hrefs listed in `hiddenItems` for this role’s storage profile.
 * When `hiddenItems` is omitted or empty, no items are filtered out.
 */
export function getNavItemsForRole(role: NavRoleKey, hiddenItems?: string[]): NavItem[] {
  const base = getBaseNavItemsForRole(role);
  if (hiddenItems == null || hiddenItems.length === 0) return base;
  const hidden = new Set(hiddenItems);
  return base.filter((item) => !hidden.has(item.href));
}

/** Server-side nav builder: role base list → hidden-nav filter → permission filter. */
export async function getNavItemsForUser(
  user: { role: string; secondary_role?: "chatter" | "virtual_assistant" | null; active_role?: "chatter" | "virtual_assistant" | null; va_type?: import("@/types").VaType | null },
  hiddenItems?: string[]
): Promise<NavItem[]> {
  const { getNavRoleForSession } = await import("@/lib/staff-session-role");
  const { getUserPermissions } = await import("@/lib/rbac");
  const role = getNavRoleForSession(user as import("@/lib/auth-config").AuthUser);
  const perms = await getUserPermissions(user as import("@/lib/auth-config").AuthUser);
  return buildNavItemsForUser(role, perms, hiddenItems);
}

/**
 * Hide nav items the user lacks `requiresPermission` for, and hide items whose
 * `hiddenIfPermission` the user HAS (dedupe submit vs manage variants).
 */
export function filterNavItemsByPermissions(
  items: NavItem[],
  granted: ReadonlySet<Permission> | readonly Permission[]
): NavItem[] {
  const set = granted instanceof Set ? granted : new Set(granted);
  return items.filter((item) => {
    if (item.requiresAnyPermission && !item.requiresAnyPermission.some((p) => set.has(p))) return false;
    if (item.requiresPermission && !set.has(item.requiresPermission)) return false;
    if (item.hiddenIfPermission && set.has(item.hiddenIfPermission)) return false;
    if (item.hiddenIfAnyPermission?.some((p) => set.has(p))) return false;
    return true;
  });
}

/** Admin VA Tasks nav (list and/or Progress Overview) — manage or progress-only grants. */
export function qualifiesForAdminVaTasksNav(
  granted: ReadonlySet<Permission> | readonly Permission[]
): boolean {
  const set = granted instanceof Set ? granted : new Set(granted);
  return set.has(PERMISSIONS.VA_TASKS_MANAGE) || set.has(PERMISSIONS.TASK_PROGRESS_VIEW);
}

/**
 * Custom roles with `va-tasks:view` but not `va-tasks:manage` use the personal
 * `/va-tasks` page (same as virtual_assistant), not the admin-wide task board.
 */
export function shouldUsePersonalVaTasksNav(
  role: string,
  granted: ReadonlySet<Permission> | readonly Permission[]
): boolean {
  const set = granted instanceof Set ? granted : new Set(granted);
  return isCustomNavRole(role) && set.has(PERMISSIONS.VA_TASKS_VIEW) && !qualifiesForAdminVaTasksNav(set);
}

/**
 * Chatters already have personal `/weekly-program`. Shared nav also surfaces the admin
 * board when roles DB grants `chatter_program:view` (Supabase/Airtable), but admin layout
 * rejects chatters → `/dashboard`. Drop the unreachable duplicate.
 */
export function shouldHideAdminProgramNavForChatter(role: string): boolean {
  return role.trim().toLowerCase() === "chatter";
}

/** Rewrite admin VA Tasks href → personal task view when appropriate; hide chatter admin program dupes. */
export function resolvePermissionAwareNavHrefs(
  items: NavItem[],
  role: string,
  granted: ReadonlySet<Permission> | readonly Permission[]
): NavItem[] {
  let next = items;
  if (shouldHideAdminProgramNavForChatter(role)) {
    next = next.filter(
      (item) =>
        item.href !== ROUTES.admin.weeklyProgram && item.href !== ROUTES.admin.weeklyProgramVa
    );
  }
  if (!shouldUsePersonalVaTasksNav(role, granted)) return next;
  return next.map((item) =>
    item.href === ROUTES.admin.vaTasks ? { ...item, href: ROUTES.va.tasks } : item
  );
}

/** Role base list → hidden-nav filter → permission filter → href resolution. */
export function buildNavItemsForUser(
  role: NavRoleKey,
  granted: ReadonlySet<Permission> | readonly Permission[],
  hiddenItems?: string[]
): NavItem[] {
  const base = getNavItemsForRole(role, hiddenItems);
  const filtered = filterNavItemsByPermissions(base, granted);
  return resolvePermissionAwareNavHrefs(filtered, role, granted);
}

/**
 * The 4 hrefs used for the mobile bottom bar tabs (before the fixed "More" button).
 * Chatter: Home, Calendar (weekly program), Shift (center CTA), Whales — Settings is More-only.
 */
export function getMainTabHrefs(role: NavRoleKey): [string, string, string, string] {
  const r = (typeof role === "string" ? role.toLowerCase() : "") as NavRole;
  if (r === "chatter") {
    return [ROUTES.chatter.home, ROUTES.chatter.weeklyProgram, ROUTES.chatter.shift, ROUTES.chatter.myWhales];
  }
  if (r === "virtual_assistant") {
    return [ROUTES.va.home, ROUTES.va.tasks, ROUTES.va.weeklyAvailability, ROUTES.settings];
  }
  if (r === "admin" || r === "manager") {
    return [ROUTES.admin.home, ROUTES.admin.weeklyProgram, ROUTES.admin.liveShifts, ROUTES.admin.models];
  }
  if (!isSystemNavRole(r)) {
    return [ROUTES.admin.customRoleHome, ROUTES.admin.weeklyProgram, ROUTES.admin.liveShifts, ROUTES.admin.models];
  }
  if (r === "model") {
    return [
      ROUTES.model.home,
      ROUTES.model.myEarnings,
      ROUTES.model.contentCalendar,
      ROUTES.model.schedule,
    ];
  }
  return [ROUTES.dashboard, ROUTES.dashboard, ROUTES.dashboard, ROUTES.dashboard];
}

/** Labels for the 4 main mobile tabs (short uppercase; chatter uses captions in shell). */
export function getMainTabLabels(role: NavRoleKey): [string, string, string, string] {
  const r = (typeof role === "string" ? role.toLowerCase() : "") as NavRole;
  if (r === "chatter") return ["HOME", "CALENDAR", "SHIFT", "WHALES"];
  if (r === "virtual_assistant") return ["HOME", "TASKS", "AVAIL.", "SETTINGS"];
  if (r === "admin" || r === "manager" || !isSystemNavRole(r)) return ["HOME", "PROGRAM", "LIVE", "MODELS"];
  if (r === "model") return ["HOME", "EARNINGS", "CALENDAR", "SCHEDULE"];
  return ["HOME", "DASHBOARD", "DASHBOARD", "MORE"];
}

/**
 * After applying hidden-nav filter, up to 4 main-tab entries for the mobile bottom bar.
 * Prefers canonical main tabs when visible; fills remaining slots from nav order.
 */
export function getMobileMainTabs(
  role: NavRoleKey,
  hiddenItems?: string[],
  granted?: ReadonlySet<Permission> | readonly Permission[]
): NavItem[] {
  const visible = granted
    ? buildNavItemsForUser(role, granted, hiddenItems)
    : getNavItemsForRole(role, hiddenItems);
  const visibleSet = new Set(visible.map((i) => i.href));
  const canonical = [...getMainTabHrefs(role)];
  const picked: NavItem[] = [];
  for (const h of canonical) {
    if (!visibleSet.has(h)) continue;
    const item = visible.find((i) => i.href === h);
    if (item) picked.push(item);
  }
  for (const item of visible) {
    if (picked.length >= 4) break;
    if (item.excludeFromMobileMainTabs) continue;
    if (!picked.some((p) => p.href === item.href)) picked.push(item);
  }
  return picked.slice(0, 4);
}

const CHATTER_MOBILE_TAB_CAPTIONS: [string, string, string, string] = ["Home", "Calendar", "Shift", "Whales"];

export function getMobileMainTabDisplays(
  role: NavRoleKey,
  hiddenItems?: string[],
  granted?: ReadonlySet<Permission> | readonly Permission[]
): { item: NavItem; shortLabel: string; mobileCaption?: string }[] {
  const r = (typeof role === "string" ? role.toLowerCase() : "") as NavRole;
  const tabs = getMobileMainTabs(role, hiddenItems, granted);
  const canonicalHrefs = [...getMainTabHrefs(role)];
  const canonicalLabels = [...getMainTabLabels(role)];
  return tabs.map((item) => {
    const ci = canonicalHrefs.indexOf(item.href);
    const shortLabel =
      ci >= 0
        ? canonicalLabels[ci]
        : item.label.length > 14
          ? `${item.label.slice(0, 12).toUpperCase()}…`
          : item.label.toUpperCase();
    const mobileCaption =
      r === "chatter" && ci >= 0 && ci < CHATTER_MOBILE_TAB_CAPTIONS.length ? CHATTER_MOBILE_TAB_CAPTIONS[ci] : undefined;
    return { item, shortLabel, mobileCaption };
  });
}
