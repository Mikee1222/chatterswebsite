"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  Calendar,
  CalendarCheck,
  PlayCircle,
  Users,
  UserCheck,
  Menu,
  X,
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
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/routes";
import {
  getMobileMainTabDisplays,
  getNavItemsForRole,
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
import { QuickActionsMenu } from "@/components/quick-actions-menu";
import { MobileFabVisibilityProvider } from "@/contexts/mobile-fab-visibility-context";
import { LiveShiftMiniBar } from "@/components/live-shift-mini-bar";
import { NotificationBell } from "@/components/notification-bell";
import { useNotificationCenter } from "@/contexts/notification-center-context";
import { useRealtime } from "@/contexts/realtime-context";
import { useNotificationPrompt } from "@/contexts/notification-prompt-context";
import { usePwa } from "@/components/pwa-provider";

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
  if (pathname === ROUTES.chatter.myWhales || pathname.startsWith(ROUTES.chatter.myWhales)) return "My whales";
  if (pathname === ROUTES.admin.whales || pathname.startsWith(ROUTES.admin.whales)) return "Whales";
  if (pathname === ROUTES.chatter.logTransaction) return "Whale session";
  if (pathname === ROUTES.chatter.requestCustom) return "Request custom";
  if (pathname === ROUTES.admin.customs) return "Customs";
  if (pathname === ROUTES.accounts || pathname.startsWith("/accounts")) return "Accounts";
  if (pathname === ROUTES.admin.accounts) return "Accounts";
  if (pathname === ROUTES.admin.shiftActivity) return "Shift activity";
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
    if (pathname === ROUTES.model.weeklyAvailability) return "Weekly availability";
    if (pathname === ROUTES.model.schedule) return "Schedule";
    if (pathname === ROUTES.model.tasks) return "Tasks";
    if (pathname === ROUTES.model.liveStreams) return "Live streams";
    if (pathname === ROUTES.model.customs) return "Customs";
    if (pathname === ROUTES.model.home || pathname === ROUTES.model.dashboard) return "Home";
    return "Model";
  }
  if (pathname === ROUTES.admin.modelAvailability) return "Model availability";
  if (pathname === ROUTES.admin.modelSchedules) return "Model schedules";
  if (pathname === ROUTES.admin.modelTasks) return "Model tasks";
  if (pathname === ROUTES.admin.modelLiveStreams) return "Model live streams";
  if (pathname === ROUTES.admin.modelCustoms) return "Model customs";
  return "App";
}

function isActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href !== "/" && pathname.startsWith(href + "/")) return true;
  return false;
}

type MobileAppShellProps = {
  user: SessionUser;
  children: React.ReactNode;
  activeShift?: Shift | null;
  activeShiftModelsCount?: number | null;
  hiddenNavByProfile: Record<NavStorageProfile, string[]>;
};

