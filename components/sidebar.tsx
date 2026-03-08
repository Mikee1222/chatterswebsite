"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import {
  LayoutDashboard,
  Shield,
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/routes";
import type { SessionUser } from "@/types";

type NavRole = "admin" | "manager" | "chatter" | "virtual_assistant";

const chatterNav: { href: string; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { href: ROUTES.chatter.home, label: "Home", icon: Home },
  { href: ROUTES.chatter.weeklyProgram, label: "Weekly program", icon: Calendar },
  { href: ROUTES.chatter.weeklyAvailability, label: "My weekly availability", icon: CalendarCheck },
  { href: ROUTES.chatter.shift, label: "Start a shift", icon: PlayCircle },
  { href: ROUTES.chatter.requestCustom, label: "Request a custom", icon: FileText },
  { href: ROUTES.chatter.myWhales, label: "My whales", icon: Users },
  { href: ROUTES.chatter.logTransaction, label: "Whale session", icon: Receipt },
];

const vaNav: { href: string; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { href: ROUTES.va.home, label: "Home", icon: Home },
  { href: ROUTES.va.weeklyProgram, label: "Weekly program", icon: Calendar },
  { href: ROUTES.va.weeklyAvailability, label: "My weekly availability", icon: CalendarCheck },
  { href: ROUTES.va.shift, label: "Start mistake shift", icon: Wrench },
  { href: ROUTES.va.liveShifts, label: "Live shifts", icon: Radio },
  { href: ROUTES.va.models, label: "Models free / taken", icon: UserCheck },
];

const adminNav: { href: string; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { href: ROUTES.admin.home, label: "Home", icon: Home },
  { href: ROUTES.admin.weeklyProgram, label: "Weekly program", icon: Calendar },
  { href: ROUTES.admin.weeklyProgramVa, label: "VA weekly program", icon: CalendarCheck },
  { href: ROUTES.admin.liveShifts, label: "Live shifts", icon: Radio },
  { href: ROUTES.admin.models, label: "Models", icon: UserCheck },
  { href: ROUTES.admin.shiftActivity, label: "Shift activity", icon: Activity },
  { href: ROUTES.admin.whales, label: "Whales", icon: Users },
  { href: ROUTES.admin.customs, label: "Customs", icon: Package },
  { href: ROUTES.admin.accounts, label: "Accounts", icon: UserCog },
];

export function Sidebar({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const isChatter = user.role === "chatter";
  const isVA = user.role === "virtual_assistant";
  const isAdmin = user.role === "admin" || user.role === "manager";

  const items = isChatter
    ? chatterNav
    : isVA
      ? vaNav
      : isAdmin
        ? adminNav
        : [{ href: ROUTES.dashboard, label: "Dashboard", icon: LayoutDashboard }];

  const brandHref = isChatter ? ROUTES.chatter.home : isVA ? ROUTES.va.home : isAdmin ? ROUTES.admin.home : ROUTES.dashboard;
  const brandLabel = isVA ? "Virtual assistant" : isAdmin ? "Admin" : "Chatter";

  return (
    <aside className="glass-panel fixed left-0 top-0 z-40 hidden h-screen w-64 border-r border-white/10 md:block">
      <div className="flex h-full flex-col">
        <div className="flex h-14 items-center border-b border-white/10 px-4">
          <Link href={brandHref} className="font-semibold text-white">
            {brandLabel}
          </Link>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {items.map((item) => {
            const Icon = item.icon;
            // Only the current page gets active highlight. Parent routes (e.g. /admin) must not stay active on child routes (e.g. /admin/whales).
            const isActive =
              pathname === item.href ||
              (pathname.startsWith(item.href + "/") &&
                !items.some((o) => o.href !== item.href && pathname.startsWith(o.href)));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-[hsl(330,80%,55%)]/20 text-[hsl(330,90%,65%)]"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-3">
          <p className="truncate text-xs text-white/50">{user.email}</p>
          <p className="text-xs capitalize text-white/70">{user.role.replace("_", " ")}</p>
        </div>
      </div>
    </aside>
  );
}
