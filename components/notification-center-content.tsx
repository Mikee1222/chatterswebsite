"use client";

import * as React from "react";
import Link from "next/link";
import type { AppNotification } from "@/types";
import type { UserRole } from "@/types";
import { ROUTES } from "@/lib/routes";
import { getEntityUrl, isAdminPriorityEvent } from "@/lib/notification-routes";
import {
  formatTime,
  getEventTag,
  getPriorityStyle,
  getTitleEmoji,
  NotificationCategoryIcon,
} from "@/lib/notification-ui";

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

type TabId = "all" | "unread" | "important" | "shift" | "task" | "custom_request" | "model" | "system";

type RetentionId = "7" | "30" | "all";

type NotificationCenterContentProps = {
  list: AppNotification[];
  unreadCount: number;
  onMarkRead: (id: string) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
  onNavigate?: () => void;
  role?: UserRole | null;
  compact?: boolean;
  isMobile?: boolean;
  isAdmin?: boolean;
  /** When true, title + "Mark all as read" row is omitted (provided by notification bell header). */
  omitTitleAndMarkAll?: boolean;
  /** When true, bottom "Notification settings" link is omitted (e.g. mobile sheet renders it inside the panel shell). */
  omitSettingsFooter?: boolean;
  retention?: RetentionId;
  onRetentionChange?: (retention: RetentionId) => void;
};

const GROUP_WINDOW_MS = 15 * 60 * 1000;

/** Group consecutive notifications of same event_type within time window for "3 tasks completed" style. */
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
    if (group.length > 1) {
      result.push({ group });
    } else {
      result.push({ single: group[0] });
    }
    i += group.length;
  }
  return result;
}

