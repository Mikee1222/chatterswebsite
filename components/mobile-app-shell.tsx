"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Calendar,
  CalendarCheck,
  PlayCircle,
  Users,
  UserCheck,
  Menu,
  FileText,
  Receipt,
  Package,
  UserCog,
  Activity,
  Settings,
  LogOut,
  Bell,
  Download,
  BellPlus,
  Wrench,
  Radio,
  LayoutDashboard,
  ListTodo,
  Sparkles,
  Trophy,
  Target,
  LineChart,
  CalendarDays,
  CalendarClock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/routes";
import { getModelT, getModelShellTitle, MODEL_NAV_HREF_TO_LABEL_KEY } from "@/lib/model-i18n";
import type { ModelLang } from "@/lib/model-i18n";
import {
  getMobileMainTabDisplays,
  getNavItemsForRole,
  navHrefIsActive,
  navStorageProfileForRole,
  type NavIconKey,
  type NavItem,
  type NavRole,
  type NavStorageProfile,
} from "@/lib/nav-config";
import type { SessionUser } from "@/types";
import type { Shift } from "@/types";
import { logout } from "@/app/actions/auth";
import { MobileFab } from "@/components/mobile-fab";
import { FloatingActionButton } from "@/components/floating-action-button";
import { VaFloatingActionButton } from "@/components/va-quick-actions-modal";
import { AdminFloatingQuickActionsButton } from "@/components/admin-quick-actions-modal";
import { MoreMenuModal } from "@/components/more-menu-modal";
import { MobileFabVisibilityProvider } from "@/contexts/mobile-fab-visibility-context";
import { LiveShiftMiniBar } from "@/components/live-shift-mini-bar";
import { NotificationBell } from "@/components/notification-bell";
import { useNotificationCenter } from "@/contexts/notification-center-context";
import { useRealtime } from "@/contexts/realtime-context";
import { useNotificationPrompt } from "@/contexts/notification-prompt-context";
import { usePwa } from "@/components/pwa-provider";

/** Row layout aligned with VA quick actions (`va-quick-actions-modal.tsx`). */
const MORE_MENU_ROW_CLASS =
  "flex min-h-[52px] items-center gap-3 rounded-xl px-3 py-3.5 text-left text-[15px] font-medium transition-colors active:bg-white/10 touch-manipulation";
const MORE_MENU_ICON_WRAP_CLASS =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pink-500/20 text-pink-400";

const BETA_BADGE_CLASS =
  "ml-1 inline-flex shrink-0 items-center rounded-md bg-pink-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-pink-400";

function NavBetaBadge() {
  return <span className={BETA_BADGE_CLASS}>BETA</span>;
}

const ICON_MAP: Partial<Record<NavIconKey, React.ComponentType<{ className?: string }>>> = {
  Home,
  LayoutDashboard,
  Calendar,
  CalendarCheck,
  PlayCircle,
  FileText,
  Users,
  Receipt,
  Wrench,
  Radio,
  UserCheck,
  Activity,
  Package,
  UserCog,
  ListTodo,
  Settings,
  Sparkles,
  Trophy,
  Target,
  LineChart,
  CalendarDays,
  CalendarClock,
};

