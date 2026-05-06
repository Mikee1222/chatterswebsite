"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useAnimation } from "framer-motion";
import { Bell, X } from "lucide-react";
import { useSWRConfig } from "swr";
import {
  getMyUnreadCount,
  getMyNotifications,
  markNotificationRead,
  markAllMyNotificationsRead,
  deleteMyNotifications,
} from "@/app/actions/notifications";
import { ROUTES } from "@/lib/routes";
import { useRealtime } from "@/contexts/realtime-context";
import { useNotificationCenter } from "@/contexts/notification-center-context";
import { NotificationCenterContent } from "@/components/notification-center-content";
import { RefreshingIndicator } from "@/components/refreshing-indicator";
import {
  dashboardSwrKeys,
  useAdaptiveRefreshInterval,
  useNotificationsUnreadCount,
} from "@/lib/hooks/use-dashboard-data";
import type { AppNotification } from "@/types";
import type { UserRole } from "@/types";

type NotificationBellProps = {
  /** Role for role-aware notification routing (shift → live shifts for admin, etc.). */
  role?: UserRole | null;
};

export function NotificationBell({ role }: NotificationBellProps) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const realtime = useRealtime();
  const centerContext = useNotificationCenter();
  const [mounted, setMounted] = useState(false);
  const [fallbackList, setFallbackList] = useState<AppNotification[]>([]);
  const [localOpen, setLocalOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const bellMotion = useAnimation();
  const prevUnreadRef = useRef<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const open = centerContext ? centerContext.open : localOpen;
  const setOpen = centerContext ? centerContext.setOpen : setLocalOpen;

  const unreadRefreshInterval = useAdaptiveRefreshInterval(15_000, 0);
  const unreadQuery = useNotificationsUnreadCount({
    initialData: { count: 0 },
    refreshInterval: unreadRefreshInterval,
  });
  const unreadCount = realtime ? realtime.unreadCount : (unreadQuery.data?.count ?? 0);
  const setUnreadCount = realtime
    ? realtime.setUnreadCount
    : (next: number | ((prev: number) => number)) => {
        const current = unreadQuery.data?.count ?? 0;
        const value = typeof next === "function" ? next(current) : next;
        void mutate(
          dashboardSwrKeys.notificationsUnreadCount,
          { count: Math.max(0, value) },
          { revalidate: false }
        );
      };
  const list = realtime ? realtime.notifications : fallbackList;
  /** Only show badge numeric content after mount to avoid server/client text mismatch (unreadCount can differ). */
  const showBadge = mounted && unreadCount > 0;

  useEffect(() => {
    if (realtime?.unreadCount == null) return;
    void mutate(
      dashboardSwrKeys.notificationsUnreadCount,
      { count: realtime.unreadCount },
      { revalidate: false }
    );
  }, [mutate, realtime?.unreadCount]);

  useEffect(() => {
    if (open && !realtime) {
      getMyNotifications(false).then(({ notifications: n }) => setFallbackList(n));
    }
  }, [open, realtime]);

  useEffect(() => {
    if (open && realtime && realtime.notifications.length === 0) {
      getMyNotifications(false).then(({ notifications: n }) => realtime.setNotifications(n));
    }
  }, [open, realtime]);

  useEffect(() => {
    if (!mounted) {
      prevUnreadRef.current = unreadCount;
      return;
    }
    const prev = prevUnreadRef.current;
    prevUnreadRef.current = unreadCount;
    if (prev != null && prev !== unreadCount && unreadCount > 0) {
      void bellMotion.start({
        rotate: [0, -10, 10, -8, 8, 0],
        transition: { duration: 0.4, ease: "easeInOut" },
      });
    }
  }, [unreadCount, mounted, bellMotion]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [open, setOpen]);

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id);
    setUnreadCount?.((c) => Math.max(0, c - 1));
    await mutate(dashboardSwrKeys.notificationsUnreadCount);
    if (realtime) {
      realtime.setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
      );
    } else {
      setFallbackList((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
      );
    }
  };

  const handleDelete = async (ids: string[]) => {
    const idSet = new Set(ids);
    const removedUnread = list.filter((n) => idSet.has(n.id) && !n.read_at).length;
    await deleteMyNotifications(ids);
    if (removedUnread) setUnreadCount?.((c) => Math.max(0, c - removedUnread));
    if (realtime) {
      realtime.setNotifications((prev) => prev.filter((n) => !idSet.has(n.id)));
    } else {
      setFallbackList((prev) => prev.filter((n) => !idSet.has(n.id)));
    }
    await mutate(dashboardSwrKeys.notificationsUnreadCount);
    router.refresh();
  };

  const handleMarkAllRead = async () => {
    const ts = new Date().toISOString();
    setUnreadCount?.(0);
    if (realtime) {
      realtime.setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || ts })));
    } else {
      setFallbackList((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || ts })));
    }
    try {
      await markAllMyNotificationsRead();
    } finally {
      getMyUnreadCount().then((c) => {
        if (realtime) realtime.setUnreadCount?.(c);
        else {
          void mutate(
            dashboardSwrKeys.notificationsUnreadCount,
            { count: Math.max(0, c) },
            { revalidate: false }
          );
        }
      });
      getMyNotifications(false).then(({ notifications: n }) => {
        if (realtime) realtime.setNotifications(n);
        else setFallbackList(n);
      });
    }
    await mutate(dashboardSwrKeys.notificationsUnreadCount);
    router.refresh();
  };

  const closePanel = () => setOpen(false);
  const isAdmin = role === "admin" || role === "manager";

  return (
    <div className="relative z-50" ref={ref}>
      <motion.button
        type="button"
        onClick={() => setOpen(!open)}
        className={`relative rounded-xl p-2.5 transition-colors md:rounded-lg md:p-2 ${
          showBadge
            ? "text-[hsl(330,90%,65%)] ring-1 ring-[hsl(330,80%,55%)]/30 hover:bg-[hsl(330,80%,55%)]/10 hover:ring-[hsl(330,80%,55%)]/50"
            : "text-white/70 hover:bg-white/5 hover:text-white"
        }`}
        aria-label="Notifications"
      >
        <motion.span
          className="inline-flex"
          animate={bellMotion}
          whileHover={{ rotate: [0, -10, 10, -10, 0] }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
        >
          <Bell className="h-5 w-5 md:h-5 md:w-5" />
        </motion.span>
        {showBadge && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[hsl(330,80%,55%)] px-1 text-[10px] font-semibold text-white shadow-[0_0_0_2px_rgba(0,0,0,0.9)] transition-transform duration-200">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="notif-dropdown-desktop"
            className="absolute right-0 top-full z-50 mt-2 hidden w-[min(100vw-1.5rem,380px)] md:block"
            role="dialog"
            aria-modal="true"
            aria-label="Notification center"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: -10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            <div
              className="flex max-h-[min(85vh,560px)] flex-col overflow-hidden rounded-2xl border border-white/[0.12] bg-[#0a0a0a]/95 shadow-2xl backdrop-blur-2xl"
              style={{
                boxShadow:
                  "0 0 0 1px rgba(236,72,153,0.08), 0 0 40px -8px rgba(236,72,153,0.12), 0 24px 56px -16px rgba(0,0,0,0.75)",
              }}
            >
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.08] bg-gradient-to-r from-white/[0.04] to-transparent px-4 py-3">
                <span className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight text-white">
                  Notifications
                  <RefreshingIndicator
                    isRefreshing={unreadQuery.isValidating && !realtime}
                    label="Syncing"
                  />
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={() => void handleMarkAllRead()}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold text-pink-200 transition-colors hover:bg-pink-500/20 hover:text-white"
                    >
                      Mark all as read
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={closePanel}
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" strokeWidth={2} />
                  </button>
                </div>
              </div>
              <div className="flex min-h-0 flex-1 flex-col">
                <NotificationCenterContent
                  list={list}
                  unreadCount={unreadCount}
                  onMarkRead={handleMarkRead}
                  onMarkAllRead={handleMarkAllRead}
                  onDelete={handleDelete}
                  onNavigate={closePanel}
                  role={role ?? null}
                  compact
                  omitTitleAndMarkAll
                  isAdmin={isAdmin}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="notif-mobile-backdrop"
              className="fixed inset-0 z-[59] bg-black/75 backdrop-blur-md md:hidden"
              style={{ padding: 0, margin: 0 }}
              aria-hidden
              onClick={closePanel}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            />
            <motion.div
              key="notif-mobile-sheet"
              className="fixed bottom-0 left-0 right-0 z-[60] flex max-h-[80vh] w-full max-w-[100vw] flex-col overflow-hidden rounded-t-2xl border border-white/[0.12] border-b-0 bg-[#0c0c0c] shadow-2xl md:hidden"
              role="dialog"
              aria-modal="true"
              aria-label="Notification center"
              onClick={(e) => e.stopPropagation()}
              style={{
                boxShadow:
                  "0 -12px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(236,72,153,0.1), 0 0 32px -12px rgba(236,72,153,0.15)",
              }}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
            >
              <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-white/20" aria-hidden />
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.08] px-4 py-3.5">
                <span className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight text-white">
                  Notifications
                  <RefreshingIndicator
                    isRefreshing={unreadQuery.isValidating && !realtime}
                    label="Syncing"
                  />
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={() => void handleMarkAllRead()}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold text-pink-200 transition-colors hover:bg-pink-500/20 hover:text-white"
                    >
                      Mark all as read
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={closePanel}
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" strokeWidth={2} />
                  </button>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <NotificationCenterContent
                  list={list}
                  unreadCount={unreadCount}
                  onMarkRead={handleMarkRead}
                  onMarkAllRead={handleMarkAllRead}
                  onDelete={handleDelete}
                  onNavigate={closePanel}
                  role={role ?? null}
                  compact={false}
                  omitTitleAndMarkAll
                  omitSettingsFooter
                  isMobile
                  isAdmin={isAdmin}
                />
              </div>
              <div className="shrink-0 border-t border-white/[0.08] bg-[#0c0c0c] pb-[max(12px,env(safe-area-inset-bottom))]">
                <Link
                  href={ROUTES.settings}
                  onClick={closePanel}
                  className="block py-4 text-center text-sm text-white/50 hover:bg-white/5 hover:text-white"
                >
                  Notification settings
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
