"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Calendar,
  PlayCircle,
  Users,
  UserCheck,
  Wrench,
  Radio,
  Menu,
  X,
  FileText,
  Receipt,
  Package,
  UserCog,
  Activity,
  Settings,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/routes";
import type { SessionUser } from "@/types";
import type { Shift } from "@/types";
import { logout } from "@/app/actions/auth";
import { MobileFab } from "@/components/mobile-fab";
import { LiveShiftMiniBar } from "@/components/live-shift-mini-bar";
import { NotificationBell } from "@/components/notification-bell";
import { useNotificationCenter } from "@/contexts/notification-center-context";
import { useRealtime } from "@/contexts/realtime-context";
import { useNotificationPrompt } from "@/contexts/notification-prompt-context";
import { usePwa } from "@/components/pwa-provider";
import { Bell, Download, BellPlus } from "lucide-react";

/** Bottom nav: 5 tabs. Role-aware hrefs and labels (chatter: whales; va: models; admin: live). */
const TAB_IDS = ["home", "program", "shift", "models", "more"] as const;
const TAB_ICONS = {
  home: Home,
  program: Calendar,
  shift: PlayCircle,
  models: Users,
  more: Menu,
} as const;

function getTabLabel(
  tabId: (typeof TAB_IDS)[number],
  user: SessionUser
): string {
  if (tabId === "more") return "MORE";
  if (tabId === "home") return "HOME";
  if (tabId === "program") return "PROGRAM";
  const role = user.role;
  if (tabId === "shift") return role === "admin" || role === "manager" ? "LIVE" : "SHIFT";
  if (tabId === "models") return role === "chatter" ? "WHALES" : "MODELS";
  return "MORE";
}

function getTabHref(
  tabId: (typeof TAB_IDS)[number],
  user: SessionUser
): string | null {
  if (tabId === "more") return null;
  const role = user.role;
  if (role === "chatter") {
    if (tabId === "home") return ROUTES.chatter.home;
    if (tabId === "program") return ROUTES.chatter.weeklyProgram;
    if (tabId === "shift") return ROUTES.chatter.shift;
    if (tabId === "models") return ROUTES.chatter.myWhales; // "WHALES" tab
  }
  if (role === "virtual_assistant") {
    if (tabId === "home") return ROUTES.va.home;
    if (tabId === "program") return ROUTES.va.weeklyProgram;
    if (tabId === "shift") return ROUTES.va.shift;
    if (tabId === "models") return ROUTES.va.models;
  }
  if (role === "admin" || role === "manager") {
    if (tabId === "home") return ROUTES.admin.home;
    if (tabId === "program") return ROUTES.admin.weeklyProgram;
    if (tabId === "shift") return ROUTES.admin.liveShifts; // "LIVE" tab
    if (tabId === "models") return ROUTES.admin.models;
  }
  return null;
}

function getMobileTitle(pathname: string): string {
  if (pathname === ROUTES.chatter.home || pathname === ROUTES.va.home) return "Home";
  if (pathname === ROUTES.chatter.weeklyProgram || pathname.startsWith(ROUTES.chatter.weeklyProgram)) return "Weekly program";
  if (pathname === ROUTES.va.weeklyProgram || pathname.startsWith(ROUTES.va.weeklyProgram)) return "Weekly program";
  if (pathname === ROUTES.admin.weeklyProgram || pathname.startsWith(ROUTES.admin.weeklyProgram)) return "Weekly program";
  if (pathname === ROUTES.admin.weeklyProgramVa || pathname.startsWith(ROUTES.admin.weeklyProgramVa)) return "VA weekly program";
  if (pathname === ROUTES.chatter.shift) return "Start shift";
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
  if (pathname === ROUTES.settings) return "Settings";
  if (pathname === ROUTES.chatter.weeklyAvailability) return "My availability";
  if (pathname === ROUTES.va.weeklyAvailability) return "My availability";
  if (pathname === ROUTES.admin.home) return "Admin";
  return "App";
}

function isActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href !== "/" && pathname.startsWith(href + "/")) return true;
  return false;
}

type MoreLink = { href: string; label: string; icon: React.ComponentType<{ className?: string }>; roles?: ("chatter" | "virtual_assistant" | "admin" | "manager")[] };

const MORE_LINKS: MoreLink[] = [
  { href: ROUTES.chatter.myWhales, label: "My whales", icon: Users, roles: ["chatter"] },
  { href: ROUTES.chatter.logTransaction, label: "Whale session", icon: Receipt, roles: ["chatter"] },
  { href: ROUTES.chatter.requestCustom, label: "Custom requests", icon: FileText, roles: ["chatter"] },
  { href: ROUTES.va.weeklyAvailability, label: "My availability", icon: Calendar, roles: ["virtual_assistant"] },
  { href: ROUTES.chatter.weeklyAvailability, label: "My availability", icon: Calendar, roles: ["chatter"] },
  { href: ROUTES.admin.accounts, label: "Accounts", icon: UserCog, roles: ["admin", "manager"] },
  { href: ROUTES.admin.shiftActivity, label: "Shift activity", icon: Activity, roles: ["admin", "manager"] },
  { href: ROUTES.admin.whales, label: "Whales", icon: Users, roles: ["admin", "manager"] },
  { href: ROUTES.admin.customs, label: "Customs", icon: Package, roles: ["admin", "manager"] },
  { href: ROUTES.settings, label: "Settings", icon: Settings },
];

