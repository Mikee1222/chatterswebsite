/**
 * Single source of truth for dashboard navigation.
 * Desktop (sidebar) and mobile (bottom tabs + More sheet) both use this config.
 * Same items, same order, same role-based visibility for all viewports.
 *
 * Hidden items: Airtable `system_settings` key `hidden_nav_items` (JSON per profile); see parseHiddenNavSettingJson / getNavItemsForRole.
 */

import { ROUTES } from "@/lib/routes";

/** Keys in stored JSON — admin + manager share `admin`. */
export type NavStorageProfile = "chatter" | "virtual_assistant" | "admin" | "model";

/** Default: nothing hidden for any profile (matches stored JSON shape). */
export const EMPTY_HIDDEN_NAV_BY_PROFILE: Record<NavStorageProfile, string[]> = {
  chatter: [],
  virtual_assistant: [],
  admin: [],
  model: [],
};

/** Parse `setting_value` JSON from system_settings `hidden_nav_items`. */
export function parseHiddenNavSettingJson(raw: string | null | undefined): Record<NavStorageProfile, string[]> {
  if (raw == null || String(raw).trim() === "") {
    return { ...EMPTY_HIDDEN_NAV_BY_PROFILE };
  }
  try {
    const parsed = JSON.parse(String(raw)) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { ...EMPTY_HIDDEN_NAV_BY_PROFILE };
    }
    const out = { ...EMPTY_HIDDEN_NAV_BY_PROFILE };
    for (const k of Object.keys(out) as NavStorageProfile[]) {
      const v = (parsed as Record<string, unknown>)[k];
      if (Array.isArray(v)) {
        out[k] = v.filter((x): x is string => typeof x === "string");
      }
    }
    return out;
  } catch {
    return { ...EMPTY_HIDDEN_NAV_BY_PROFILE };
  }
}

export type NavIconKey =
  | "Home"| "Calendar"| "CalendarCheck"| "PlayCircle"| "FileText"| "Users"| "Receipt"| "Wrench"| "Radio"| "UserCheck"| "Activity"| "Package"| "UserCog"| "LayoutDashboard"| "ListTodo"| "Settings"| "Sparkles"| "Trophy"| "Target"| "LineChart"| "CalendarDays"| "CalendarClock"| "Clock"| "MessageSquarePlus"| "ImageOff"| "AlertTriangle"| "AlertCircle"| "Settings2"| "Coins"| "TrendingUp"| "Info"| "CreditCard";

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

export function navStorageProfileForRole(role: NavRole): NavStorageProfile {
  const r = (typeof role === "string" ? role.toLowerCase() : "") as NavRole;
  if (r === "admin" || r === "manager") return "admin";
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
  { href: ROUTES.finesBonuses, label: "Fines & Bonuses", iconKey: "Coins", excludeFromMobileMainTabs: true },
  { href: ROUTES.settings, label: "Settings", iconKey: "Settings" },
];

