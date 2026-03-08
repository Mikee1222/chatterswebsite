"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import {
  Home,
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
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/routes";
import type { SessionUser } from "@/types";

type NavItem = { href: string; label: string; icon: ComponentType<{ className?: string }> };

const chatterNav: NavItem[] = [
  { href: ROUTES.chatter.home, label: "Home", icon: Home },
  { href: ROUTES.chatter.weeklyProgram, label: "Weekly program", icon: Calendar },
  { href: ROUTES.chatter.shift, label: "Shift", icon: PlayCircle },
  { href: ROUTES.chatter.myWhales, label: "My whales", icon: Users },
  { href: ROUTES.chatter.weeklyAvailability, label: "My availability", icon: CalendarCheck },
  { href: ROUTES.chatter.requestCustom, label: "Request custom", icon: FileText },
  { href: ROUTES.chatter.logTransaction, label: "Whale session", icon: Receipt },
];

const vaNav: NavItem[] = [
  { href: ROUTES.va.home, label: "Home", icon: Home },
  { href: ROUTES.va.weeklyProgram, label: "Weekly program", icon: Calendar },
  { href: ROUTES.va.shift, label: "Mistake shift", icon: Wrench },
  { href: ROUTES.va.liveShifts, label: "Live shifts", icon: Radio },
  { href: ROUTES.va.weeklyAvailability, label: "My availability", icon: CalendarCheck },
  { href: ROUTES.va.models, label: "Models", icon: UserCheck },
];

const adminNav: NavItem[] = [
  { href: ROUTES.admin.home, label: "Home", icon: Home },
  { href: ROUTES.admin.weeklyProgram, label: "Weekly program", icon: Calendar },
  { href: ROUTES.admin.liveShifts, label: "Live shifts", icon: Radio },
  { href: ROUTES.admin.whales, label: "Whales", icon: Users },
  { href: ROUTES.admin.weeklyProgramVa, label: "VA program", icon: CalendarCheck },
  { href: ROUTES.admin.models, label: "Models", icon: UserCheck },
  { href: ROUTES.admin.shiftActivity, label: "Shift activity", icon: Activity },
  { href: ROUTES.admin.customs, label: "Customs", icon: Package },
  { href: ROUTES.admin.accounts, label: "Accounts", icon: UserCog },
];

const PRIMARY_COUNT = 4;

function isActive(pathname: string, href: string, allHrefs: string[]): boolean {
  if (pathname === href) return true;
  if (!pathname.startsWith(href + "/")) return false;
  return !allHrefs.some((o) => o !== href && pathname.startsWith(o));
}

export function MobileNav({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const isChatter = user.role === "chatter";
  const isVA = user.role === "virtual_assistant";
  const isAdmin = user.role === "admin" || user.role === "manager";

  const items = isChatter ? chatterNav : isVA ? vaNav : isAdmin ? adminNav : [];
  const primary = items.slice(0, PRIMARY_COUNT);
  const more = items.slice(PRIMARY_COUNT);

  if (items.length === 0) return null;

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-white/10 bg-black/90 py-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
        style={{ boxShadow: "0 -4px 24px rgba(0,0,0,0.4)" }}
      >
        {primary.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href, items.map((i) => i.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors",
                active ? "text-[hsl(330,90%,65%)]" : "text-white/60 hover:text-white/90"
              )}
            >
              <Icon className="h-6 w-6 shrink-0" />
              <span className="hidden max-w-[4rem] truncate sm:block">{item.label}</span>
            </Link>
          );
        })}
        {more.length > 0 ? (
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors",
              more.some((i) => isActive(pathname, i.href, items.map((x) => x.href))) ? "text-[hsl(330,90%,65%)]" : "text-white/60 hover:text-white/90"
            )}
          >
            <Menu className="h-6 w-6 shrink-0" />
            <span className="hidden max-w-[4rem] truncate sm:block">More</span>
          </button>
        ) : null}
      </nav>

      {drawerOpen && more.length > 0 && (
        <>
          <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm md:hidden" aria-hidden onClick={() => setDrawerOpen(false)} />
          <div
            className="fixed bottom-0 left-0 right-0 z-[120] max-h-[70vh] overflow-y-auto rounded-t-2xl border border-white/10 border-b-0 bg-black/95 py-4 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
            style={{ boxShadow: "0 -8px 32px rgba(0,0,0,0.5)" }}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 pb-3">
              <span className="text-sm font-semibold text-white/90">More</span>
              <button type="button" onClick={() => setDrawerOpen(false)} className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <ul className="space-y-0.5 p-3">
              {more.map((item) => {
                const Icon = item.icon;
                const active = isActive(pathname, item.href, items.map((i) => i.href));
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setDrawerOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors",
                        active ? "bg-[hsl(330,80%,55%)]/20 text-[hsl(330,90%,65%)]" : "text-white/80 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </>
  );
}
