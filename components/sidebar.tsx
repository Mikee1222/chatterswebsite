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
  Link2,
  ChevronDown,
  Search,
  Pin,
  PinOff,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/routes";
import { getModelT, MODEL_NAV_HREF_TO_LABEL_KEY } from "@/lib/model-i18n";
import type { ModelLang } from "@/lib/model-i18n";
import type { Permission } from "@/lib/permissions";
import {
  buildNavItemsForUser,
  groupNavItemsBySection,
  isCustomNavRole,
  navHrefIsActive,
  resolveHiddenNavItemsForSession,
  type NavIconKey,
  type NavItem,
  type NavRole,
  type ParsedHiddenNavConfig,
} from "@/lib/nav-config";
import type { SessionUser, SopColor } from "@/types";
import { getNavRoleForSession } from "@/lib/staff-session-role";
import { useSidebar } from "@/contexts/sidebar-context";
import { SOP_COLOR_STYLES } from "@/components/sop/sop-colors";

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
  Link2,
};

const BETA_BADGE_CLASS =
  "ml-1.5 inline-flex shrink-0 items-center rounded-md bg-pink-500/25 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-pink-300 ring-1 ring-pink-400/30";

const COMING_SOON_BADGE_CLASS =
  "ml-1.5 inline-flex shrink-0 items-center rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/55 ring-1 ring-white/15";

const PINNED_SECTION_KEY = "Pinned";
const COLLAPSED_SECTIONS_KEY = "sidebar_collapsed_sections";
const PINNED_ITEMS_KEY = "sidebar_pinned_items";
const MAX_PINNED = 6;

const SYSTEM_ROLE_COLORS: Record<string, SopColor> = {
  admin: "pink",
  manager: "blue",
  chatter: "green",
  virtual_assistant: "purple",
  model: "orange",
  client: "gray",
};

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

