"use client";

import * as React from "react";
import Link from "next/link";
import { useSWRConfig } from "swr";
import {
  Bell,
  Check,
  Loader2,
  Trash2,
  X,
  Play,
  ListTodo,
  Gem,
  DollarSign,
  Radio,
  type LucideIcon,
} from "lucide-react";
import type { AppNotification, NotificationCategory } from "@/types";
import type { UserRole } from "@/types";
import { ROUTES } from "@/lib/routes";
import { dashboardSwrKeys } from "@/lib/hooks/use-dashboard-data";
import { getEntityUrl, isAdminPriorityEvent } from "@/lib/notification-routes";
import {
  formatNotificationTime,
  getEventTag,
  getPriorityStyle,
  getTitleEmoji,
} from "@/lib/notification-ui";

type TabId = "all" | "billing" | "shift" | "whale" | "custom_request" | "system";

const CATEGORY_TABS: { id: TabId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "billing", label: "Billing" },
  { id: "shift", label: "Shift" },
  { id: "whale", label: "Whale" },
  { id: "custom_request", label: "Custom" },
  { id: "system", label: "System" },
];

const CATEGORY_ICON_MAP: Record<NotificationCategory, LucideIcon> = {
  shift: Play,
  model: Radio,
  whale: DollarSign,
  custom_request: Gem,
  task: ListTodo,
  system: Bell,
  billing: DollarSign,
};

/** Accent + background colors per category for cards and icons. */
function categoryColor(category: NotificationCategory): { accent: string; bg: string; border: string } {
  switch (category) {
    case "shift":
      return { accent: "hsl(330, 78%, 62%)", bg: "hsla(330, 78%, 58%, 0.14)", border: "hsla(330, 78%, 58%, 0.25)" };
    case "billing":
      return { accent: "hsl(142, 55%, 48%)", bg: "hsla(142, 55%, 45%, 0.14)", border: "hsla(142, 55%, 45%, 0.25)" };
    case "whale":
      return { accent: "hsl(152, 55%, 48%)", bg: "hsla(152, 55%, 42%, 0.14)", border: "hsla(152, 55%, 42%, 0.25)" };
    case "custom_request":
      return { accent: "hsl(295, 70%, 65%)", bg: "hsla(295, 70%, 62%, 0.14)", border: "hsla(295, 70%, 62%, 0.25)" };
    case "model":
      return { accent: "hsl(270, 65%, 65%)", bg: "hsla(270, 65%, 62%, 0.14)", border: "hsla(270, 65%, 62%, 0.25)" };
    case "task":
      return { accent: "hsl(262, 65%, 62%)", bg: "hsla(262, 65%, 58%, 0.14)", border: "hsla(262, 65%, 58%, 0.25)" };
    default:
      return { accent: "hsl(0, 0%, 62%)", bg: "hsla(0, 0%, 58%, 0.12)", border: "hsla(255, 255%, 100%, 0.12)" };
  }
}

