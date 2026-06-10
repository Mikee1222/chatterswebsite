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
  LineChart,
  CalendarDays,
  CalendarClock,
  Clock,
  MessageSquarePlus,
  ImageOff,
  AlertTriangle,
  AlertCircle,
  Settings2,
  Coins,
  TrendingUp,
  Info,
  CreditCard,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/routes";
import { getModelT, MODEL_NAV_HREF_TO_LABEL_KEY } from "@/lib/model-i18n";
import type { ModelLang } from "@/lib/model-i18n";
import type { Permission } from "@/lib/permissions";
import {
  filterNavItemsByPermissions,
  getNavItemsForRole,
  navHrefIsActive,
  resolveHiddenNavItemsForSession,
  type NavIconKey,
  type NavItem,
  type NavRole,
  type ParsedHiddenNavConfig,
} from "@/lib/nav-config";
import type { SessionUser } from "@/types";
import { getNavRoleForSession } from "@/lib/staff-session-role";

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
  LineChart,
  CalendarDays,
  CalendarClock,
  Clock,
  MessageSquarePlus,
  ImageOff,
  AlertTriangle,
  AlertCircle,
  Settings2,
  Coins,
  TrendingUp,
  Info,
  CreditCard,
  BookOpen,
};

const BETA_BADGE_CLASS =
  "ml-1.5 inline-flex shrink-0 items-center rounded-md bg-pink-500/25 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-pink-300 ring-1 ring-pink-400/30";

const COMING_SOON_BADGE_CLASS =
  "ml-1.5 inline-flex shrink-0 items-center rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/55 ring-1 ring-white/15";

function NavBetaBadge() {
  return <span className={BETA_BADGE_CLASS}>BETA</span>;
}

function NavComingSoonBadge({ text }: { text: string }) {
  return <span className={COMING_SOON_BADGE_CLASS}>{text}</span>;
}

function navItemIsActive(pathname: string, item: NavItem, items: NavItem[]): boolean {
  const hrefs = items.map((i) => i.href);
  return navHrefIsActive(pathname, item.href, hrefs);
}