const adminNav: NavItem[] = [
  // ── OVERVIEW ──
  { href: ROUTES.admin.home, label: "Home", iconKey: "Home", navSection: "OVERVIEW" },
  { href: ROUTES.admin.liveShifts, label: "Live shifts", iconKey: "Radio" },
  { href: ROUTES.admin.shiftActivity, label: "Shift activity", iconKey: "Clock" },
  { href: ROUTES.admin.modelSchedulesOverview, label: "Schedule overview", iconKey: "CalendarDays" },

  // ── PROGRAMS ──
  { href: ROUTES.admin.weeklyProgram, label: "Weekly program", iconKey: "Calendar", navSection: "PROGRAMS" },
  { href: ROUTES.admin.weeklyProgramVa, label: "VA weekly program", iconKey: "CalendarCheck" },
  { href: ROUTES.admin.vaTasks, label: "VA tasks", iconKey: "ListTodo" },
  { href: ROUTES.admin.modelAvailability, label: "Model availability", iconKey: "CalendarCheck" },
  { href: ROUTES.admin.modelSchedules, label: "Model schedules", iconKey: "Calendar" },
  { href: ROUTES.admin.modelTasks, label: "Model tasks", iconKey: "FileText" },

  // ── CREATORS & CLIENTS ──
  { href: ROUTES.admin.models, label: "Models", iconKey: "UserCheck", navSection: "CREATORS & CLIENTS" },
  { href: ROUTES.admin.clients, label: "Clients", iconKey: "Users" },
  { href: ROUTES.admin.whales, label: "Whales", iconKey: "Users" },
  { href: ROUTES.admin.accounts, label: "Accounts", iconKey: "UserCog" },
  { href: ROUTES.admin.modelLiveStreams, label: "Model live streams", iconKey: "Radio", beta: true },
  { href: ROUTES.admin.modelCustoms, label: "Model customs", iconKey: "Package" },

  // ── MARKETING ──
  { href: ROUTES.admin.marketing, label: "Marketing", iconKey: "TrendingUp", navSection: "MARKETING" },
  { href: ROUTES.admin.informations, label: "Informations", iconKey: "Info", navSection: undefined },
  { href: ROUTES.admin.vaContentAssignments, label: "VA Content", iconKey: "FileText" },
  { href: ROUTES.admin.modelContentRequests, label: "Model content requests", iconKey: "FileText" },

  // ── FINANCE ──
  { href: ROUTES.admin.billing, label: "Billing", iconKey: "Receipt", navSection: "FINANCE" },
  { href: ROUTES.admin.paymentMethods, label: "Payment Methods", iconKey: "CreditCard" },
  { href: ROUTES.admin.submissions, label: "Submissions", iconKey: "FileText" },
  { href: ROUTES.admin.partnership, label: "Partnership", iconKey: "TrendingUp" },
  { href: ROUTES.admin.customRequests, label: "Custom requests", iconKey: "Receipt" },
  { href: ROUTES.admin.rebillsTips, label: "Rebills & Tips", iconKey: "Receipt" },
  { href: ROUTES.admin.expenseRequests, label: "Expense requests", iconKey: "Receipt" },
  { href: ROUTES.admin.finesBonuses, label: "Fines & Bonuses", iconKey: "Coins" },
  { href: ROUTES.admin.earnings, label: "Earnings", iconKey: "LineChart", adminOnly: true },
  // Hidden from sidebar for now; route `/admin/earnings-config` still works if opened directly.
  // { href: ROUTES.admin.earningsConfig, label: "Earnings config", iconKey: "UserCog", adminOnly: true },

  // ── PERFORMANCE ──
  { href: ROUTES.admin.mistakes, label: "Mistakes", iconKey: "AlertTriangle", navSection: "PERFORMANCE" },
  { href: ROUTES.admin.mistakeReasons, label: "Mistake reasons", iconKey: "Settings2", adminOnly: true },
  { href: ROUTES.admin.rewards, label: "Rewards", iconKey: "Trophy" },
  { href: ROUTES.admin.spinResults, label: "Spin results", iconKey: "Sparkles" },
  { href: ROUTES.admin.rewardsConfig, label: "Rewards Config", iconKey: "Sparkles", adminOnly: true },
  { href: ROUTES.admin.challenges, label: "Challenges", iconKey: "Target", adminOnly: true },

  // ── SUPPORT ──
  { href: ROUTES.admin.feedback, label: "Feedback", iconKey: "MessageSquarePlus", navSection: "SUPPORT" },
  { href: ROUTES.activityLogs, label: "Activity logs", iconKey: "Activity" },
  {
    href: ROUTES.admin.notificationDiagnostic,
    label: "Notification diagnostic",
    iconKey: "Activity",
    adminOnly: true,
    excludeFromMobileMainTabs: true,
  },
  { href: ROUTES.va.blurTool, label: "Blur tool", iconKey: "ImageOff" },
  { href: ROUTES.settings, label: "Settings", iconKey: "Settings" },
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

/** Canonical lists before hide filter (settings UI + internal). */
export function getBaseNavItemsForRole(role: NavRole): NavItem[] {
  const r = (typeof role === "string" ? role.toLowerCase() : "") as NavRole;
  if (r === "chatter") return [...chatterNav];
  if (r === "virtual_assistant") return [...vaNav];
  if (r === "admin" || r === "manager") {
    const items = [...adminNav];
    if (r === "manager") return items.filter((i) => !i.adminOnly);
    return items;
  }
  if (r === "model") return [...modelNav];
  return [{ href: ROUTES.dashboard, label: "Dashboard", iconKey: "LayoutDashboard" }];
}

/**
 * All nav items for the given role, minus hrefs listed in `hiddenItems` for this role’s storage profile.
 * When `hiddenItems` is omitted or empty, no items are filtered out.
 */
export function getNavItemsForRole(role: NavRole, hiddenItems?: string[]): NavItem[] {
  const base = getBaseNavItemsForRole(role);
  if (hiddenItems == null || hiddenItems.length === 0) return base;
  const hidden = new Set(hiddenItems);
  return base.filter((item) => !hidden.has(item.href));
}

/**
 * The 4 hrefs used for the mobile bottom bar tabs (before the fixed "More" button).
 * Chatter: Home, Calendar (weekly program), Shift (center CTA), Whales — Settings is More-only.
 */
export function getMainTabHrefs(role: NavRole): [string, string, string, string] {
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
export function getMainTabLabels(role: NavRole): [string, string, string, string] {
  const r = (typeof role === "string" ? role.toLowerCase() : "") as NavRole;
  if (r === "chatter") return ["HOME", "CALENDAR", "SHIFT", "WHALES"];
  if (r === "virtual_assistant") return ["HOME", "TASKS", "AVAIL.", "SETTINGS"];
  if (r === "admin" || r === "manager") return ["HOME", "PROGRAM", "LIVE", "MODELS"];
  if (r === "model") return ["HOME", "EARNINGS", "CALENDAR", "SCHEDULE"];
  return ["HOME", "DASHBOARD", "DASHBOARD", "MORE"];
}

/**
 * After applying hidden-nav filter, up to 4 main-tab entries for the mobile bottom bar.
 * Prefers canonical main tabs when visible; fills remaining slots from nav order.
 */
export function getMobileMainTabs(role: NavRole, hiddenItems?: string[]): NavItem[] {
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
  role: NavRole,
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
