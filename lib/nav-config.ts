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
  | "Home"| "Calendar"| "CalendarCheck"| "PlayCircle"| "FileText"| "Users"| "Receipt"| "Wrench"| "Radio"| "UserCheck"| "Activity"| "Package"| "UserCog"| "LayoutDashboard"| "ListTodo"| "Settings"| "Sparkles"| "Trophy"| "Target"| "LineChart"| "CalendarDays"| "CalendarClock"| "Clock"| "MessageSquarePlus"| "ImageOff"| "AlertTriangle"| "AlertCircle"| "Settings2"| "Coins"| "TrendingUp"| "Info"| "CreditCard"| "BookOpen"| "Link2";

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

/** Core destinations — settings stays in More menu on mobile (not bottom tabs). */
const chatterNav: NavItem[] = [
  { href: ROUTES.chatter.home, label: "Home", iconKey: "Home" },
  { href: ROUTES.chatter.weeklyProgram, label: "Weekly program", iconKey: "Calendar" },
  {
    href: ROUTES.chatter.shift,
    label: "Shift",
    iconKey: "PlayCircle",
    isShiftButton: true,
  },
  { href: ROUTES.chatter.myWhales, label: "My whales", iconKey: "Users", beta: true },
  { href: ROUTES.chatter.myRebills, label: "My rebills", iconKey: "TrendingUp", excludeFromMobileMainTabs: true },
  { href: ROUTES.chatter.informations, label: "Informations", iconKey: "Info", excludeFromMobileMainTabs: true },
  { href: ROUTES.sops, label: "SOPs / Training", iconKey: "BookOpen", excludeFromMobileMainTabs: true },
  { href: ROUTES.chatter.rewards, label: "Rewards", iconKey: "Trophy", excludeFromMobileMainTabs: true },
  { href: ROUTES.finesBonuses, label: "Fines & Bonuses", iconKey: "Coins", excludeFromMobileMainTabs: true },
  { href: ROUTES.chatter.challenges, label: "Challenges", iconKey: "Target", excludeFromMobileMainTabs: true },
  { href: ROUTES.chatter.mistakes, label: "My mistakes", iconKey: "AlertCircle", excludeFromMobileMainTabs: true },
  { href: ROUTES.settings, label: "Settings", iconKey: "Settings", excludeFromMobileMainTabs: true },
];

