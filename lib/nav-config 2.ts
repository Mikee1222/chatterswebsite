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
  | "Home"
  | "Calendar"
  | "CalendarCheck"
  | "PlayCircle"
  | "FileText"
  | "Users"
  | "Receipt"
  | "Wrench"
  | "Radio"
  | "UserCheck"
  | "Activity"
  | "Package"
  | "UserCog"
  | "LayoutDashboard"
  | "ListTodo"
  | "Settings"
  | "Sparkles"
  | "Trophy"
  | "Target"
  | "LineChart";

export type NavItem = {
  href: string;
  label: string;
  iconKey: NavIconKey;
  beta?: boolean;
  /** If true, only `admin` role sees this link (managers use the same admin nav profile but skip these). */
  adminOnly?: boolean;
  /** When true, item never fills a mobile bottom-bar slot (stays in the More sheet only). */
  excludeFromMobileMainTabs?: boolean;
};

export type NavRole = "chatter" | "virtual_assistant" | "admin" | "manager" | "model";

export function navStorageProfileForRole(role: NavRole): NavStorageProfile {
  const r = (typeof role === "string" ? role.toLowerCase() : "") as NavRole;
  if (r === "admin" || r === "manager") return "admin";
  if (r === "virtual_assistant") return "virtual_assistant";
  if (r === "model") return "model";
  return "chatter";
}

const chatterNav: NavItem[] = [
  { href: ROUTES.chatter.home, label: "Home", iconKey: "Home" },
  { href: ROUTES.chatter.weeklyProgram, label: "Weekly program", iconKey: "Calendar" },
  { href: ROUTES.chatter.weeklyAvailability, label: "My weekly availability", iconKey: "CalendarCheck" },
  { href: ROUTES.chatter.shift, label: "Start a shift", iconKey: "PlayCircle" },
  { href: ROUTES.chatter.requestCustom, label: "Request a custom", iconKey: "FileText" },
  { href: ROUTES.chatter.myWhales, label: "My whales", iconKey: "Users", beta: true },
  { href: ROUTES.chatter.logTransaction, label: "Whale session", iconKey: "Receipt" },
  { href: ROUTES.chatter.rewards, label: "Rewards", iconKey: "Trophy", excludeFromMobileMainTabs: true },
  { href: ROUTES.chatter.challenges, label: "Challenges", iconKey: "Target", excludeFromMobileMainTabs: true },
  { href: ROUTES.settings, label: "Settings", iconKey: "Settings" },
];

const vaNav: NavItem[] = [
  { href: ROUTES.va.home, label: "Home", iconKey: "Home" },
  { href: ROUTES.va.tasks, label: "VA tasks", iconKey: "ListTodo" },
  { href: ROUTES.va.weeklyProgram, label: "Weekly program", iconKey: "Calendar" },
  { href: ROUTES.va.weeklyAvailability, label: "My weekly availability", iconKey: "CalendarCheck" },
  { href: ROUTES.va.shift, label: "Start mistake shift", iconKey: "Wrench" },
  { href: ROUTES.va.liveShifts, label: "Live shifts", iconKey: "Radio" },
  { href: ROUTES.va.models, label: "Models free / taken", iconKey: "UserCheck" },
  { href: ROUTES.settings, label: "Settings", iconKey: "Settings" },
];