type MobileAppShellProps = {
  user: SessionUser;
  children: React.ReactNode;
  activeShift?: Shift | null;
  /** Real active model count for mini bar (from getActiveShiftModels). */
  activeShiftModelsCount?: number | null;
};

export function MobileAppShell({ user, children, activeShift = null, activeShiftModelsCount = null }: MobileAppShellProps) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = React.useState(false);
  const notificationCenter = useNotificationCenter();
  const realtime = useRealtime();
  const unreadCount = realtime?.unreadCount ?? 0;
  const { openNotificationPrompt } = useNotificationPrompt();
  const { canInstall, needsAddToHomeScreen, setInstallSheetOpen } = usePwa();
  const [notificationPermission, setNotificationPermission] = React.useState<NotificationPermission | null>(null);
  React.useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const title = getMobileTitle(pathname);
  const moreLinks = MORE_LINKS.filter(
    (l) => !l.roles || l.roles.includes(user.role as "chatter" | "virtual_assistant" | "admin" | "manager")
  );

  const shiftHref = user.role === "chatter" ? ROUTES.chatter.shift : user.role === "virtual_assistant" ? ROUTES.va.shift : null;

  return (
    <>
      <div className="min-h-[100dvh] flex flex-col md:min-h-0">
        {/* Mobile header: title + notifications + menu (opens More) */}
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-black/60 px-4 backdrop-blur-xl md:hidden">
          <h1 className="text-lg font-semibold tracking-tight text-white truncate pr-2">{title}</h1>
          <div className="flex items-center gap-1">
            <NotificationBell role={user.role} />
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white/80 hover:bg-white/10 hover:text-white"
              aria-label="Open menu"
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </header>

        {/* Main content */}
        <div className="min-h-0 flex-1">
          {children}
        </div>

        {/* Live shift mini bar: above bottom nav when user has active shift (chatter/VA only) */}
        {activeShift && shiftHref && (
          <LiveShiftMiniBar activeShift={activeShift} shiftHref={shiftHref} modelsCount={activeShiftModelsCount} />
        )}

        {/* FAB: quick actions, above bottom nav (and above mini bar when present) */}
        <MobileFab user={user} hasLiveMiniBar={Boolean(activeShift && shiftHref)} />

        {/* Bottom nav: fixed, premium glass, safe area, role-specific labels */}
        <nav
          className="fixed bottom-0 left-0 right-0 z-40 flex h-[72px] items-center justify-around border-t border-white/10 bg-black/90 backdrop-blur-xl md:hidden"
          style={{
            paddingBottom: "env(safe-area-inset-bottom)",
            boxShadow: "0 -4px 24px rgba(0,0,0,0.45), 0 1px 0 rgba(255,255,255,0.05)",
          }}
        >
          {TAB_IDS.map((tabId) => {
            const href = getTabHref(tabId, user);
            const Icon = TAB_ICONS[tabId];
            const label = getTabLabel(tabId, user);
            const active = href ? isActive(pathname, href) : false;
            if (tabId === "more") {
              return (
                <button
                  key="more"
                  type="button"
                  onClick={() => setMoreOpen(true)}
                  className={cn(
                    "flex min-h-[48px] flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors",
                    "text-white/60 hover:text-white/90 active:bg-white/5"
                  )}
                >
                  <Icon className="h-6 w-6 shrink-0" />
                  <span>{label}</span>
                </button>
              );
            }
            if (!href) return null;
            return (
              <Link
                key={tabId}
                href={href}
                className={cn(
                  "flex min-h-[48px] flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors",
                  active
                    ? "text-[hsl(330,90%,65%)]"
                    : "text-white/60 hover:text-white/90 active:bg-white/5"
                )}
              >
                <Icon className="h-6 w-6 shrink-0" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* More: full-screen sheet */}
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
              {moreLinks.map((link) => {
                const Icon = link.icon;
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
                      {link.label}
                    </Link>
                  </li>
                );
              })}
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
                    {unreadCount > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[hsl(330,80%,55%)] px-1.5 text-[11px] font-semibold text-white">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </button>
                </li>
              )}
              {(canInstall || needsAddToHomeScreen) && (
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
              {notificationPermission !== null && notificationPermission !== "granted" && (
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
    </>
  );
}