/** Relative time label for notification cards. */
function formatRelativeTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    if (diffMs < 60_000) return "Just now";
    if (diffMs < 3600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
    if (diffMs < 86400_000) return `${Math.floor(diffMs / 3600_000)}h ago`;
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    if (d.getTime() >= startToday - 86400_000 && d.getTime() < startToday) {
      return `Yesterday · ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
    }
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function CategoryIcon({
  category,
  size = 18,
}: {
  category: NotificationCategory;
  size?: number;
}) {
  const colors = categoryColor(category);
  const Icon = CATEGORY_ICON_MAP[category] ?? Bell;
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-xl"
      style={{
        width: size + 12,
        height: size + 12,
        backgroundColor: colors.bg,
        color: colors.accent,
        border: `1px solid ${colors.border}`,
      }}
      aria-hidden
    >
      <Icon size={size} strokeWidth={2} />
    </span>
  );
}

function matchesTab(n: AppNotification, tab: TabId): boolean {
  if (tab === "all") return true;
  if (tab === "billing") {
    return (
      n.category === "billing" ||
      n.entity_type === "billing_cycle" ||
      n.entity_type === "payment_submission"
    );
  }
  return n.category === tab;
}

function groupNotifications(list: AppNotification[]): { label: string; items: AppNotification[] }[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const today: AppNotification[] = [];
  const earlier: AppNotification[] = [];
  for (const n of list) {
    const t = new Date(n.created_at).getTime();
    if (t >= todayStart) today.push(n);
    else earlier.push(n);
  }
  const groups: { label: string; items: AppNotification[] }[] = [];
  if (today.length) groups.push({ label: "Today", items: today });
  if (earlier.length) groups.push({ label: "Earlier", items: earlier });
  return groups;
}

type NotificationCenterContentProps = {
  list: AppNotification[];
  unreadCount: number;
  onMarkRead: (id: string) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
  onDelete?: (ids: string[]) => Promise<void>;
  onNavigate?: () => void;
  onClose?: () => void;
  role?: UserRole | null;
  compact?: boolean;
  isMobile?: boolean;
  isAdmin?: boolean;
  /** When true, bottom "Notification settings" link is omitted (e.g. mobile sheet renders it in the shell). */
  omitSettingsFooter?: boolean;
  settingsHref?: string;
};

const GROUP_WINDOW_MS = 15 * 60 * 1000;

function groupByEventAndTime(items: AppNotification[]): Array<{ single: AppNotification } | { group: AppNotification[] }> {
  const result: Array<{ single: AppNotification } | { group: AppNotification[] }> = [];
  let i = 0;
  while (i < items.length) {
    const n = items[i];
    const group: AppNotification[] = [n];
    const t0 = new Date(n.created_at).getTime();
    while (i + group.length < items.length) {
      const next = items[i + group.length];
      const tn = new Date(next.created_at).getTime();
      if (next.event_type !== n.event_type || t0 - tn > GROUP_WINDOW_MS) break;
      group.push(next);
    }
    if (group.length > 1) result.push({ group });
    else result.push({ single: group[0] });
    i += group.length;
  }
  return result;
}

export function NotificationCenterContent({
  list,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  onDelete,
  onNavigate,
  onClose,
  role,
  compact = true,
  isMobile = false,
  isAdmin = false,
  omitSettingsFooter = false,
  settingsHref = ROUTES.settings,
}: NotificationCenterContentProps) {
  const { mutate } = useSWRConfig();
  const [localList, setLocalList] = React.useState<AppNotification[]>(list);
  React.useEffect(() => {
    setLocalList(list);
  }, [list]);
  const [markAllReadLoading, setMarkAllReadLoading] = React.useState(false);
  const [tab, setTab] = React.useState<TabId>("all");

  const filteredList = React.useMemo(
    () => localList.filter((n) => matchesTab(n, tab)),
    [localList, tab]
  );
  const timeGroups = React.useMemo(() => groupNotifications(filteredList), [filteredList]);

  const handleMarkAllReadClick = React.useCallback(async () => {
    if (markAllReadLoading) return;
    setMarkAllReadLoading(true);
    try {
      await onMarkAllRead();
      const readTs = new Date().toISOString();
      setLocalList((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || readTs })));
      await mutate(dashboardSwrKeys.notificationsUnreadCount);
    } catch (e) {
      console.error("mark-all-read", e);
    } finally {
      setMarkAllReadLoading(false);
    }
  }, [markAllReadLoading, onMarkAllRead, mutate]);

  const handleItemClick = React.useCallback(
    async (n: AppNotification) => {
      if (!n.read_at) await onMarkRead(n.id);
      onNavigate?.();
    },
    [onMarkRead, onNavigate]
  );

  const headerPadding = compact ? "px-3 py-2.5" : isMobile ? "px-4 py-3" : "px-4 py-3";
  const listPadding = isMobile ? "px-3 pb-4" : "";
  const listContainer = "min-h-0 flex-1 overflow-y-auto overscroll-contain";
  const emptyPadding = compact ? "py-10 px-4 text-sm" : isMobile ? "py-16 px-4 text-base" : "py-12 px-4 text-base";
  const itemPadding = compact ? "px-3 py-2.5" : isMobile ? "px-4 py-3.5" : "px-4 py-3";
  const groupLabelPadding = isMobile ? "px-3 pt-4 pb-2 first:pt-2" : "px-4 py-2";
  const settingsPadding = compact ? "py-2.5 text-xs" : isMobile ? "py-4 text-sm" : "py-3 text-sm";

  const rootClass =
    isMobile && omitSettingsFooter
      ? "flex w-full min-w-0 min-h-0 flex-1 flex-col"
      : "flex min-h-0 flex-1 flex-col overflow-hidden";

  const badgeLabel = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <div className={rootClass}>
      <div className={`shrink-0 border-b border-white/[0.08] bg-gradient-to-r from-white/[0.04] to-transparent ${headerPadding}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-base font-semibold tracking-tight text-white">
              {isMobile ? "Notifications" : compact ? "Notifications" : "Notifications"}
            </span>
            {unreadCount > 0 && (
              <span
                className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[hsl(330,80%,55%)] px-1.5 text-[10px] font-bold text-white shadow-[0_0_12px_hsla(330,80%,55%,0.45)]"
                aria-label={`${unreadCount} unread`}
              >
                {badgeLabel}
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void handleMarkAllReadClick()}
                disabled={markAllReadLoading}
                className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-pink-200 transition-colors hover:bg-pink-500/20 hover:text-white disabled:opacity-40"
              >
                {markAllReadLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  "Mark all read"
                )}
              </button>
            )}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            )}
          </div>
        </div>
        <div className="mt-2.5 -mx-1 overflow-x-auto scrollbar-none">
          <div className="flex gap-1 px-1 pb-1">
            {CATEGORY_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  tab === t.id
                    ? "bg-[hsl(330,80%,55%)]/20 text-pink-100 ring-1 ring-[hsl(330,80%,55%)]/35"
                    : "bg-white/5 text-white/55 hover:bg-white/10 hover:text-white/80"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={`${listContainer} ${listPadding}`}>
        {filteredList.length === 0 ? (
          <div className={`flex flex-col items-center justify-center gap-3 text-center ${emptyPadding}`}>
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-[hsl(330,80%,55%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_24px_-8px_hsla(330,80%,55%,0.35)]"
              aria-hidden
            >
              <Bell className="h-7 w-7" strokeWidth={1.5} />
            </div>
            <div className="max-w-[260px] space-y-1.5">
              <p className="font-semibold text-white/90">
                {tab === "all" ? "No notifications yet" : `No ${CATEGORY_TABS.find((x) => x.id === tab)?.label ?? tab} alerts`}
              </p>
              <p className="text-sm leading-relaxed text-white/50">
                When shifts, billing, or updates arrive, they will appear here.
              </p>
            </div>
          </div>
        ) : (
          <ul className={isMobile ? "space-y-3" : "divide-y divide-white/5"}>
            {timeGroups.map(({ label, items }) => {
              const chunks = groupByEventAndTime(items);
              return (
                <li key={label}>
                  <p
                    className={`sticky top-0 z-10 text-[10px] font-semibold uppercase tracking-wider text-white/45 backdrop-blur-sm ${
                      isMobile && omitSettingsFooter ? "bg-[#111]" : "bg-black/95"
                    } ${groupLabelPadding}`}
                  >
                    {label}
                  </p>
                  <ul className={isMobile ? "space-y-3" : "space-y-2"}>
                    {chunks.map((chunk, idx) =>
                      "single" in chunk ? (
                        <li key={chunk.single.id}>
                          <NotificationCard
                            n={chunk.single}
                            role={role}
                            isAdmin={isAdmin}
                            itemPadding={itemPadding}
                            isMobile={isMobile}
                            compact={compact}
                            onItemClick={handleItemClick}
                            onMarkRead={onMarkRead}
                            onDelete={onDelete}
                          />
                        </li>
                      ) : (
                        <li key={`group-${label}-${idx}-${chunk.group[0].id}`}>
                          <NotificationGroupCard
                            group={chunk.group}
                            role={role}
                            itemPadding={itemPadding}
                            compact={compact}
                            onItemClick={handleItemClick}
                            onMarkRead={onMarkRead}
                            onDelete={onDelete}
                          />
                        </li>
                      )
                    )}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {!omitSettingsFooter && (
        <div className="shrink-0 border-t border-white/10 bg-[#111] backdrop-blur-sm">
          <Link
            href={settingsHref}
            onClick={onNavigate}
            className={`block text-center text-white/50 hover:bg-white/5 hover:text-white ${settingsPadding}`}
          >
            Notification settings
          </Link>
        </div>
      )}
    </div>
  );
}

function NotificationGroupCard({
  group,
  role,
  itemPadding,
  compact,
  onItemClick,
  onMarkRead,
  onDelete,
}: {
  group: AppNotification[];
  role?: UserRole | null;
  itemPadding: string;
  compact?: boolean;
  onItemClick: (n: AppNotification) => void;
  onMarkRead: (id: string) => Promise<void>;
  onDelete?: (ids: string[]) => Promise<void>;
}) {
  const primary = group[0];
  const count = group.length;
  const tag = getEventTag(primary.event_type);
  const url = getEntityUrl(primary, role);
  const isUnread = group.some((n) => !n.read_at);
  const titleEmoji = getTitleEmoji(primary.event_type);
  const colors = categoryColor(primary.category);
  const relativeTime = formatRelativeTime(primary.created_at);
  const [busy, setBusy] = React.useState<"read" | "delete" | null>(null);

  const handleMarkGroupRead = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isUnread || busy) return;
    setBusy("read");
    try {
      await Promise.all(group.filter((n) => !n.read_at).map((n) => onMarkRead(n.id)));
    } finally {
      setBusy(null);
    }
  };

  const handleDeleteGroup = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onDelete || busy) return;
    setBusy("delete");
    try {
      await onDelete(group.map((n) => n.id));
    } finally {
      setBusy(null);
    }
  };

  const cardClass = `flex min-w-0 overflow-hidden rounded-xl border transition-all duration-200 ${
    isUnread
      ? "border-white/20 bg-white/[0.08] shadow-[0_0_0_1px_rgba(255,255,255,0.05)] hover:bg-white/[0.10]"
      : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
  }`;
  const body = count === 1 ? primary.body : `${primary.title} — ${count} similar`;
  const mainClass = `flex min-w-0 flex-1 gap-3 ${itemPadding} text-left`;
  const mainInner = (
    <>
      <CategoryIcon category={primary.category} size={compact ? 16 : 18} />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-start gap-2">
          <p
            className={`min-w-0 flex-1 font-semibold leading-tight ${isUnread ? "text-white" : "text-white/80"} ${compact ? "text-sm" : "text-base"}`}
          >
            {titleEmoji && `${titleEmoji} `}
            {count} {tag}
            {count > 1 ? "s" : ""}
          </p>
          {isUnread && (
            <span
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[hsl(330,80%,55%)]"
              style={{ boxShadow: "0 0 8px hsl(330,80%,55%)" }}
              aria-hidden
            />
          )}
        </div>
        <p className={`line-clamp-2 text-sm ${isUnread ? "text-white/75" : "text-white/55"}`}>{body}</p>
        <p className="text-[11px] text-white/40" style={{ color: isUnread ? colors.accent : undefined }}>
          {relativeTime}
        </p>
      </div>
    </>
  );

  const actions =
    (isUnread || onDelete) && (
      <div className="flex shrink-0 flex-col justify-center gap-1 border-l border-white/[0.06] py-2 pr-2 pl-1.5">
        {isUnread && (
          <button
            type="button"
            title="Mark as read"
            aria-label="Mark group as read"
            disabled={busy !== null}
            onClick={handleMarkGroupRead}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-white/55 transition-colors hover:bg-white/10 hover:text-[hsl(330,90%,72%)] disabled:opacity-40"
          >
            {busy === "read" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" strokeWidth={2} />}
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            title="Delete"
            aria-label="Delete notifications"
            disabled={busy !== null}
            onClick={handleDeleteGroup}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-white/55 transition-colors hover:bg-red-500/15 hover:text-red-300 disabled:opacity-40"
          >
            {busy === "delete" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" strokeWidth={2} />}
          </button>
        )}
      </div>
    );

  if (url) {
    return (
      <div className={cardClass}>
        <Link href={url} onClick={() => onItemClick(primary)} className={mainClass}>
          {mainInner}
        </Link>
        {actions}
      </div>
    );
  }
  return (
    <div className={cardClass}>
      <button type="button" onClick={() => onItemClick(primary)} className={mainClass}>
        {mainInner}
      </button>
      {actions}
    </div>
  );
}

function NotificationCard({
  n,
  role,
  isAdmin,
  itemPadding,
  isMobile,
  compact,
  onItemClick,
  onMarkRead,
  onDelete,
}: {
  n: AppNotification;
  role?: UserRole | null;
  isAdmin?: boolean;
  itemPadding: string;
  isMobile?: boolean;
  compact?: boolean;
  onItemClick: (n: AppNotification) => void;
  onMarkRead: (id: string) => Promise<void>;
  onDelete?: (ids: string[]) => Promise<void>;
}) {
  const url = getEntityUrl(n, role);
  const isUnread = !n.read_at;
  const tag = getEventTag(n.event_type);
  const priorityHighlight = isAdmin && isAdminPriorityEvent(n.event_type);
  const priorityStyle = getPriorityStyle(n.priority);
  const timeFmt = formatNotificationTime(n.created_at);
  const relativeTime = formatRelativeTime(n.created_at);
  const colors = categoryColor(n.category);
  const [busy, setBusy] = React.useState<"read" | "delete" | null>(null);

  const hasMetadata = n.metadata && n.metadata.length > 0;

  const handleMarkReadOnly = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isUnread || busy) return;
    setBusy("read");
    try {
      await onMarkRead(n.id);
    } finally {
      setBusy(null);
    }
  };

  const handleDeleteOnly = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onDelete || busy) return;
    setBusy("delete");
    try {
      await onDelete([n.id]);
    } finally {
      setBusy(null);
    }
  };

  const cardInner = (
    <>
      <CategoryIcon category={n.category} size={compact ? 16 : 18} />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-baseline gap-2">
          <p
            className={`min-w-0 flex-1 font-semibold break-words leading-tight transition-colors duration-200 ${
              isUnread ? "text-white" : "text-white/80"
            } ${compact ? "text-sm" : isMobile ? "text-[15px]" : "text-base"}`}
          >
            {n.title}
          </p>
          <span className="inline-flex shrink-0 items-center gap-2">
            <span
              className="rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider"
              style={{
                borderColor: colors.border,
                backgroundColor: colors.bg,
                color: colors.accent,
              }}
            >
              {tag}
            </span>
            {isUnread && (
              <span
                className="h-2 w-2 rounded-full bg-[hsl(330,80%,55%)]"
                style={{ boxShadow: "0 0 8px hsl(330,80%,55%)" }}
                aria-hidden
              />
            )}
          </span>
        </div>
        <p
          className={`break-words leading-snug transition-colors duration-200 ${
            isUnread ? "text-white/75" : "text-white/55"
          } ${compact ? "text-xs line-clamp-2" : isMobile ? "text-sm line-clamp-3" : "text-sm line-clamp-2"}`}
        >
          {n.body}
        </p>
        {hasMetadata && (
          <div className="flex flex-wrap gap-1.5">
            {n.metadata!.map((m, i) => (
              <span key={i} className="rounded-md bg-white/[0.08] px-2 py-0.5 text-[11px] text-white/60">
                {m.label}: {m.value}
              </span>
            ))}
          </div>
        )}
        <p
          className={`transition-colors duration-200 ${compact ? "text-[11px] mt-0.5" : isMobile ? "text-xs mt-1" : "text-[11px] mt-0.5"}`}
          style={{ color: isUnread ? colors.accent : "rgba(255,255,255,0.4)" }}
          title={timeFmt.title}
        >
          {relativeTime}
        </p>
      </div>
    </>
  );

  const cardClass = `flex min-w-0 overflow-hidden rounded-xl border transition-all duration-200 ${
    isUnread
      ? "border-white/20 bg-white/[0.08] shadow-[0_0_0_1px_rgba(255,255,255,0.05)] hover:bg-white/[0.10]"
      : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
  } ${priorityHighlight ? "border-l-4 border-l-[hsl(330,80%,55%)]/70" : ""}`;

  const priorityBorderStyle =
    !priorityHighlight && (n.priority === "high" || n.priority === "critical")
      ? { borderLeftWidth: 3, borderLeftColor: priorityStyle.borderColor }
      : undefined;

  const mainClass = `flex min-w-0 flex-1 gap-3 ${itemPadding} text-left`;
  const actions =
    (isUnread || onDelete) && (
      <div className="flex shrink-0 flex-col justify-center gap-1 border-l border-white/[0.06] py-2 pr-2 pl-1.5">
        {isUnread && (
          <button
            type="button"
            title="Mark as read"
            aria-label="Mark as read"
            disabled={busy !== null}
            onClick={handleMarkReadOnly}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-white/55 transition-colors hover:bg-white/10 hover:text-[hsl(330,90%,72%)] disabled:opacity-40"
          >
            {busy === "read" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" strokeWidth={2} />}
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            title="Delete"
            aria-label="Delete notification"
            disabled={busy !== null}
            onClick={handleDeleteOnly}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-white/55 transition-colors hover:bg-red-500/15 hover:text-red-300 disabled:opacity-40"
          >
            {busy === "delete" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" strokeWidth={2} />}
          </button>
        )}
      </div>
    );

  if (url) {
    return (
      <div className={cardClass} style={priorityBorderStyle}>
        <Link href={url} onClick={() => onItemClick(n)} className={mainClass}>
          {cardInner}
        </Link>
        {actions}
      </div>
    );
  }
  return (
    <div className={cardClass} style={priorityBorderStyle}>
      <button type="button" onClick={() => onItemClick(n)} className={mainClass}>
        {cardInner}
      </button>
      {actions}
    </div>
  );
}
