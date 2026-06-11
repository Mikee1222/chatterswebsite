"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useAnimation } from "framer-motion";
import { Bell } from "lucide-react";
import { toast } from "sonner";
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
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const bellMotion = useAnimation();
  const prevUnreadRef = useRef<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const open = centerContext ? centerContext.open : localOpen;
  const setOpen = centerContext ? centerContext.setOpen : setLocalOpen;

  const unreadRefreshInterval = useAdaptiveRefreshInterval(0, 0);
  const unreadQuery = useNotificationsUnreadCount({
    initialData: { count: 0 },
    refreshInterval: unreadRefreshInterval,
    swr: {
      revalidateOnMount: false,
      revalidateIfStale: false,
    },
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
  const showBadge = mounted && unreadCount > 0;
  const isLoading = !realtime && unreadQuery.isValidating;

  useEffect(() => {
    if (realtime?.unreadCount == null) return;
    void mutate(
      dashboardSwrKeys.notificationsUnreadCount,
      { count: realtime.unreadCount },
      { revalidate: false }
    );
  }, [mutate, realtime?.unreadCount]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

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

  const handleMarkRead = async (id: string) => {
    const unreadCount = await markNotificationRead(id);
    const count = typeof unreadCount === "number" ? unreadCount : await getMyUnreadCount();
    setUnreadCount?.(count);
    void mutate(
      dashboardSwrKeys.notificationsUnreadCount,
      { count: Math.max(0, count) },
      { revalidate: false }
    );
    const ts = new Date().toISOString();
    if (realtime) {
      realtime.setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: n.read_at || ts } : n))
      );
    } else {
      setFallbackList((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: n.read_at || ts } : n))
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
    const count = await getMyUnreadCount();
    setUnreadCount?.(count);
    void mutate(
      dashboardSwrKeys.notificationsUnreadCount,
      { count: Math.max(0, count) },
      { revalidate: false }
    );
    router.refresh();
  };

  const handleMarkAllRead = async () => {
    if (isMarkingAllRead) return;
    setIsMarkingAllRead(true);
    const ts = new Date().toISOString();
    const prevList = list.map((n) => ({ ...n }));
    setUnreadCount?.(0);
    if (realtime) {
      realtime.setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || ts })));
    } else {
      setFallbackList((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || ts })));
    }
    try {
      const { unreadCount: count } = await markAllMyNotificationsRead();
      setUnreadCount?.(count);
      void mutate(
        dashboardSwrKeys.notificationsUnreadCount,
        { count: Math.max(0, count) },
        { revalidate: false }
      );
    } catch {
      toast.error("Couldn't mark all as read. Please try again.");
      if (realtime) realtime.setNotifications(prevList);
      else setFallbackList(prevList);
      const count = await getMyUnreadCount();
      setUnreadCount?.(count);
      void mutate(
        dashboardSwrKeys.notificationsUnreadCount,
        { count: Math.max(0, count) },
        { revalidate: false }
      );
    } finally {
      setIsMarkingAllRead(false);
    }
    router.refresh();
  };

  const closePanel = () => setOpen(false);
  const settingsHref = role === "client" ? ROUTES.client.settings : ROUTES.settings;

  const contentProps = {
    notifications: list,
    unreadCount,
    onMarkRead: handleMarkRead,
    onMarkAllRead: handleMarkAllRead,
    onDelete: handleDelete,
    onClose: closePanel,
    onNavigate: closePanel,
    settingsHref,
    isLoading,
    isMarkingAllRead,
    role: role ?? null,
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl transition-colors hover:bg-white/10"
        aria-label="Notifications"
      >
        <motion.div animate={bellMotion}>
          <Bell className="h-5 w-5 text-white/70" />
        </motion.div>
        {showBadge && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-pink-500 px-1 text-[10px] font-bold text-white shadow-lg shadow-pink-500/30">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div
              key="notif-desktop-backdrop"
              className="fixed inset-0 z-40 hidden md:block"
              onClick={closePanel}
              aria-hidden
            />
            <motion.div
              key="notif-dropdown-desktop"
              className="absolute right-0 top-12 z-50 hidden w-[400px] overflow-hidden rounded-2xl border border-white/10 bg-[#0f0a1a]/95 shadow-2xl shadow-black/50 backdrop-blur-xl md:block"
              role="dialog"
              aria-modal="true"
              aria-label="Notification center"
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              <NotificationCenterContent {...contentProps} compact />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <div key="notif-mobile-root" className="fixed inset-0 z-[100] md:hidden">
                <motion.div
                  key="notif-mobile-backdrop"
                  className="absolute inset-0 bg-black/70"
                  aria-hidden
                  onClick={closePanel}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                />
                <motion.div
                  key="notif-mobile-sheet"
                  className="absolute bottom-0 left-0 right-0 flex flex-col overflow-hidden rounded-t-3xl bg-[#0f0a1a] shadow-2xl"
                  style={{ height: "85vh" }}
                  role="dialog"
                  aria-modal="true"
                  aria-label="Notification center"
                  onClick={(e) => e.stopPropagation()}
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: "spring", damping: 28, stiffness: 320 }}
                >
                  <div
                    className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-white/20"
                    aria-hidden
                  />
                  <div className="flex-1 overflow-hidden">
                    <NotificationCenterContent {...contentProps} compact={false} isMobile />
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}
