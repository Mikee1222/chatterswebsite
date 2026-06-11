"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  X,
  Settings,
  CreditCard,
  Activity,
  Fish,
  FileText,
  Layers,
  AlertCircle,
  type LucideIcon,
} from "lucide-react";
import type { AppNotification } from "@/types";
import type { UserRole } from "@/types";
import { ROUTES } from "@/lib/routes";
import { getEntityUrl } from "@/lib/notification-routes";

const CATEGORY_CONFIG: Record<
  string,
  {
    label: string;
    icon: LucideIcon;
    color: string;
    bg: string;
    border: string;
  }
> = {
  billing: {
    label: "Billing",
    icon: CreditCard,
    color: "text-pink-400",
    bg: "bg-pink-500/15",
    border: "border-pink-500/20",
  },
  shift: {
    label: "Shifts",
    icon: Activity,
    color: "text-blue-400",
    bg: "bg-blue-500/15",
    border: "border-blue-500/20",
  },
  whale: {
    label: "Whales",
    icon: Fish,
    color: "text-amber-400",
    bg: "bg-amber-500/15",
    border: "border-amber-500/20",
  },
  custom_request: {
    label: "Requests",
    icon: FileText,
    color: "text-violet-400",
    bg: "bg-violet-500/15",
    border: "border-violet-500/20",
  },
  model: {
    label: "Models",
    icon: Layers,
    color: "text-emerald-400",
    bg: "bg-emerald-500/15",
    border: "border-emerald-500/20",
  },
  task: {
    label: "Tasks",
    icon: CheckCheck,
    color: "text-sky-400",
    bg: "bg-sky-500/15",
    border: "border-sky-500/20",
  },
  system: {
    label: "System",
    icon: AlertCircle,
    color: "text-white/40",
    bg: "bg-white/10",
    border: "border-white/10",
  },
};

function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("el-GR");
}

function getCategory(n: AppNotification): string {
  if (n.entity_type === "billing_cycle" || n.entity_type === "payment_submission") return "billing";
  return n.category || "system";
}

const ROLE_CATEGORIES: Record<string, string[]> = {
  admin: ["all", "unread", "billing", "shift", "whale", "custom_request", "model", "task", "system"],
  manager: ["all", "unread", "billing", "shift", "whale", "custom_request", "model", "task", "system"],
  chatter: ["all", "unread", "shift", "whale", "custom_request", "task", "system"],
  virtual_assistant: ["all", "unread", "task", "custom_request", "model", "system"],
  model: ["all", "unread", "custom_request", "model", "task", "system"],
  client: ["all", "unread", "billing", "system"],
};

const ALL_TABS = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "billing", label: "Billing" },
  { key: "shift", label: "Shifts" },
  { key: "whale", label: "Whales" },
  { key: "custom_request", label: "Requests" },
  { key: "model", label: "Models" },
  { key: "task", label: "Tasks" },
  { key: "system", label: "System" },
] as const;

export type NotificationCenterContentProps = {
  /** Primary prop name (preferred). */
  notifications: AppNotification[];
  unreadCount: number;
  onMarkRead: (id: string) => void | Promise<void>;
  onMarkAllRead: () => void | Promise<void>;
  onDelete: (ids: string[]) => void | Promise<void>;
  onClose?: () => void;
  settingsHref?: string;
  isLoading?: boolean;
  /** Called when user navigates to a notification target. */
  onNavigate?: () => void;
  role?: UserRole | null;
  compact?: boolean;
  isMobile?: boolean;
  /** When true, bottom settings footer is omitted (legacy mobile shell). */
  omitSettingsFooter?: boolean;
  /** @deprecated Use `notifications` instead. */
  list?: AppNotification[];
  isMarkingAllRead?: boolean;
};