const vaNav: NavItem[] = [
  { href: ROUTES.va.home, label: "Home", iconKey: "Home" },
  { href: ROUTES.va.schedule, label: "My schedule", iconKey: "Calendar" },
  { href: ROUTES.va.tasks, label: "VA tasks", iconKey: "ListTodo" },
  { href: ROUTES.va.scheduleOverview, label: "Schedule overview", iconKey: "CalendarDays" },
  { href: ROUTES.va.whales, label: "Whales", iconKey: "Users" },
  { href: ROUTES.va.contentAssignments, label: "Content assignments", iconKey: "FileText" },
  { href: ROUTES.va.customRequests, label: "Custom requests", iconKey: "Package" },
  { href: ROUTES.va.mistakes, label: "Mistakes", iconKey: "AlertTriangle" },
  { href: ROUTES.va.weeklyAvailability, label: "My weekly availability", iconKey: "CalendarCheck" },
  { href: ROUTES.va.blurTool, label: "Blur tool", iconKey: "ImageOff" },
  { href: ROUTES.sops, label: "SOPs / Training", iconKey: "BookOpen", excludeFromMobileMainTabs: true },
  { href: ROUTES.finesBonuses, label: "Fines & Bonuses", iconKey: "Coins", excludeFromMobileMainTabs: true },
  { href: ROUTES.settings, label: "Settings", iconKey: "Settings" },
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
    requiresPermission: PERMISSIONS.WEEKLY_PROGRAM_MANAGE,
  },
  {
    href: ROUTES.admin.weeklyProgramVa,
    label: "VA weekly program",
    iconKey: "CalendarCheck",
    navSection: "TEAM",
    requiresPermission: PERMISSIONS.WEEKLY_PROGRAM_MANAGE,
  },
  {
    href: ROUTES.admin.vaTasks,
    label: "VA tasks",
    iconKey: "ListTodo",
    navSection: "TEAM",
    requiresPermission: PERMISSIONS.VA_TASKS_VIEW,
  },
  {
    href: ROUTES.admin.modelAvailability,
    label: "Model availability",
    iconKey: "CalendarCheck",
    navSection: "TEAM",
    requiresPermission: PERMISSIONS.MODELS_AVAILABILITY,
  },
  {
    href: ROUTES.admin.modelSchedules,
    label: "Model schedules",
    iconKey: "Calendar",
    navSection: "TEAM",
    requiresPermission: PERMISSIONS.MODELS_SCHEDULES,
  },
  {
    href: ROUTES.admin.modelTasks,
    label: "Model tasks",
    iconKey: "FileText",
    navSection: "TEAM",
    requiresPermission: PERMISSIONS.MODELS_MANAGE,
  },

  // ── CREATORS ──
  {
    href: ROUTES.admin.models,
    label: "Models",
    iconKey: "UserCheck",
    navSection: "CREATORS",
    requiresPermission: PERMISSIONS.MODELS_VIEW,
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

  // ── CONTENT ──
  {
    href: ROUTES.admin.vaContentAssignments,
    label: "VA Content",
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
    href: ROUTES.admin.sopLibrary,
    label: "SOP Library",
    iconKey: "BookOpen",
    navSection: "CONTENT",
    requiresPermission: PERMISSIONS.SOPS_MANAGE,
  },
  {
    href: ROUTES.admin.pdfMaker,
    label: "PDF Maker",
    iconKey: "FileText",
    navSection: "CONTENT",
    requiresPermission: PERMISSIONS.SOPS_MANAGE,
  },
  {
    href: ROUTES.admin.informations,
    label: "Informations",
    iconKey: "Info",
    navSection: "CONTENT",
  },
  {
    href: ROUTES.admin.marketing,
    label: "Marketing",
    iconKey: "TrendingUp",
    navSection: "CONTENT",
    requiresPermission: PERMISSIONS.MARKETING_VIEW,
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
  // Hidden from sidebar for now; route `/admin/earnings-config` still works if opened directly.
  // { href: ROUTES.admin.earningsConfig, label: "Earnings config", iconKey: "UserCog", adminOnly: true },

  // ── PERFORMANCE ──
  {
    href: ROUTES.admin.mistakes,
    label: "Mistakes",
    iconKey: "AlertTriangle",
    navSection: "PERFORMANCE",
    requiresPermission: PERMISSIONS.MISTAKES_VIEW,
  },
  {
    href: ROUTES.admin.mistakeReasons,
    label: "Mistake reasons",
    iconKey: "Settings2",
    navSection: "PERFORMANCE",
    adminOnly: true,
    requiresPermission: PERMISSIONS.MISTAKES_REASONS_MANAGE,
  },
  {
    href: ROUTES.admin.rewards,
    label: "Rewards",
    iconKey: "Trophy",
    navSection: "PERFORMANCE",
    requiresPermission: PERMISSIONS.REWARDS_VIEW,
  },
  {
    href: ROUTES.admin.challenges,
    label: "Challenges",
    iconKey: "Target",
    navSection: "PERFORMANCE",
    adminOnly: true,
    requiresPermission: PERMISSIONS.CHALLENGES_MANAGE,
  },
  {
    href: ROUTES.admin.spinResults,
    label: "Spin results",
    iconKey: "Sparkles",
    navSection: "PERFORMANCE",
    requiresPermission: PERMISSIONS.SPIN_WHEEL_VIEW,
  },
  {
    href: ROUTES.admin.rewardsConfig,
    label: "Rewards Config",
    iconKey: "Sparkles",
    navSection: "PERFORMANCE",
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
    requiresPermission: PERMISSIONS.ROLES_VIEW,
  },
  {
    href: ROUTES.admin.feedback,
    label: "Feedback",
    iconKey: "MessageSquarePlus",
    navSection: "SETTINGS",
    requiresPermission: PERMISSIONS.FEEDBACK_VIEW,
  },
  {
    href: ROUTES.va.blurTool,
    label: "Blur tool",
    iconKey: "ImageOff",
    navSection: "SETTINGS",
  },
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

/** Model: home, earnings (placeholder), calendar, availability (/schedule), settings; customs / lives on + menu. */
const modelNav: NavItem[] = [
  { href: ROUTES.model.home, label: "Home", iconKey: "Home" },
  {
    href: ROUTES.model.myEarnings,
    label: "My earnings",
    iconKey: "LineChart",
    disabled: true,
    badge: "Coming soon",
  },
  { href: ROUTES.model.contentCalendar, label: "Calendar", iconKey: "CalendarDays" },
  { href: ROUTES.model.contentAssignments, label: "VA content", iconKey: "FileText" },
  { href: ROUTES.model.schedule, label: "Availability", iconKey: "CalendarClock" },
  { href: ROUTES.model.customs, label: "Custom requests", iconKey: "Package" },
  { href: ROUTES.settings, label: "Settings", iconKey: "Settings" },
];

/** Shared admin nav items shown to custom roles regardless of grants (Home, Settings, etc.). */
function getCustomRoleSharedAdminNavItems(): NavItem[] {
  return adminNav
    .filter((item) => !item.requiresPermission && !item.adminOnly)
    .map((item) =>
      item.href === ROUTES.admin.home ? { ...item, href: ROUTES.admin.customRoleHome } : item
    );
}

/** Canonical lists before hide filter (settings UI + internal). */
export function getBaseNavItemsForRole(role: NavRoleKey): NavItem[] {
  const r = (typeof role === "string" ? role.toLowerCase() : "") as NavRole;
  if (r === "chatter") return [...chatterNav];
  if (r === "virtual_assistant") return [...vaNav];
  if (r === "admin" || r === "manager") {
    const items = [...adminNav];
    if (r === "manager") return items.filter((i) => !i.adminOnly);
    return items;
  }
  if (r === "model") return [...modelNav];
  if (!isSystemNavRole(r)) {
    return [...adminNav.filter((item) => item.requiresPermission), ...getCustomRoleSharedAdminNavItems()];
  }
  return [{ href: ROUTES.dashboard, label: "Dashboard", iconKey: "LayoutDashboard" }];
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
  const base = getNavItemsForRole(role, hiddenItems);
  const perms = await getUserPermissions(user as import("@/lib/auth-config").AuthUser);
  return filterNavItemsByPermissions(base, perms);
}

/** Hide nav items the user lacks `requiresPermission` for. */
export function filterNavItemsByPermissions(
  items: NavItem[],
  granted: ReadonlySet<Permission> | readonly Permission[]
): NavItem[] {
  const set = granted instanceof Set ? granted : new Set(granted);
  return items.filter((item) => !item.requiresPermission || set.has(item.requiresPermission));
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
export function getMobileMainTabs(role: NavRoleKey, hiddenItems?: string[]): NavItem[] {
  const visible = getNavItemsForRole(role, hiddenItems);
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
  hiddenItems?: string[]
): { item: NavItem; shortLabel: string; mobileCaption?: string }[] {
  const r = (typeof role === "string" ? role.toLowerCase() : "") as NavRole;
  const tabs = getMobileMainTabs(role, hiddenItems);
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