function getMobileTitle(pathname: string): string {
  if (pathname === ROUTES.chatter.home || pathname === ROUTES.va.home) return "Home";
  if (pathname === ROUTES.chatter.weeklyProgram || pathname.startsWith(ROUTES.chatter.weeklyProgram)) return "Weekly program";
  if (pathname === ROUTES.va.weeklyProgram || pathname.startsWith(ROUTES.va.weeklyProgram)) return "Weekly program";
  if (pathname === ROUTES.admin.weeklyProgram || pathname.startsWith(ROUTES.admin.weeklyProgram)) return "Weekly program";
  if (pathname === ROUTES.admin.weeklyProgramVa || pathname.startsWith(ROUTES.admin.weeklyProgramVa)) return "VA weekly program";
  if (pathname === ROUTES.chatter.shift) return "Start shift";
  if (pathname === ROUTES.va.tasks) return "VA tasks";
  if (pathname === ROUTES.admin.vaTasks) return "VA tasks";
  if (pathname === ROUTES.va.shift) return "Start mistake shift";
  if (pathname === ROUTES.va.liveShifts || pathname === ROUTES.admin.liveShifts) return "Live shifts";
  if (pathname === ROUTES.va.models || pathname === ROUTES.admin.models) return "Models";
  if (pathname.startsWith(`${ROUTES.admin.models}/`)) return "Model";
  if (pathname === ROUTES.admin.customRequests) return "Custom requests";
  if (pathname === ROUTES.va.contentAssignments) return "Content assignments";
  if (pathname === ROUTES.va.scheduleOverview) return "Schedule overview";
  if (pathname === "/admin/schedule-overview" || pathname.startsWith("/admin/schedule-overview/")) return "Schedule overview";
  if (pathname === ROUTES.va.customRequests) return "Custom requests";
  if (pathname === ROUTES.chatter.myWhales || pathname.startsWith(ROUTES.chatter.myWhales)) return "My whales";
  if (pathname === ROUTES.admin.whales || pathname.startsWith(ROUTES.admin.whales)) return "Whales";
  if (pathname === ROUTES.chatter.logTransaction) return "Whale session";
  if (pathname === ROUTES.chatter.requestCustom) return "Request custom";
  if (pathname === ROUTES.admin.customs) return "Customs";
  if (pathname === ROUTES.accounts || pathname.startsWith("/accounts")) return "Accounts";
  if (pathname === ROUTES.admin.accounts) return "Accounts";
  if (pathname === ROUTES.admin.shiftActivity) return "Shift activity";
  if (pathname === ROUTES.admin.earnings || pathname.startsWith(`${ROUTES.admin.earnings}/`)) return "Earnings";
  if (pathname === ROUTES.admin.rewardsConfig) return "Rewards config";
  if (pathname === ROUTES.admin.rewards) return "Rewards";
  if (pathname === ROUTES.chatter.rewards) return "Rewards";
  if (pathname === ROUTES.chatter.spinWheel) return "Spin wheel";
  if (pathname === ROUTES.chatter.challenges) return "Challenges";
  if (pathname === ROUTES.admin.challenges) return "Challenges";
  if (pathname === ROUTES.admin.spinResults) return "Spin results";
  if (pathname === ROUTES.settings) return "Settings";
  if (pathname === ROUTES.chatter.weeklyAvailability) return "My availability";
  if (pathname === ROUTES.va.weeklyAvailability) return "My availability";
  if (pathname === ROUTES.admin.home) return "Admin";
  if (pathname === ROUTES.model.home || pathname === ROUTES.model.dashboard || pathname.startsWith("/model")) {
    if (pathname === ROUTES.model.myEarnings) return "My earnings";
    if (pathname === ROUTES.model.contentCalendar) return "Content calendar";
    if (pathname === ROUTES.model.contentAssignments) return "VA content";
    if (pathname === ROUTES.model.weeklyAvailability) return "Weekly availability";
    if (pathname === ROUTES.model.schedule) return "Schedule";
    if (pathname === ROUTES.model.tasks) return "Tasks";
    if (pathname === ROUTES.model.liveStreams) return "Live streams";
    if (pathname === ROUTES.model.customs) return "Customs";
    if (pathname === ROUTES.model.home || pathname === ROUTES.model.dashboard) return "Home";
    return "Model";
  }
  if (pathname === ROUTES.admin.modelAvailability) return "Model availability";
  if (pathname === ROUTES.admin.modelSchedulesOverview) return "Schedule overview";
  if (pathname === ROUTES.admin.vaContentAssignments) return "VA content";
  if (pathname === ROUTES.admin.modelSchedules) return "Model schedules";
  if (pathname === ROUTES.admin.modelTasks) return "Model tasks";
  if (pathname === ROUTES.admin.modelLiveStreams) return "Model live streams";
  if (pathname === ROUTES.admin.modelCustoms) return "Model customs";
  return "App";
}


type MobileAppShellProps = {
  user: SessionUser;
  children: React.ReactNode;
  activeShift?: Shift | null;
  activeShiftModelsCount?: number | null;
  hiddenNavByProfile: Record<NavStorageProfile, string[]>;
  navBadgeCounts?: Record<string, number>;
  /** Model UI language from cookie / Airtable — translates bottom tabs + More menu labels. */
  modelUiLanguage?: ModelLang;
};