export function NotificationCenterContent({
  notifications: notificationsProp,
  list,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  onDelete,
  onClose,
  settingsHref = ROUTES.settings,
  isLoading = false,
  onNavigate,
  role,
  compact = true,
  isMobile = false,
  omitSettingsFooter = false,
  isMarkingAllRead = false,
}: NotificationCenterContentProps) {
  const notifications = notificationsProp ?? list ?? [];
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const visibleTabs = useMemo(
    () =>
      ALL_TABS.filter((tab) =>
        (ROLE_CATEGORIES[role ?? "chatter"] ?? ROLE_CATEGORIES.chatter).includes(tab.key)
      ),
    [role]
  );

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.key === activeFilter)) {
      setActiveFilter("all");
    }
  }, [visibleTabs, activeFilter]);

  const filtered = useMemo(() => {
    if (activeFilter === "all") return notifications;
    if (activeFilter === "unread") return notifications.filter((n) => !n.read_at);
    return notifications.filter((n) => getCategory(n) === activeFilter);
  }, [notifications, activeFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: notifications.length, unread: unreadCount };
    for (const n of notifications) {
      const cat = getCategory(n);
      c[cat] = (c[cat] ?? 0) + 1;
    }
    return c;
  }, [notifications, unreadCount]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleItemActivate = useCallback(
    async (n: AppNotification) => {
      if (!n.read_at) await onMarkRead(n.id);
      if (getEntityUrl(n, role)) onNavigate?.();
    },
    [onMarkRead, onNavigate, role]
  );

  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    await onDelete(ids);
    setSelectedIds(new Set());
  }, [onDelete, selectedIds]);

  const rootClass = isMobile
    ? "flex h-full min-h-0 flex-col"
    : compact
      ? "flex max-h-[min(600px,85vh)] flex-col"
      : "flex max-h-[600px] flex-col";

  return (
    <div className={rootClass}>
      <div className="flex shrink-0 items-center justify-between border-b border-white/[0.08] px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <Bell className="h-4 w-4 text-white/50" />
          <h3 className="text-sm font-semibold text-white">Notifications</h3>
          {unreadCount > 0 && (
            <span className="rounded-full border border-pink-500/30 bg-pink-500/20 px-2 py-0.5 text-[11px] font-medium text-pink-300">
              {unreadCount} new
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => void onMarkAllRead()}
              disabled={isMarkingAllRead}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-white/40 transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              {isMarkingAllRead ? "Marking..." : "Mark all read"}
            </button>
          )}
          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={() => void handleBulkDelete()}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete ({selectedIds.size})
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-white/40 transition-colors hover:bg-white/5 hover:text-white"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div
        className="scrollbar-none flex shrink-0 gap-1 overflow-x-auto border-b border-white/[0.06] px-3 py-2 [-webkit-overflow-scrolling:touch]"
      >
        {visibleTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveFilter(tab.key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              activeFilter === tab.key
                ? "border border-pink-500/20 bg-pink-500/20 text-pink-300"
                : "text-white/40 hover:bg-white/5 hover:text-white"
            }`}
          >
            {tab.label}
            {(counts[tab.key] ?? 0) > 0 && (
              <span
                className={`rounded-full px-1.5 text-[10px] ${
                  activeFilter === tab.key ? "bg-pink-500/30 text-pink-200" : "bg-white/10 text-white/40"
                }`}
              >
                {counts[tab.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      <div
        className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${isMobile ? "" : "max-h-[440px]"}`}
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-pink-500/30 border-t-pink-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center space-y-2 py-12">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5">
              <Bell className="h-6 w-6 text-white/20" />
            </div>
            <p className="text-sm font-medium text-white/40">No notifications</p>
            <p className="text-xs text-white/25">
              {activeFilter !== "all" ? "Try switching to All" : "You're all caught up!"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {filtered.map((n) => {
              const cat = getCategory(n);
              const config = CATEGORY_CONFIG[cat] ?? CATEGORY_CONFIG.system;
              const Icon = config.icon;
              const isUnread = !n.read_at;
              const isSelected = selectedIds.has(n.id);
              const url = getEntityUrl(n, role);

              const rowClass = `group relative flex min-h-[56px] cursor-pointer items-start gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.03] ${
                isUnread ? "bg-white/[0.02]" : ""
              } ${isSelected ? "bg-pink-500/5" : ""}`;

              const rowInner = (
                <>
                  {isUnread && (
                    <div className="absolute left-1.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-pink-500" />
                  )}

                  <div
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${config.bg} ${config.border}`}
                  >
                    <Icon className={`h-4 w-4 ${config.color}`} />
                  </div>

                  <div className="min-w-0 flex-1 pr-8">
                    <p className={`text-sm font-medium leading-snug ${isUnread ? "text-white" : "text-white/60"}`}>
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-white/40">{n.body}</p>
                    )}
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-[11px] text-white/25">{formatRelativeTime(n.created_at)}</span>
                      <span className={`text-[11px] ${config.color} opacity-70`}>{config.label}</span>
                    </div>
                  </div>

                  <div className="absolute right-3 top-3 flex items-center gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleSelect(n.id);
                      }}
                      className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
                        isSelected
                          ? "bg-pink-500/30 text-pink-300"
                          : "bg-white/10 text-white/40 hover:text-white"
                      }`}
                      aria-label={isSelected ? "Deselect notification" : "Select notification"}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void onDelete([n.id]);
                      }}
                      className="flex h-6 w-6 items-center justify-center rounded-md bg-white/10 text-white/40 transition-colors hover:text-red-400"
                      aria-label="Delete notification"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </>
              );

              if (url) {
                return (
                  <Link
                    key={n.id}
                    href={url}
                    className={rowClass}
                    onClick={() => void handleItemActivate(n)}
                  >
                    {rowInner}
                  </Link>
                );
              }

              return (
                <div
                  key={n.id}
                  role="button"
                  tabIndex={0}
                  className={rowClass}
                  onClick={() => void handleItemActivate(n)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      void handleItemActivate(n);
                    }
                  }}
                >
                  {rowInner}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {!isMobile && (
        <div className="flex shrink-0 items-center justify-between border-t border-white/[0.06] p-3">
          <Link
            href={settingsHref}
            onClick={onClose ?? onNavigate}
            className="flex items-center gap-1.5 text-xs text-white/30 transition-colors hover:text-white/60"
          >
            <Settings className="h-3.5 w-3.5" />
            Settings
          </Link>
          <span className="text-xs text-white/20">{notifications.length} total</span>
        </div>
      )}
    </div>
  );
}