export function NotificationCenterContent({
  list,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  onNavigate,
  role,
  compact = true,
  isMobile = false,
  isAdmin = false,
  omitTitleAndMarkAll = false,
  omitSettingsFooter = false,
  retention = "all",
  onRetentionChange,
}: NotificationCenterContentProps) {
  const [tab, setTab] = React.useState<TabId>("all");
  const [localRetention, setLocalRetention] = React.useState<RetentionId>("all");
  const retentionState = retention ?? localRetention;
  const handleRetentionChange = onRetentionChange ?? setLocalRetention;
  const since = React.useMemo(() => {
    if (retentionState === "all") return null;
    const d = new Date();
    if (retentionState === "7") d.setDate(d.getDate() - 7);
    else d.setDate(d.getDate() - 30);
    return d.toISOString();
  }, [retentionState]);
  const filteredList = React.useMemo(() => {
    let base = list;
    if (since) base = base.filter((n) => n.created_at >= since);
    if (tab === "unread") return base.filter((n) => !n.read_at);
    if (tab === "important") return base.filter((n) => isAdmin && isAdminPriorityEvent(n.event_type));
    if (tab === "shift" || tab === "task" || tab === "custom_request" || tab === "model" || tab === "system") {
      return base.filter((n) => n.category === tab);
    }
    return base;
  }, [list, tab, isAdmin, since]);
  const timeGroups = React.useMemo(() => groupNotifications(filteredList), [filteredList]);

  const handleItemClick = React.useCallback(
    async (n: AppNotification) => {
      if (!n.read_at) await onMarkRead(n.id);
      onNavigate?.();
    },
    [onMarkRead, onNavigate]
  );

  const headerPadding = compact ? "px-3 py-2.5" : isMobile ? "px-4 py-3" : "px-4 py-3";
  const listPadding = isMobile ? "px-3 pb-4" : "";
  const listContainer = compact
    ? "min-h-0 flex-1 overflow-y-auto overscroll-contain"
    : isMobile && omitSettingsFooter
      ? "w-full overflow-visible"
      : "min-h-0 flex-1 overflow-y-auto overscroll-contain";
  const emptyPadding = compact ? "py-8 px-4 text-sm" : isMobile ? "py-16 px-4 text-base" : "py-12 px-4 text-base";
  const itemPadding = compact ? "px-3 py-2.5" : isMobile ? "px-4 py-3.5" : "px-4 py-3";
  const groupLabelPadding = isMobile ? "px-3 pt-4 pb-2 first:pt-2" : "px-4 py-2";
  const settingsPadding = compact ? "py-2 text-xs" : isMobile ? "py-4 text-sm pb-[max(1rem,env(safe-area-inset-bottom))]" : "py-3 text-sm";

  const rootClass =
    isMobile && omitSettingsFooter
      ? "flex w-full min-w-0 flex-col"
      : "flex min-h-0 flex-1 flex-col overflow-hidden";

  return (
    <div className={rootClass}>
      <div className={`flex flex-col border-b border-white/10 ${headerPadding}`}>
        {!omitTitleAndMarkAll && (
          <div className="flex items-center justify-between gap-3">
            <span className="font-semibold text-white">{isMobile ? "" : "Notifications"}</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllRead}
                className={`rounded-xl px-3 py-2 text-sm font-medium text-[hsl(330,90%,65%)] hover:bg-[hsl(330,80%,55%)]/15 hover:text-[hsl(330,92%,75%)] active:opacity-80 transition-colors ${isMobile ? "ml-auto" : ""}`}
              >
                Mark all as read
              </button>
            )}
          </div>
        )}
        <div className={`flex items-center gap-2 ${omitTitleAndMarkAll ? "" : "mt-2"}`}>
          <span className="text-xs text-white/50">Show:</span>
          <select
            value={retentionState}
            onChange={(e) => handleRetentionChange(e.target.value as RetentionId)}
            className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white focus:border-white/20 focus:outline-none"
          >
            <option value="all">All time</option>
            <option value="30">Last 30 days</option>
            <option value="7">Last 7 days</option>
          </select>
        </div>
        {(isMobile || !compact) && (
          <div className="mt-3 flex flex-wrap gap-1 rounded-xl bg-white/5 p-1">
            {(["all", "unread", "important"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`rounded-lg px-2 py-2 text-center text-sm font-medium transition-colors ${
                  tab === t ? "bg-white/10 text-white" : "text-white/60 hover:text-white/80"
                } ${t === "important" && !isAdmin ? "hidden" : ""}`}
              >
                {t === "all" ? "All" : t === "unread" ? `Unread ${unreadCount > 0 ? `(${unreadCount})` : ""}` : "Important"}
              </button>
            ))}
            {!isMobile && (
              <>
                {(["shift", "task", "custom_request", "model", "system"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    className={`rounded-lg px-2 py-2 text-center text-sm font-medium transition-colors ${
                      tab === t ? "bg-white/10 text-white" : "text-white/60 hover:text-white/80"
                    }`}
                  >
                    {t === "custom_request" ? "Customs" : t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>
      <div className={`${listContainer} ${listPadding}`}>
        {filteredList.length === 0 ? (
          <div className={`text-center text-white/50 ${emptyPadding}`}>
            {tab === "unread"
              ? "No unread notifications"
              : tab === "important"
                ? "No important notifications"
                : tab !== "all" && (tab === "shift" || tab === "task" || tab === "custom_request" || tab === "model" || tab === "system")
                  ? `No ${tab.replace("_", " ")} notifications`
                  : "No notifications"}
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
                          />
                        </li>
                      ) : (
                        <li key={`group-${label}-${idx}-${chunk.group[0].id}`}>
                          <NotificationGroupCard
                            group={chunk.group}
                            role={role}
                            isAdmin={isAdmin}
                            itemPadding={itemPadding}
                            isMobile={isMobile}
                            compact={compact}
                            onItemClick={handleItemClick}
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
            href={ROUTES.settings}
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
  isAdmin,
  itemPadding,
  isMobile,
  compact,
  onItemClick,
}: {
  group: AppNotification[];
  role?: UserRole | null;
  isAdmin?: boolean;
  itemPadding: string;
  isMobile?: boolean;
  compact?: boolean;
  onItemClick: (n: AppNotification) => void;
}) {
  const primary = group[0];
  const count = group.length;
  const tag = getEventTag(primary.event_type);
  const url = getEntityUrl(primary, role);
  const isUnread = group.some((n) => !n.read_at);
  const titleEmoji = getTitleEmoji(primary.event_type);
  const handleClick = () => {
    onItemClick(primary);
  };
  const cardClass = `rounded-xl border transition-all duration-200 ${
    isUnread
      ? "border-white/20 bg-white/[0.08] shadow-[0_0_0_1px_rgba(255,255,255,0.05)] hover:bg-white/[0.10]"
      : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
  }`;
  const body = count === 1 ? primary.body : `${primary.title} — ${count} similar`;
  const inner = (
    <div className="flex gap-3">
      <NotificationCategoryIcon
        category={primary.category}
        eventType={primary.event_type}
        size={compact ? 16 : 20}
        withBg
      />
      <div className="min-w-0 flex-1 space-y-1">
        <p className={`font-semibold leading-tight ${isUnread ? "text-white" : "text-white/80"} ${compact ? "text-sm" : "text-base"}`}>
          {titleEmoji && `${titleEmoji} `}
          {count} {tag}{count > 1 ? "s" : ""}
        </p>
        <p className={`line-clamp-2 text-sm ${isUnread ? "text-white/75" : "text-white/55"}`}>{body}</p>
        <p className="text-[11px] text-white/40">{formatTime(primary.created_at)}</p>
      </div>
      {isUnread && (
        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[hsl(330,80%,55%)]" style={{ boxShadow: "0 0 8px hsl(330,80%,55%)" }} aria-hidden />
      )}
    </div>
  );
  if (url) {
    return (
      <Link href={url} onClick={handleClick} className={`block ${itemPadding} ${cardClass}`}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={handleClick} className={`w-full text-left ${itemPadding} ${cardClass}`}>
      {inner}
    </button>
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
}: {
  n: AppNotification;
  role?: UserRole | null;
  isAdmin?: boolean;
  itemPadding: string;
  isMobile?: boolean;
  compact?: boolean;
  onItemClick: (n: AppNotification) => void;
}) {
  const url = getEntityUrl(n, role);
  const isUnread = !n.read_at;
  const tag = getEventTag(n.event_type);
  const priorityHighlight = isAdmin && isAdminPriorityEvent(n.event_type);
  const priorityStyle = getPriorityStyle(n.priority);

  const hasMetadata = n.metadata && n.metadata.length > 0;
  // Server sends full title with emoji; do not prepend to avoid duplication
  const titleEmoji = "";

  const cardInner = (
    <div className="flex gap-3">
      <NotificationCategoryIcon
        category={n.category}
        eventType={n.event_type}
        size={compact ? 16 : 20}
        withBg
      />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-baseline gap-2">
          <p
            className={`font-semibold break-words leading-tight transition-colors duration-200 ${
              isUnread ? "text-white" : "text-white/80"
            } ${compact ? "text-sm" : isMobile ? "text-[15px]" : "text-base"}`}
          >
            {titleEmoji && `${titleEmoji} `}
            {n.title}
          </p>
          <span
            className="shrink-0 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white/60"
          >
            {tag}
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
              <span
                key={i}
                className="rounded-md bg-white/[0.08] px-2 py-0.5 text-[11px] text-white/60"
              >
                {m.label}: {m.value}
              </span>
            ))}
          </div>
        )}
        <p className={`text-white/40 transition-colors duration-200 ${compact ? "text-[11px] mt-0.5" : isMobile ? "text-xs mt-1" : "text-[11px] mt-0.5"}`}>
          {formatTime(n.created_at)}
        </p>
      </div>
      {isUnread && (
        <span
          className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[hsl(330,80%,55%)] transition-opacity duration-200"
          style={{ boxShadow: "0 0 8px hsl(330,80%,55%)" }}
          aria-hidden
        />
      )}
    </div>
  );

  const cardClass = `rounded-xl border transition-all duration-200 ${
    isUnread
      ? "border-white/20 bg-white/[0.08] shadow-[0_0_0_1px_rgba(255,255,255,0.05)] hover:bg-white/[0.10]"
      : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
  } ${priorityHighlight ? "border-l-4 border-l-[hsl(330,80%,55%)]/70" : ""}`;

  const priorityBorderStyle =
    !priorityHighlight && (n.priority === "high" || n.priority === "critical")
      ? { borderLeftWidth: 3, borderLeftColor: priorityStyle.borderColor }
      : undefined;

  if (url) {
    return (
      <Link
        href={url}
        onClick={() => onItemClick(n)}
        className={`block ${itemPadding} ${cardClass}`}
        style={priorityBorderStyle}
      >
        {cardInner}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onItemClick(n)}
      className={`w-full text-left ${itemPadding} ${cardClass}`}
      style={priorityBorderStyle}
    >
      {cardInner}
    </button>
  );
}