const adminNav: NavItem[] = [
  { href: ROUTES.admin.home, label: "Home", iconKey: "Home" },
  { href: ROUTES.admin.weeklyProgram, label: "Weekly program", iconKey: "Calendar" },
  { href: ROUTES.admin.weeklyProgramVa, label: "VA weekly program", iconKey: "CalendarCheck" },
  { href: ROUTES.admin.liveShifts, label: "Live shifts", iconKey: "Radio" },
  { href: ROUTES.admin.models, label: "Models", iconKey: "UserCheck" },
  { href: ROUTES.admin.modelAvailability, label: "Model availability", iconKey: "CalendarCheck" },
  { href: ROUTES.admin.modelSchedules, label: "Model schedules", iconKey: "Calendar" },
  { href: ROUTES.admin.modelTasks, label: "Model tasks", iconKey: "FileText" },
  { href: ROUTES.admin.modelLiveStreams, label: "Model live streams", iconKey: "Radio", beta: true },
  { href: ROUTES.admin.modelCustoms, label: "Model customs", iconKey: "Package" },
  { href: ROUTES.admin.shiftActivity, label: "Shift activity", iconKey: "Activity" },
  { href: ROUTES.admin.earnings, label: "Earnings", iconKey: "LineChart", adminOnly: true },
  { href: ROUTES.admin.earningsConfig, label: "Earnings config", iconKey: "UserCog", adminOnly: true },
  { href: ROUTES.admin.vaTasks, label: "VA tasks", iconKey: "ListTodo" },
  { href: ROUTES.admin.rewardsConfig, label: "Rewards Config", iconKey: "Sparkles", adminOnly: true },
  { href: ROUTES.admin.rewards, label: "Rewards", iconKey: "Trophy" },
  { href: ROUTES.admin.challenges, label: "Challenges", iconKey: "Target", adminOnly: true },
  { href: ROUTES.admin.spinResults, label: "Spin results", iconKey: "Package" },
  { href: ROUTES.admin.whales, label: "Whales", iconKey: "Users", beta: true },
  { href: ROUTES.admin.customs, label: "Customs", iconKey: "Package", beta: true },
  { href: "/hours", label: "Hours", iconKey: "Calendar", beta: true },
  { href: "/activity-logs", label: "Activity logs", iconKey: "Activity", beta: true },
  { href: ROUTES.admin.accounts, label: "Accounts", iconKey: "UserCog" },
  { href: ROUTES.settings, label: "Settings", iconKey: "Settings" },
];

/** Model sidebar & mobile: home, weekly availability, schedule, tasks, live streams, customs, settings. First 4 = mobile bottom tabs; rest = More drawer. */
const modelNav: NavItem[] = [
  { href: ROUTES.model.home, label: "Home", iconKey: "Home" },
  { href: ROUTES.model.weeklyAvailability, label: "Weekly availability", iconKey: "CalendarCheck" },
  { href: ROUTES.model.schedule, label: "Schedule", iconKey: "Calendar" },
  { href: ROUTES.model.tasks, label: "Tasks", iconKey: "FileText" },
  { href: ROUTES.model.liveStreams, label: "Live streams", iconKey: "Radio", beta: true },
  { href: ROUTES.model.customs, label: "Customs", iconKey: "Package", beta: true },
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
 * The 4 hrefs used for the mobile bottom bar tabs (home, program, shift, models).
 * All other nav items go in the "More" sheet in the same order as getNavItemsForRole.
 */
export function getMainTabHrefs(role: NavRole): [string, string, string, string] {
  const r = (typeof role === "string" ? role.toLowerCase() : "") as NavRole;
  if (r === "chatter") {
    return [ROUTES.chatter.home, ROUTES.chatter.weeklyProgram, ROUTES.chatter.shift, ROUTES.chatter.myWhales];
  }
  if (r === "virtual_assistant") {
    return [ROUTES.va.home, ROUTES.va.weeklyProgram, ROUTES.va.shift, ROUTES.va.models];
  }
  if (r === "admin" || r === "manager") {
    return [ROUTES.admin.home, ROUTES.admin.weeklyProgram, ROUTES.admin.liveShifts, ROUTES.admin.models];
  }
  if (r === "model") {
    return [ROUTES.model.home, ROUTES.model.weeklyAvailability, ROUTES.model.schedule, ROUTES.model.tasks];
  }
  return [ROUTES.dashboard, ROUTES.dashboard, ROUTES.dashboard, ROUTES.dashboard];
}

/** Labels for the 4 main mobile tabs (HOME, PROGRAM, SHIFT/LIVE, WHALES/MODELS). */
export function getMainTabLabels(role: NavRole): [string, string, string, string] {
  const r = (typeof role === "string" ? role.toLowerCase() : "") as NavRole;
  if (r === "chatter") return ["HOME", "PROGRAM", "SHIFT", "WHALES"];
  if (r === "virtual_assistant") return ["HOME", "PROGRAM", "SHIFT", "MODELS"];
  if (r === "admin" || r === "manager") return ["HOME", "PROGRAM", "LIVE", "MODELS"];
  if (r === "model") return ["HOME", "AVAIL.", "SCHEDULE", "TASKS"];
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

export function getMobileMainTabDisplays(
  role: NavRole,
  hiddenItems?: string[]
): { item: NavItem; shortLabel: string }[] {
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
    return { item, shortLabel };
  });
}