export function Sidebar({
  user,
  hiddenNavConfig,
  navBadgeCounts,
  modelUiLanguage,
  userPermissions = [],
}: {
  user: SessionUser;
  hiddenNavConfig: ParsedHiddenNavConfig;
  navBadgeCounts?: Record<string, number>;
  /** When set (model role), sidebar nav labels use the JSON message pack (model namespace). */
  modelUiLanguage?: ModelLang;
  userPermissions?: Permission[];
}) {
  const pathname = usePathname();
  const role = getNavRoleForSession(user);
  const hiddenForRole = React.useMemo(
    () => resolveHiddenNavItemsForSession(role, hiddenNavConfig, user.va_type),
    [hiddenNavConfig, role, user.va_type]
  );

  const baseItems: NavItem[] = React.useMemo(() => {
    const items = getNavItemsForRole(role, hiddenForRole);
    return filterNavItemsByPermissions(items, userPermissions);
  }, [role, hiddenForRole, userPermissions]);

  const items: NavItem[] = React.useMemo(() => {
    if (role !== "model" || !modelUiLanguage) return baseItems;
    const t = getModelT(modelUiLanguage);
    return baseItems.map((item) => {
      const key = MODEL_NAV_HREF_TO_LABEL_KEY[item.href];
      const label = key ? t(key) : item.label;
      const badge =
        item.href === ROUTES.model.myEarnings && item.badge ? t("nav.comingSoon") : item.badge;
      return { ...item, label, badge };
    });
  }, [baseItems, role, modelUiLanguage]);

  const brandHref =
    role === "chatter"
      ? ROUTES.chatter.home
      : role === "virtual_assistant"
        ? ROUTES.va.home
        : user.role === "model"
          ? ROUTES.model.home
          : user.role === "admin" || user.role === "manager"
            ? ROUTES.admin.home
            : ROUTES.dashboard;
  const brandLabel =
    role === "virtual_assistant"
      ? "Virtual assistant"
      : user.role === "model"
        ? modelUiLanguage
          ? getModelT(modelUiLanguage)("nav.sidebarBrand")
          : "Model"
        : user.role === "admin" || user.role === "manager"
          ? "Admin"
          : "Chatter";

  return (
    <aside className="glass-panel fixed left-0 top-0 z-40 hidden h-screen w-64 border-r border-white/[0.08] bg-black/50 shadow-[4px_0_40px_-12px_rgba(0,0,0,0.65)] backdrop-blur-xl md:block">
      <div className="flex h-full flex-col">
        <div className="flex h-[3.25rem] items-center border-b border-white/[0.08] px-5">
          <Link
            href={brandHref}
            prefetch
            className="text-[15px] font-semibold tracking-tight text-white transition-colors hover:text-pink-100/95"
          >
            {brandLabel}
          </Link>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {items.map((item, index) => {
            const prev = index > 0 ? items[index - 1] : null;
            const showSection =
              item.navSection && (!prev || prev.navSection !== item.navSection);
            const Icon = ICON_MAP[item.iconKey];
            const isActive = !item.disabled && navItemIsActive(pathname, item, items);
            const rowClass = cn(
              "group relative flex items-center gap-3.5 rounded-xl border-l-[3px] px-3.5 py-3 text-[15px] font-medium transition-[background,box-shadow,color,border-color,transform] duration-200 ease-out",
              item.disabled
                ? "cursor-not-allowed border-transparent text-white/40"
                : isActive
                  ? "border-pink-400 bg-gradient-to-r from-pink-500/22 via-pink-500/10 to-white/[0.03] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_0_28px_-12px_rgba(236,72,153,0.35)]"
                  : "border-transparent text-white/65 hover:border-white/[0.12] hover:bg-white/[0.06] hover:text-white/95 active:scale-[0.99]"
            );
            const iconClass = cn(
              "relative z-10 h-[1.35rem] w-[1.35rem] shrink-0 transition-colors duration-200",
              item.disabled
                ? "text-white/25"
                : isActive
                  ? "text-pink-200 drop-shadow-[0_0_10px_rgba(236,72,153,0.35)]"
                  : "text-white/45 group-hover:text-pink-200/85"
            );
            const sectionEl = showSection ? (
              <div
                key={`nav-section-${item.href}-${item.navSection}`}
                className="px-3.5 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-white/40 first:pt-0"
                role="presentation"
              >
                {item.navSection}
              </div>
            ) : null;

            if (item.disabled) {
              return (
                <React.Fragment key={item.href}>
                  {sectionEl}
                  <div className={rowClass} aria-disabled="true" title={item.badge}>
                    <Icon className={iconClass} aria-hidden />
                    <span className="relative z-10 min-w-0 flex-1 truncate leading-snug">
                      {item.label}
                      {item.badge ? <NavComingSoonBadge text={item.badge} /> : null}
                    </span>
                  </div>
                </React.Fragment>
              );
            }
            return (
              <React.Fragment key={item.href}>
                {sectionEl}
                <Link href={item.href} prefetch className={rowClass}>
                  <Icon className={iconClass} aria-hidden />
                  <span className="relative z-10 min-w-0 flex-1 truncate leading-snug">
                    {item.label}
                    {item.beta ? <NavBetaBadge /> : null}
                    {item.badge && !item.disabled ? <NavComingSoonBadge text={item.badge} /> : null}
                    {(navBadgeCounts?.[item.href] ?? 0) > 0 ? (
                      <span className="ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full border border-amber-500/45 bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-amber-100">
                        {(navBadgeCounts?.[item.href] ?? 0) > 99 ? "99+" : navBadgeCounts?.[item.href]}
                      </span>
                    ) : null}
                  </span>
                </Link>
              </React.Fragment>
            );
          })}
        </nav>
        <div className="space-y-1 border-t border-white/[0.08] px-4 py-4">
          <p className="truncate text-xs leading-relaxed text-white/45">{user.email}</p>
          <p className="text-[11px] font-medium uppercase tracking-wider text-pink-200/50">
            {user.role.replace("_", "")}
          </p>
        </div>
      </div>
    </aside>
  );
}