export function MobileAppShell({
  user,
  children,
  activeShift = null,
  activeShiftModelsCount = null,
  hiddenNavByProfile,
  navBadgeCounts,
  modelUiLanguage,
}: MobileAppShellProps) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const notificationCenter = useNotificationCenter();
  const realtime = useRealtime();
  const unreadCount = realtime?.unreadCount ?? 0;
  const { openNotificationPrompt } = useNotificationPrompt();
  const { canInstall, needsAddToHomeScreen, setInstallSheetOpen } = usePwa();
  const [notificationPermission, setNotificationPermission] = React.useState<NotificationPermission | null>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);
  React.useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const role = user.role as NavRole;
  const profile = navStorageProfileForRole(role);
  const hiddenForRole = React.useMemo(
    () => hiddenNavByProfile[profile] ?? [],
    [hiddenNavByProfile, profile]
  );

  const baseNavItems: NavItem[] = React.useMemo(() => {
    return getNavItemsForRole(role, hiddenForRole);
  }, [role, hiddenForRole]);

  const allItems: NavItem[] = React.useMemo(() => {
    if (role !== "model" || !modelUiLanguage) return baseNavItems;
    const t = getModelT(modelUiLanguage);
    return baseNavItems.map((item) => {
      const key = MODEL_NAV_HREF_TO_LABEL_KEY[item.href];
      const label = key ? t(key) : item.label;
      const badge =
        item.href === ROUTES.model.myEarnings && item.badge ? t("nav.comingSoon") : item.badge;
      return { ...item, label, badge };
    });
  }, [baseNavItems, role, modelUiLanguage]);

  const mainTabRows = React.useMemo(() => {
    const displays = getMobileMainTabDisplays(role, hiddenForRole);
    if (role !== "model" || !modelUiLanguage) return displays.map(({ item }) => ({ item }));
    const t = getModelT(modelUiLanguage);
    return displays.map(({ item }) => {
      const key = MODEL_NAV_HREF_TO_LABEL_KEY[item.href];
      const label = key ? t(key) : item.label;
      return { item: { ...item, label } };
    });
  }, [role, hiddenForRole, modelUiLanguage]);

  const mainHrefSet = React.useMemo(() => new Set(mainTabRows.map((r) => r.item.href)), [mainTabRows]);
  const moreItems = allItems.filter((item) => !mainHrefSet.has(item.href));

  const navHrefs = React.useMemo(() => allItems.map((i) => i.href), [allItems]);
  const navActive = React.useCallback((href: string) => navHrefIsActive(pathname, href, navHrefs), [pathname, navHrefs]);

  const moreTabActive = React.useMemo(() => moreItems.some((item) => navActive(item.href)), [moreItems, navActive]);

  const title = React.useMemo(() => {
    if (user.role === "model" && modelUiLanguage) {
      const m = getModelShellTitle(pathname, modelUiLanguage);
      if (m) return m;
    }
    return getMobileTitle(pathname);
  }, [pathname, user.role, modelUiLanguage]);
  const shiftHref = user.role === "chatter" ? ROUTES.chatter.shift : user.role === "virtual_assistant" ? ROUTES.va.shift : null;

  return (
    <MobileFabVisibilityProvider>
      <div className="flex min-h-[100dvh] flex-col bg-transparent md:min-h-0">
        <header
          className="sticky top-0 z-30 shrink-0 overflow-hidden border-b border-white/10 bg-zinc-900/80 backdrop-blur-xl md:hidden"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="flex h-[56px] min-h-[56px] max-h-[56px] w-full min-w-0 items-center justify-between gap-2 px-4">
            <h1 className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight text-white">{title}</h1>
            <div className="flex shrink-0 items-center gap-1">
              <NotificationBell role={user.role} />
              <button
                type="button"
                onClick={() => setMoreOpen(true)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white/80 outline-none ring-0 hover:bg-white/10 hover:text-white"
                aria-label="Open menu"
              >
                <Menu className="h-6 w-6" />
              </button>
            </div>
          </div>
        </header>

        <div className="relative z-20 min-h-0 flex-1">
          {children}
        </div>

        {activeShift && shiftHref && (
          <LiveShiftMiniBar activeShift={activeShift} shiftHref={shiftHref} modelsCount={activeShiftModelsCount} />
        )}

        {user.role === "chatter" ? (
          <FloatingActionButton user={user} />
        ) : user.role === "admin" || user.role === "manager" ? (
          <AdminFloatingQuickActionsButton user={user} />
        ) : user.role === "model" ? null : user.role === "virtual_assistant" ? (
          <VaFloatingActionButton user={user} />
        ) : (
          <MobileFab user={user} />
        )}

        <nav
          className="fixed bottom-0 left-0 right-0 z-40 flex h-[64px] items-stretch justify-around gap-0.5 border-t border-white/[0.09] bg-zinc-950/92 px-1 pt-1 backdrop-blur-xl md:hidden"
          style={{
            paddingBottom: "max(0.35rem, env(safe-area-inset-bottom))",
            boxShadow: "0 -8px 32px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
        >
          {mainTabRows.map(({ item }) => {
            const href = item.href;
            const Icon = ICON_MAP[item.iconKey] ?? Home;
            const active = !item.disabled && navActive(href);
            const tabClass = cn(
              "relative flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-0.5 py-1.5 transition-all duration-200 ease-out",
              "border-0 bg-transparent shadow-none outline-none ring-0",
              item.disabled
                ? "cursor-not-allowed text-white/35"
                : active
                  ? "text-pink-200"
                  : "text-white/45 active:scale-[0.96] hover:bg-white/[0.06] hover:text-white/90"
            );
            const iconWrap = (
              <>
                {active ? (
                  <span
                    className="absolute left-1/2 top-1.5 h-1 w-8 -translate-x-1/2 rounded-full bg-gradient-to-r from-pink-400 via-pink-300 to-fuchsia-400 shadow-[0_0_14px_rgba(236,72,153,0.55)]"
                    aria-hidden
                  />
                ) : null}
                <Icon
                  className={cn(
                    "relative z-10 h-6 w-6 shrink-0 transition-[transform,filter] duration-200",
                    item.disabled && "opacity-50",
                    active && "scale-[1.06] drop-shadow-[0_0_10px_rgba(236,72,153,0.4)]"
                  )}
                  aria-hidden
                />
                <span className="sr-only">
                  {item.label}
                  {item.beta ? " (beta)" : ""}
                </span>
              </>
            );
            if (item.disabled) {
              return (
                <div
                  key={href}
                  className={tabClass}
                  aria-label={`${item.label} (${item.badge ?? "unavailable"})`}
                  role="group"
                >
                  {iconWrap}
                </div>
              );
            }
            return (
              <Link key={href} href={href} prefetch className={tabClass}>
                {iconWrap}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              "relative flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center rounded-2xl px-1 py-2 transition-all duration-200 ease-out",
              "border-0 bg-transparent shadow-none outline-none ring-0",
              moreOpen
                ? "bg-white/10 text-white"
                : moreTabActive
                  ? "text-pink-200 hover:bg-white/[0.06]"
                  : "text-white/45 hover:bg-white/[0.06] hover:text-white/90"
            )}
            aria-expanded={moreOpen}
            aria-haspopup="dialog"
            aria-label="More navigation"
          >
            {moreTabActive && !moreOpen ? (
              <span
                className="absolute left-1/2 top-1.5 h-1 w-8 -translate-x-1/2 rounded-full bg-gradient-to-r from-pink-400/90 to-fuchsia-400/90 opacity-90 shadow-[0_0_12px_rgba(236,72,153,0.45)]"
                aria-hidden
              />
            ) : null}
            <Menu className="relative z-10 h-7 w-7 shrink-0" aria-hidden />
            <span className="sr-only">More menu</span>
          </button>
        </nav>
      </div>

      <MoreMenuModal open={moreOpen} onClose={() => setMoreOpen(false)} title="More" userRole={user.role}>
        <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 pb-2">
          {moreItems.map((link) => {
            const Icon = ICON_MAP[link.iconKey] ?? Users;
            const active = !link.disabled && navActive(link.href);
            if (link.disabled) {
              return (
                <li key={link.href}>
                  <div
                    className={cn(MORE_MENU_ROW_CLASS, "cursor-not-allowed text-white/40")}
                    aria-disabled="true"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white/35">
                      <Icon className="h-5 w-5 opacity-50" />
                    </span>
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="truncate">{link.label}</span>
                      {link.badge ? (
                        <span className="shrink-0 rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/45">
                          {link.badge}
                        </span>
                      ) : null}
                    </span>
                  </div>
                </li>
              );
            }
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  prefetch
                  onClick={() => setMoreOpen(false)}
                  className={cn(MORE_MENU_ROW_CLASS, active ? "bg-pink-500/10 text-pink-100" : "text-white/95")}
                >
                  <span className={cn(MORE_MENU_ICON_WRAP_CLASS, active && "bg-pink-500/30 text-pink-300")}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="flex min-w-0 flex-1 items-center gap-1.5">
                    <span className="truncate">{link.label}</span>
                    {link.beta ? <NavBetaBadge /> : null}
                    {link.badge ? <span className="text-[10px] uppercase text-white/40">{link.badge}</span> : null}
                    {(navBadgeCounts?.[link.href] ?? 0) > 0 ? (
                      <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-pink-500 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-white">
                        {(navBadgeCounts?.[link.href] ?? 0) > 99 ? "99+" : navBadgeCounts?.[link.href]}
                      </span>
                    ) : null}
                  </span>
                </Link>
              </li>
            );
          })}
          {!allItems.some((i) => i.href === ROUTES.settings) && (
            <li>
              <Link
                href={ROUTES.settings}
                prefetch
                onClick={() => setMoreOpen(false)}
                className={cn(
                  MORE_MENU_ROW_CLASS,
                  navActive(ROUTES.settings) ? "bg-pink-500/10 text-pink-100" : "text-white/95"
                )}
              >
                <span
                  className={cn(
                    MORE_MENU_ICON_WRAP_CLASS,
                    navActive(ROUTES.settings) && "bg-pink-500/30 text-pink-300"
                  )}
                >
                  <Settings className="h-5 w-5" />
                </span>
                Settings
              </Link>
            </li>
          )}
          {notificationCenter && (
            <li>
              <button
                type="button"
                onClick={() => {
                  notificationCenter.setOpen(true);
                  setMoreOpen(false);
                }}
                className={cn(MORE_MENU_ROW_CLASS, "w-full text-white/95")}
              >
                <span className={MORE_MENU_ICON_WRAP_CLASS}>
                  <Bell className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1 text-left">Notifications</span>
                {mounted && unreadCount > 0 ? (
                  <span className="flex h-6 min-w-[1.5rem] shrink-0 items-center justify-center rounded-full bg-pink-500 px-2 text-[11px] font-bold text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                ) : null}
              </button>
            </li>
          )}
          {mounted && (canInstall || needsAddToHomeScreen) && (
            <li>
              <button
                type="button"
                onClick={() => {
                  setInstallSheetOpen(true);
                  setMoreOpen(false);
                }}
                className={cn(MORE_MENU_ROW_CLASS, "w-full text-white/95")}
              >
                <span className={MORE_MENU_ICON_WRAP_CLASS}>
                  <Download className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1 text-left">Install app</span>
              </button>
            </li>
          )}
          {mounted && notificationPermission !== null && notificationPermission !== "granted" && (
            <li>
              <button
                type="button"
                onClick={() => {
                  openNotificationPrompt();
                  setMoreOpen(false);
                }}
                className={cn(MORE_MENU_ROW_CLASS, "w-full text-white/95")}
              >
                <span className={MORE_MENU_ICON_WRAP_CLASS}>
                  <BellPlus className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1 text-left">Enable notifications</span>
              </button>
            </li>
          )}
          <li className="border-t border-white/10 pt-2">
            <form action={logout}>
              <button
                type="submit"
                className={cn(
                  MORE_MENU_ROW_CLASS,
                  "w-full text-red-400 hover:bg-red-500/10 active:bg-red-500/15"
                )}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/15 text-red-400">
                  <LogOut className="h-5 w-5" />
                </span>
                Log out
              </button>
            </form>
          </li>
        </ul>
      </MoreMenuModal>
    </MobileFabVisibilityProvider>
  );
}
