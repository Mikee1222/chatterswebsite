"use client";

import * as React from "react";
import Link from "next/link";
import type { AppNotification } from "@/types";
import type { UserRole } from "@/types";
import { ROUTES } from "@/lib/routes";
import { getEntityUrl, getEventTag, isAdminPriorityEvent } from "@/lib/notification-routes";

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 86400000 * 2) return "Yesterday";
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  } catch {
    return "";
  }
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
  onNavigate?: () => void;
  role?: UserRole | null;
  /** When true, render compact (e.g. inside dropdown). When false, more padding (sheet). */
  compact?: boolean;
  /** When true, show admin-priority styling for operational events. */
  isAdmin?: boolean;
};

export function NotificationCenterContent({
  list,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  onNavigate,
  role,
  compact = true,
  isAdmin = false,
}: NotificationCenterContentProps) {
  const groups = React.useMemo(() => groupNotifications(list), [list]);

  const handleItemClick = React.useCallback(
    async (n: AppNotification) => {
      if (!n.read_at) await onMarkRead(n.id);
      onNavigate?.();
    },
    [onMarkRead, onNavigate]
  );

  return (
    <>
      <div
        className={`flex items-center justify-between border-b border-white/10 ${compact ? "px-3 py-2.5" : "px-4 py-3"}`}
      >
        <span className="font-semibold text-white">Notifications</span>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={onMarkAllRead}
            className="text-xs font-medium text-[hsl(330,90%,65%)] hover:text-[hsl(330,92%,75%)] hover:underline"
          >
            Mark all read
          </button>
        )}
      </div>
      <div className={compact ? "max-h-[70vh] overflow-y-auto" : "flex-1 overflow-y-auto"}>
        {list.length === 0 ? (
          <div
            className={`text-center text-white/50 ${compact ? "py-8 px-4 text-sm" : "py-12 px-4 text-base"}`}
          >
            No notifications
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {groups.map(({ label, items }) => (
              <li key={label}>
                <p
                  className={`sticky top-0 z-10 bg-black/95 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/45 backdrop-blur-sm`}
                >
                  {label}
                </p>
                {items.map((n) => {
                  const url = getEntityUrl(n, role);
                  const isUnread = !n.read_at;
                  const tag = getEventTag(n.event_type);
                  const priority = isAdmin && isAdminPriorityEvent(n.event_type);
                  return (
                    <li
                      key={n.id}
                      className={`transition-colors ${
                        isUnread ? "bg-white/[0.06]" : "bg-transparent"
                      } ${priority ? "border-l-2 border-l-[hsl(330,80%,55%)]/60" : ""}`}
                    >
                      {url ? (
                        <Link
                          href={url}
                          onClick={() => handleItemClick(n)}
                          className={`block ${compact ? "px-4 py-2.5" : "px-4 py-3"}`}
                        >
                          <NotificationItemRow
                            n={n}
                            tag={tag}
                            isUnread={isUnread}
                            compact={compact}
                          />
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleItemClick(n)}
                          className={`w-full text-left ${compact ? "px-4 py-2.5" : "px-4 py-3"}`}
                        >
                          <NotificationItemRow
                            n={n}
                            tag={tag}
                            isUnread={isUnread}
                            compact={compact}
                          />
                        </button>
                      )}
                    </li>
                  );
                })}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="border-t border-white/10">
        <Link
          href={ROUTES.settings}
          onClick={onNavigate}
          className={`block text-center text-white/50 hover:bg-white/5 hover:text-white ${compact ? "py-2 text-xs" : "py-3 text-sm"}`}
        >
          Notification settings
        </Link>
      </div>
    </>
  );
}

function NotificationItemRow({
  n,
  tag,
  isUnread,
  compact,
}: {
  n: AppNotification;
  tag: string;
  isUnread: boolean;
  compact: boolean;
}) {
  return (
    <div className="flex gap-3">
      <span className="mt-1.5 shrink-0 w-2 flex justify-center">
        {isUnread && (
          <span
            className="h-2 w-2 rounded-full bg-[hsl(330,80%,55%)]"
            aria-hidden
          />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className={`font-medium text-white/95 ${compact ? "text-sm" : "text-base"}`}>
            {n.title}
          </p>
          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white/60">
            {tag}
          </span>
        </div>
        <p className={`mt-0.5 line-clamp-2 text-white/65 ${compact ? "text-xs" : "text-sm"}`}>
          {n.body}
        </p>
        <p className="mt-1 text-[11px] text-white/40">{formatTime(n.created_at)}</p>
      </div>
    </div>
  );
}
