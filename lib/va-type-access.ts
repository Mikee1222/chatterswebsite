import { redirect } from "next/navigation";
import type { NextResponse } from "next/server";
import { NextResponse as NextResponseClass } from "next/server";
import type { AuthUser } from "@/lib/auth-config";
import {
  getHiddenNavForVaType,
  parseHiddenNavSettingJson,
  type ParsedHiddenNavConfig,
} from "@/lib/nav-config";
import { ROUTES } from "@/lib/routes";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { getSystemSetting } from "@/services/system-settings";
import type { VaType } from "@/types";

/** Nav hrefs guarded for VA sessions (matches `vaNav` + shared routes). */
export const VA_TYPE_GUARDED_NAV_HREFS = [
  ROUTES.va.home,
  ROUTES.va.schedule,
  ROUTES.va.tasks,
  ROUTES.va.scheduleOverview,
  ROUTES.va.whales,
  ROUTES.va.contentAssignments,
  ROUTES.va.customRequests,
  ROUTES.va.mistakes,
  ROUTES.va.weeklyAvailability,
  ROUTES.va.blurTool,
  ROUTES.sops,
  ROUTES.finesBonuses,
  ROUTES.settings,
] as const;

/** API path prefix → nav href (longest prefixes first). */
const VA_API_PREFIX_TO_NAV_HREF: readonly { prefix: string; navHref: string }[] = [
  { prefix: "/api/va/content-assignments", navHref: ROUTES.va.contentAssignments },
  { prefix: "/api/va/content/create", navHref: ROUTES.va.contentAssignments },
  { prefix: "/api/va/custom/", navHref: ROUTES.va.customRequests },
  { prefix: "/api/va/schedule/", navHref: ROUTES.va.schedule },
  { prefix: "/api/va/phase-items/", navHref: ROUTES.va.tasks },
  { prefix: "/api/va/mistakes/", navHref: ROUTES.va.mistakes },
  { prefix: "/api/va/mistakes", navHref: ROUTES.va.mistakes },
  { prefix: "/api/va/marketing/", navHref: ROUTES.va.marketingAccounts },
  { prefix: "/api/va/fines-bonuses", navHref: ROUTES.finesBonuses },
  { prefix: "/api/va/whales", navHref: ROUTES.va.whales },
  { prefix: "/api/va/task-phases", navHref: ROUTES.va.tasks },
  { prefix: "/api/va-tasks/", navHref: ROUTES.va.tasks },
];

/** Page/API path prefix → nav href (longest prefixes first). */
const VA_PATH_PREFIX_TO_NAV_HREF: readonly { prefix: string; navHref: string }[] = [
  { prefix: ROUTES.va.contentAssignments, navHref: ROUTES.va.contentAssignments },
  { prefix: ROUTES.va.customRequests, navHref: ROUTES.va.customRequests },
  { prefix: ROUTES.va.scheduleOverview, navHref: ROUTES.va.scheduleOverview },
  { prefix: ROUTES.va.schedule, navHref: ROUTES.va.schedule },
  { prefix: ROUTES.va.mistakes, navHref: ROUTES.va.mistakes },
  { prefix: ROUTES.va.whales, navHref: ROUTES.va.whales },
  { prefix: ROUTES.va.blurTool, navHref: ROUTES.va.blurTool },
  { prefix: ROUTES.va.weeklyAvailability, navHref: ROUTES.va.weeklyAvailability },
  { prefix: ROUTES.va.tasks, navHref: ROUTES.va.tasks },
  { prefix: ROUTES.va.home, navHref: ROUTES.va.home },
  { prefix: ROUTES.finesBonuses, navHref: ROUTES.finesBonuses },
  { prefix: ROUTES.sops, navHref: ROUTES.sops },
  { prefix: ROUTES.settings, navHref: ROUTES.settings },
  ...VA_API_PREFIX_TO_NAV_HREF,
];

function normalizePathname(pathname: string): string {
  const bare = (pathname.split("?")[0] || "").replace(/\/$/, "") || "/";
  return bare.startsWith("/") ? bare : `/${bare}`;
}

/** Map a request path to the nav href used for hide checks, or null if not type-restricted. */
export function pathnameToVaNavHref(pathname: string): string | null {
  const p = normalizePathname(pathname);
  for (const { prefix, navHref } of VA_PATH_PREFIX_TO_NAV_HREF) {
    const normPrefix = normalizePathname(prefix);
    if (p === normPrefix || p.startsWith(`${normPrefix}/`)) {
      return navHref;
    }
  }
  return null;
}

export function canVaTypeAccessNavHref(
  vaType: VaType | null | undefined,
  navHref: string,
  config: ParsedHiddenNavConfig
): boolean {
  if (vaType == null) return true;
  const hidden = getHiddenNavForVaType(vaType, config);
  return !hidden.includes(navHref);
}

/** Same config source as nav filtering — single source of truth. */
export function canVaTypeAccessRoute(
  vaType: VaType | null | undefined,
  pathname: string,
  config: ParsedHiddenNavConfig
): boolean {
  const navHref = pathnameToVaNavHref(pathname);
  if (!navHref) return true;
  return canVaTypeAccessNavHref(vaType, navHref, config);
}

async function loadHiddenNavConfig(): Promise<ParsedHiddenNavConfig> {
  const raw = await getSystemSetting("hidden_nav_items").catch(() => null);
  return parseHiddenNavSettingJson(raw);
}

/** Page guard: redirect VA users away from nav-hidden routes. No-op for dual-role in chatter mode. */
export async function assertVaTypeCanAccessNavHref(user: AuthUser, navHref: string): Promise<void> {
  if (getEffectiveStaffRole(user) !== "virtual_assistant") return;
  const config = await loadHiddenNavConfig();
  if (!canVaTypeAccessNavHref(user.va_type, navHref, config)) {
    redirect(ROUTES.va.home);
  }
}

/** Page guard using request pathname (uses x-pathname when present). */
export async function assertVaTypeCanAccessRoute(user: AuthUser, pathname: string): Promise<void> {
  if (getEffectiveStaffRole(user) !== "virtual_assistant") return;
  const config = await loadHiddenNavConfig();
  if (!canVaTypeAccessRoute(user.va_type, pathname, config)) {
    redirect(ROUTES.va.home);
  }
}

/** API guard by nav href — returns 403 when blocked; null when allowed or not applicable. */
export async function vaTypeAccessApiGuardForNavHref(
  user: AuthUser,
  navHref: string
): Promise<NextResponse | null> {
  if (getEffectiveStaffRole(user) !== "virtual_assistant") return null;
  const config = await loadHiddenNavConfig();
  if (canVaTypeAccessNavHref(user.va_type, navHref, config)) return null;
  return NextResponseClass.json({ error: "Forbidden" }, { status: 403 });
}

/** API guard — returns 403 when blocked; null when allowed or not applicable. */
export async function vaTypeAccessApiGuard(
  user: AuthUser,
  pathname: string
): Promise<NextResponse | null> {
  if (getEffectiveStaffRole(user) !== "virtual_assistant") return null;
  const config = await loadHiddenNavConfig();
  if (canVaTypeAccessRoute(user.va_type, pathname, config)) return null;
  return NextResponseClass.json({ error: "Forbidden" }, { status: 403 });
}