export function MobileAppShell({
  user,
  children,
  activeShift = null,
  activeShiftModelsCount = null,
  hiddenNavByProfile,
}: MobileAppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = React.useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = React.useState(false);
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

  const allItems: NavItem[] = React.useMemo(() => {
    return getNavItemsForRole(role, hiddenForRole);
  }, [role, hiddenForRole]);

  const mainTabRows = React.useMemo(() => {
    return getMobileMainTabDisplays(role, hiddenForRole);
  }, [role, hiddenForRole]);

  const mainHrefSet = React.useMemo(() => new Set(mainTabRows.map((r) => r.item.href)), [mainTabRows]);
  const moreItems = allItems.filter((item) => !mainHrefSet.has(item.href));

  const title = getMobileTitle(pathname);
  const shiftHref = user.role === "chatter" ? ROUTES.chatter.shift : user.role === "virtual_assistant" ? ROUTES.va.shift : null;

  return (
    <MobileFabVisibilityProvider>
      <div className="min-h-[100dvh] flex flex-col md:min-h-0">
        <header
          className="sticky top-0 z-30 shrink-0 overflow-hidden border-b border-white/10 bg-black/60 backdrop-blur-xl md:hidden"
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

        <div className="min-h-0 flex-1">
          {children}
        </div>

        {activeShift && shiftHref && (
          <LiveShiftMiniBar activeShift={activeShift} shiftHref={shiftHref} modelsCount={activeShiftModelsCount} />
        )}

        {user.role === "chatter" ? (
          <>
            <button
              type="button"
              onClick={() => setQuickActionsOpen(true)}
              className="fixed bottom-[88px] right-4 z-50 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-pink-400/35 bg-gradient-to-br from-pink-500 to-fuchsia-600 text-white shadow-[0_14px_32px_rgba(236,72,153,0.45)] transition-transform hover:scale-[1.03] active:scale-[0.98] md:hidden"
              aria-label="Open quick actions"
            >
              <Plus className="h-6 w-6" />
            </button>
            {quickActionsOpen ? (
              <QuickActionsMenu
                onClose={() => setQuickActionsOpen(false)}
                openAddWhale={() => router.push(ROUTES.chatter.myWhalesNew)}
                openTransactionForm={() => router.push(ROUTES.chatter.logTransaction)}
              />
            ) : null}
          </>
        ) : (
          <MobileFab user={user} />
        )}

        <nav
          className="fixed bottom-0 left-0 right-0 z-40 flex h-[72px] items-center justify-around border-t border-white/10 bg-black/90 backdrop-blur-xl md:hidden"
          style={{
            paddingBottom: "env(safe-area-inset-bottom)",
            boxShadow: "0 -4px 24px rgba(0,0,0,0.45), 0 1px 0 rgba(255,255,255,0.05)",
          }}
        >
          {mainTabRows.map(({ item, shortLabel }) => {
            const href = item.href;
            const Icon = ICON_MAP[item.iconKey] ?? Home;
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex min-h-[48px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors",
                  "border-0 bg-transparent shadow-none outline-none ring-0",
                  active
                    ? "bg-[hsl(330,88%,58%)]/18 text-[hsl(330,92%,72%)]"
                    : "text-white/60 hover:text-white/90"
                )}
              >
                <Icon className="h-6 w-6 shrink-0" />
                <span className="flex max-w-full items-center justify-center gap-0.5 truncate">
                  <span className="truncate">{shortLabel}</span>
                  {item.beta ? <NavBetaBadge /> : null}
                </span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex min-h-[48px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors",
              "border-0 bg-transparent text-white/60 shadow-none outline-none ring-0 hover:text-white/90"
            )}
          >
            <Menu className="h-6 w-6 shrink-0" />
            <span className="max-w-full truncate">MORE</span>
          </button>
        </nav>
      </div>

      {moreOpen && (
        <>
          <div
            className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm md:hidden"
            aria-hidden
            onClick={() => setMoreOpen(false)}
          />
          <div
            className="fixed inset-0 top-auto z-[120] flex max-h-[85dvh] flex-col rounded-t-2xl border border-white/10 border-b-0 bg-black/95 backdrop-blur-xl md:hidden transition-transform duration-200 ease-out"
            style={{
              paddingBottom: "env(safe-area-inset-bottom)",
              boxShadow: "0 -8px 40px rgba(0,0,0,0.5)",
            }}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-4">
              <span className="text-base font-semibold text-white">More</span>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-white/70 hover:bg-white/10 hover:text-white"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <ul className="flex-1 space-y-0.5 overflow-y-auto p-4">
              {moreItems.map((link) => {
                const Icon = ICON_MAP[link.iconKey] ?? Users;
                const active = isActive(pathname, link.href);
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        "flex items-center gap-4 rounded-xl px-4 py-4 text-base font-medium transition-colors",
                        active ? "bg-[hsl(330,80%,55%)]/20 text-[hsl(330,90%,65%)]" : "text-white/90 hover:bg-white/10"
                      )}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      <span className="flex min-w-0 flex-1 items-center gap-1">
                        <span className="truncate">{link.label}</span>
                        {link.beta ? <NavBetaBadge /> : null}
                      </span>
                    </Link>
                  </li>
                );
              })}
              {!allItems.some((i) => i.href === ROUTES.settings) && (
                <li>
                  <Link
                    href={ROUTES.settings}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex items-center gap-4 rounded-xl px-4 py-4 text-base font-medium transition-colors",
                      isActive(pathname, ROUTES.settings) ? "bg-[hsl(330,80%,55%)]/20 text-[hsl(330,90%,65%)]" : "text-white/90 hover:bg-white/10"
                    )}
                  >
                    <Settings className="h-5 w-5 shrink-0" />
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
                    className="flex w-full items-center gap-4 rounded-xl px-4 py-4 text-base font-medium text-white/90 hover:bg-white/10"
                  >
                    <Bell className="h-5 w-5 shrink-0" />
                    <span className="flex-1 text-left">Notifications</span>
                    {mounted && unreadCount > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[hsl(330,80%,55%)] px-1.5 text-[11px] font-semibold text-white">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
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
                    className="flex w-full items-center gap-4 rounded-xl px-4 py-4 text-base font-medium text-white/90 hover:bg-white/10"
                  >
                    <Download className="h-5 w-5 shrink-0" />
                    <span className="flex-1 text-left">Install app</span>
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
                    className="flex w-full items-center gap-4 rounded-xl px-4 py-4 text-base font-medium text-white/90 hover:bg-white/10"
                  >
                    <BellPlus className="h-5 w-5 shrink-0" />
                    <span className="flex-1 text-left">Enable notifications</span>
                  </button>
                </li>
              )}
              <li className="border-t border-white/10 pt-3">
                <form action={logout}>
                  <button
                    type="submit"
                    className="flex w-full items-center gap-4 rounded-xl px-4 py-4 text-base font-medium text-white/80 hover:bg-white/10 hover:text-white"
                  >
                    <LogOut className="h-5 w-5 shrink-0" />
                    Log out
                  </button>
                </form>
              </li>
            </ul>
          </div>
        </>
      )}
    </MobileFabVisibilityProvider>
  );
}
