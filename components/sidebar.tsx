"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import {
  LayoutDashboard,
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
  ListTodo,
  Settings,
  Sparkles,
  Trophy,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LayoutGroup, motion } from "framer-motion";
import { ROUTES } from "@/lib/routes";
import {
  getNavItemsForRole,
  navStorageProfileForRole,
  type NavIconKey,
  type NavItem,
  type NavRole,
  type NavStorageProfile,
} from "@/lib/nav-config";
import type { SessionUser } from "@/types";

const ICON_MAP: Record<NavIconKey, ComponentType<{ className?: string }>> = {
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
  LayoutDashboard,
  ListTodo,
  Settings,
  Sparkles,
  Trophy,
  Target,
};

const BETA_BADGE_CLASS =
  "ml-1 inline-flex shrink-0 items-center rounded-md bg-pink-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-pink-400";

function NavBetaBadge() {
  return <span className={BETA_BADGE_CLASS}>BETA</span>;
}

export function Sidebar({
  user,
  hiddenNavByProfile,
}: {
  user: SessionUser;
  hiddenNavByProfile: Record<NavStorageProfile, string[]>;
}) {
  const pathname = usePathname();
  const role = (user?.role ?? "") as NavRole;
  const profile = navStorageProfileForRole(role);
  const hiddenForRole = React.useMemo(
    () => hiddenNavByProfile[profile] ?? [],
    [hiddenNavByProfile, profile]
  );

  const items: NavItem[] = React.useMemo(() => {
    return getNavItemsForRole(role, hiddenForRole);
  }, [role, hiddenForRole]);

  const brandHref = user.role === "chatter"
    ? ROUTES.chatter.home
    : user.role === "virtual_assistant"
      ? ROUTES.va.home
      : user.role === "model"
        ? ROUTES.model.home
        : user.role === "admin" || user.role === "manager"
          ? ROUTES.admin.home
          : ROUTES.dashboard;
  const brandLabel = user.role === "virtual_assistant" ? "Virtual assistant" : user.role === "model" ? "Model" : user.role === "admin" || user.role === "manager" ? "Admin" : "Chatter";

  return (
    <aside className="glass-panel fixed left-0 top-0 z-40 hidden h-screen w-64 border-r border-white/10 md:block">
      <div className="flex h-full flex-col">
        <div className="flex h-14 items-center border-b border-white/10 px-4">
          <Link href={brandHref} className="font-semibold text-white">
            {brandLabel}
          </Link>
        </div>
        <LayoutGroup id="sidebar-nav">
          <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
            {items.map((item) => {
              const Icon = ICON_MAP[item.iconKey];
              const isActive =
                pathname === item.href ||
                (pathname.startsWith(item.href + "/") &&
                  !items.some((o) => o.href !== item.href && pathname.startsWith(o.href)));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200 ease-out",
                    isActive ? "text-[hsl(330,90%,65%)]" : "text-white/70 hover:bg-white/5 hover:text-white"
                  )}
                >
                  {isActive ? (
                    <motion.span
                      layoutId="sidebar-nav-pill"
                      className="absolute inset-0 z-0 rounded-xl bg-[hsl(330,80%,55%)]/20"
                      transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.35 }}
                    />
                  ) : null}
                  <Icon className="relative z-10 h-5 w-5 shrink-0" />
                  <span className="relative z-10 min-w-0 flex-1 truncate">
                    {item.label}
                    {item.beta ? <NavBetaBadge /> : null}
                  </span>
                </Link>
              );
            })}
          </nav>
        </LayoutGroup>
        <div className="border-t border-white/10 p-3">
          <p className="truncate text-xs text-white/50">{user.email}</p>
          <p className="text-xs capitalize text-white/70">{user.role.replace("_", " ")}</p>
        </div>
      </div>
    </aside>
  );
}