function readJsonArray(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

function writeJsonArray(key: string, value: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

function getInitials(user: SessionUser): string {
  const name = user.fullName?.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  const email = user.email?.trim() ?? "";
  if (email) return email.slice(0, 2).toUpperCase();
  return "??";
}

function resolveRoleColor(color: string | undefined, role: string): SopColor {
  const key = (color?.trim() || SYSTEM_ROLE_COLORS[role.toLowerCase()] || "gray") as SopColor;
  return key in SOP_COLOR_STYLES ? key : "gray";
}

export type SidebarQuickStats = {
  activeShiftsCount: number;
  freeModelsCount: number;
};

export function Sidebar({
  user,
  hiddenNavConfig,
  navBadgeCounts,
  modelUiLanguage,
  userPermissions = [],
  quickStats,
  roleLabel,
  roleColor,
}: {
  user: SessionUser;
  hiddenNavConfig: ParsedHiddenNavConfig;
  navBadgeCounts?: Record<string, number>;
  modelUiLanguage?: ModelLang;
  userPermissions?: Permission[];
  quickStats?: SidebarQuickStats;
  roleLabel?: string;
  roleColor?: string;
}) {
  const pathname = usePathname();
  const { collapsed, toggleCollapsed } = useSidebar();
  const role = getNavRoleForSession(user);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const searchContainerRef = React.useRef<HTMLDivElement>(null);

  const [collapsedSections, setCollapsedSections] = React.useState<string[]>([]);
  const [pinnedHrefs, setPinnedHrefs] = React.useState<string[]>([]);
  const [sectionsHydrated, setSectionsHydrated] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  React.useEffect(() => {
    setCollapsedSections(readJsonArray(COLLAPSED_SECTIONS_KEY));
    setPinnedHrefs(readJsonArray(PINNED_ITEMS_KEY).slice(0, MAX_PINNED));
    setSectionsHydrated(true);
  }, []);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && !searchOpen) {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName?.toLowerCase();
        if (tag === "input" || tag === "textarea" || target?.isContentEditable) return;
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape" && searchOpen) {
        setSearchOpen(false);
        setSearchQuery("");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [searchOpen]);

  React.useEffect(() => {
    if (searchOpen) {
      const t = window.setTimeout(() => searchInputRef.current?.focus(), 0);
      return () => window.clearTimeout(t);
    }
    setSearchQuery("");
  }, [searchOpen]);

  React.useEffect(() => {
    if (!searchOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!searchContainerRef.current?.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [searchOpen]);

  const hiddenForRole = React.useMemo(
    () => resolveHiddenNavItemsForSession(role, hiddenNavConfig, user.va_type),
    [hiddenNavConfig, role, user.va_type]
  );

  const baseItems: NavItem[] = React.useMemo(() => {
    return buildNavItemsForUser(role, userPermissions, hiddenForRole);
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

  const isAdminAreaUser =
    user.role === "admin" || user.role === "manager" || isCustomNavRole(user.role);

  const itemByHref = React.useMemo(() => new Map(items.map((i) => [i.href, i])), [items]);

  const pinnedItems = React.useMemo(
    () =>
      pinnedHrefs
        .map((href) => itemByHref.get(href))
        .filter((item): item is NavItem => item != null),
    [pinnedHrefs, itemByHref]
  );

  // Every role's nav groups into the same canonical labeled sections (NAV_SECTION_ORDER),
  // not just the admin area — custom roles included, well-organized by construction.
  const navSections = React.useMemo(() => groupNavItemsBySection(items), [items]);

  const searchResults = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return items
      .filter((item) => !item.disabled && item.label.toLowerCase().includes(q))
      .map((item) => ({ item, section: item.navSection ?? "" }));
  }, [items, searchQuery]);

  const brandHref =
    role === "chatter"
      ? ROUTES.chatter.home
      : role === "virtual_assistant"
        ? ROUTES.va.home
        : user.role === "model"
          ? ROUTES.model.home
          : isAdminAreaUser
            ? isCustomNavRole(user.role)
              ? ROUTES.admin.customRoleHome
              : ROUTES.admin.home
            : ROUTES.dashboard;

  const resolvedRoleColor = resolveRoleColor(roleColor, user.role);
  const roleStyle = SOP_COLOR_STYLES[resolvedRoleColor];
  const displayRoleLabel =
    roleLabel?.trim() ||
    (role === "virtual_assistant"
      ? "VA"
      : user.role === "model"
        ? modelUiLanguage
          ? getModelT(modelUiLanguage)("nav.sidebarBrand")
          : "Model"
        : user.role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));

  const toggleSection = (section: string) => {
    setCollapsedSections((prev) => {
      const next = prev.includes(section)
        ? prev.filter((s) => s !== section)
        : [...prev, section];
      writeJsonArray(COLLAPSED_SECTIONS_KEY, next);
      return next;
    });
  };

  const togglePin = (href: string) => {
    setPinnedHrefs((prev) => {
      let next: string[];
      if (prev.includes(href)) {
        next = prev.filter((h) => h !== href);
      } else if (prev.length >= MAX_PINNED) {
        next = prev;
      } else {
        next = [...prev, href];
      }
      writeJsonArray(PINNED_ITEMS_KEY, next);
      return next;
    });
  };

  const isSectionCollapsed = (section: string) =>
    sectionsHydrated && collapsedSections.includes(section);

  const renderNavItem = (item: NavItem, options?: { showSectionSubtitle?: boolean }) => {
    const Icon = ICON_MAP[item.iconKey];
    const isActive = !item.disabled && navItemIsActive(pathname, item, items);
    const isPinned = pinnedHrefs.includes(item.href);
    const badgeCount = navBadgeCounts?.[item.href] ?? 0;

    const rowClass = cn(
      "group/nav relative flex items-center gap-3 rounded-lg border-l-2 px-3 py-2.5 text-[14px] font-medium transition-[background,color,border-color] duration-200 ease-out",
      collapsed ? "justify-center px-2" : "gap-3",
      item.disabled
        ? "cursor-not-allowed border-transparent text-white/40"
        : isActive
          ? "border-pink-400 bg-pink-500/12 text-pink-200"
          : "border-transparent text-white/65 hover:bg-white/[0.05] hover:text-white/95"
    );

    const iconClass = cn(
      "h-[1.2rem] w-[1.2rem] shrink-0 transition-colors duration-200",
      item.disabled
        ? "text-white/25"
        : isActive
          ? "text-pink-300"
          : "text-white/45 group-hover/nav:text-white/80"
    );

    const labelContent = (
      <>
        <span className="relative shrink-0">
          <Icon className={iconClass} aria-hidden />
          {collapsed && badgeCount > 0 ? (
            <span className="absolute -right-1.5 -top-1 inline-flex min-h-[0.875rem] min-w-[0.875rem] items-center justify-center rounded-full border border-amber-500/45 bg-amber-500/90 px-0.5 text-[9px] font-bold leading-none tabular-nums text-amber-950">
              {badgeCount > 9 ? "9+" : badgeCount}
            </span>
          ) : null}
        </span>
        {!collapsed ? (
          <span className="min-w-0 flex-1 truncate leading-snug">
            {item.label}
            {item.beta ? <NavBetaBadge /> : null}
            {item.badge && !item.disabled ? <NavComingSoonBadge text={item.badge} /> : null}
            {badgeCount > 0 ? (
              <span className="ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full border border-amber-500/45 bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-amber-100">
                {badgeCount > 99 ? "99+" : badgeCount}
              </span>
            ) : null}
          </span>
        ) : null}
      </>
    );

    const pinButton =
      !collapsed && !item.disabled ? (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            togglePin(item.href);
          }}
          className={cn(
            "absolute right-1.5 top-1/2 z-20 -translate-y-1/2 rounded-md p-1 text-white/40 transition-opacity hover:bg-white/10 hover:text-pink-300",
            isPinned ? "opacity-100 text-pink-300" : "opacity-0 group-hover/nav:opacity-100"
          )}
          aria-label={isPinned ? "Unpin from sidebar" : "Pin to sidebar"}
          title={isPinned ? "Unpin" : "Pin"}
        >
          {isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
        </button>
      ) : null;

    const tooltipTitle = collapsed ? item.label : undefined;

    if (item.disabled) {
      return (
        <div key={item.href} className={rowClass} aria-disabled="true" title={tooltipTitle ?? item.badge}>
          {labelContent}
        </div>
      );
    }

    return (
      <div key={item.href} className="relative">
        <Link
          href={item.href}
          prefetch
          className={cn(rowClass, !collapsed && "pr-8")}
          title={tooltipTitle}
        >
          {labelContent}
        </Link>
        {pinButton}
        {options?.showSectionSubtitle && !collapsed && item.navSection ? (
          <p className="px-3 pb-1 pt-0.5 text-[10px] uppercase tracking-wider text-white/35">
            {item.navSection}
          </p>
        ) : null}
      </div>
    );
  };

  const renderSection = (section: string, sectionItems: NavItem[]) => {
    const sectionCollapsed = isSectionCollapsed(section);
    return (
      <div key={section} className="mb-1">
        {!collapsed ? (
          <button
            type="button"
            onClick={() => toggleSection(section)}
            className="flex w-full items-center gap-1.5 px-3 pb-1 pt-3 text-left text-[11px] font-semibold uppercase tracking-wider text-white/40 first:pt-1 hover:text-white/55"
          >
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                sectionCollapsed && "-rotate-90"
              )}
              aria-hidden
            />
            <span className="truncate">{section}</span>
          </button>
        ) : null}
        <div
          className={cn(
            "overflow-hidden transition-[max-height] duration-200 ease-out",
            collapsed || !sectionCollapsed ? "max-h-[2000px]" : "max-h-0"
          )}
        >
          <div className="space-y-0.5">
            {sectionItems.map((item) => renderNavItem(item))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <aside
      className={cn(
        "glass-panel fixed left-0 top-0 z-40 hidden h-screen border-r border-white/[0.08] bg-black/50 shadow-[4px_0_40px_-12px_rgba(0,0,0,0.65)] backdrop-blur-xl transition-[width] duration-200 md:block",
        collapsed ? "w-14" : "w-64"
      )}
    >
      <div className="flex h-full flex-col">
        {/* Brand */}
        <div
          className={cn(
            "flex h-[3.25rem] shrink-0 items-center border-b border-white/[0.08]",
            collapsed ? "justify-center px-1" : "justify-between gap-2 px-3"
          )}
        >
          {collapsed ? (
            <Link
              href={brandHref}
              prefetch
              className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white transition-colors hover:bg-white/10 hover:text-pink-100"
              title="Gunzo"
            >
              G
            </Link>
          ) : (
            <Link
              href={brandHref}
              prefetch
              className="flex min-w-0 flex-1 items-center gap-2 text-[15px] font-semibold tracking-tight text-white transition-colors hover:text-pink-100/95"
            >
              <span className="truncate">Gunzo</span>
              <span
                className={cn(
                  "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                  roleStyle.badge
                )}
              >
                {displayRoleLabel}
              </span>
            </Link>
          )}
        </div>

        {/* Search */}
        {!collapsed ? (
          <div ref={searchContainerRef} className="border-b border-white/[0.06] px-3 py-2.5">
            {searchOpen ? (
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
                <input
                  ref={searchInputRef}
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search navigation…"
                  className="w-full rounded-lg border border-white/10 bg-white/[0.04] py-2 pl-8 pr-8 text-sm text-white placeholder:text-white/35 focus:border-pink-500/40 focus:outline-none focus:ring-1 focus:ring-pink-500/25"
                />
                <button
                  type="button"
                  onClick={() => setSearchOpen(false)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-white/40 hover:text-white/70"
                  aria-label="Close search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="flex w-full items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white/45 transition-colors hover:border-white/15 hover:bg-white/[0.06] hover:text-white/65"
              >
                <Search className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1 text-left">Search</span>
                <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-white/35">
                  /
                </kbd>
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center border-b border-white/[0.06] py-2">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="rounded-lg p-2 text-white/45 hover:bg-white/10 hover:text-white/80"
              aria-label="Search navigation"
              title="Search (/)"
            >
              <Search className="h-4 w-4" />
            </button>
          </div>
        )}

        {collapsed && searchOpen ? (
          <div
            ref={searchContainerRef}
            className="absolute left-full top-14 z-50 ml-2 w-56 rounded-xl border border-white/10 bg-black/90 p-2 shadow-xl backdrop-blur-xl"
          >
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
              <input
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search navigation…"
                className="w-full rounded-lg border border-white/10 bg-white/[0.04] py-2 pl-8 pr-8 text-sm text-white placeholder:text-white/35 focus:border-pink-500/40 focus:outline-none focus:ring-1 focus:ring-pink-500/25"
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-white/40 hover:text-white/70"
                aria-label="Close search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : null}

        {/* Nav */}
        <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-2 scrollbar-hide">
          {searchOpen && searchQuery.trim() ? (
            <div className="space-y-0.5">
              {searchResults.length === 0 ? (
                <p className="px-3 py-4 text-center text-sm text-white/40">No matches</p>
              ) : (
                searchResults.map(({ item }) => renderNavItem(item, { showSectionSubtitle: true }))
              )}
            </div>
          ) : (
            <>
              {isAdminAreaUser && pinnedItems.length > 0 ? (
                renderSection(PINNED_SECTION_KEY, pinnedItems)
              ) : null}

              {navSections.map(({ section, items: sectionItems }) =>
                renderSection(section, sectionItems)
              )}
            </>
          )}
        </nav>

        {/* Collapse + quick stats + user */}
        <div className="shrink-0 border-t border-white/[0.08]">
          <div
            className={cn(
              "flex border-b border-white/[0.06]",
              collapsed ? "justify-center px-2 py-2" : "px-3 py-2"
            )}
          >
            <button
              type="button"
              onClick={toggleCollapsed}
              className="rounded-lg p-1.5 text-white/45 transition-colors hover:bg-white/10 hover:text-white"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </button>
          </div>

          {quickStats && !collapsed ? (
            <div className="border-b border-white/[0.06] px-4 py-2.5 text-[11px] text-white/50">
              <span className="text-emerald-400">●</span>{" "}
              <span className="tabular-nums text-white/70">{quickStats.activeShiftsCount} shifts active</span>
              <span className="mx-1.5 text-white/25">·</span>
              <span className="tabular-nums text-white/70">{quickStats.freeModelsCount} models free</span>
            </div>
          ) : null}

          <div
            className={cn(
              "flex items-center gap-3 px-3 py-3",
              collapsed && "justify-center px-2"
            )}
            title={collapsed ? `${user.email} — ${displayRoleLabel}` : undefined}
          >
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                roleStyle.badge
              )}
              aria-hidden
            >
              {getInitials(user)}
            </div>
            {!collapsed ? (
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs leading-relaxed text-white/70">{user.email}</p>
                <span
                  className={cn(
                    "mt-1 inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    roleStyle.badge
                  )}
                >
                  {displayRoleLabel}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </aside>
  );
}
