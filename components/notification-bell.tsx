"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useAnimation } from "framer-motion";
import { Bell } from "lucide-react";
import {
  getMyUnreadCount,
  getMyNotifications,
  markNotificationRead,
  markAllMyNotificationsRead,
} from "@/app/actions/notifications";
import { ROUTES } from "@/lib/routes";
import { useRealtime } from "@/contexts/realtime-context";
import { useNotificationCenter } from "@/contexts/notification-center-context";
import { NotificationCenterContent } from "@/components/notification-center-content";
import type { AppNotification } from "@/types";
import type { UserRole } from "@/types";

type NotificationBellProps = {
  /** Role for role-aware notification routing (shift → live shifts for admin, etc.). */
  role?: UserRole | null;
};

export function NotificationBell({ role }: NotificationBellProps) {
  const router = useRouter();
  const realtime = useRealtime();
  const centerContext = useNotificationCenter();
  const [mounted, setMounted] = useState(false);
  const [fallbackUnread, setFallbackUnread] = useState(0);
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

  const unreadCount = realtime ? realtime.unreadCount : fallbackUnread;
  const setUnreadCount = realtime ? realtime.setUnreadCount : setFallbackUnread;
  const list = realtime ? realtime.notifications : fallbackList;
  /** Only show badge numeric content after mount to avoid server/client text mismatch (unreadCount can differ). */
  const showBadge = mounted && unreadCount > 0;

  useEffect(() => {
    if (!realtime) getMyUnreadCount().then(setFallbackUnread);
  }, [realtime]);

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
        else setFallbackUnread(c);
      });
      getMyNotifications(false).then(({ notifications: n }) => {
        if (realtime) realtime.setNotifications(n);
        else setFallbackList(n);
      });
    }
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

      {/* Desktop: dropdown below bell, capped height so footer does not overlap page */}
      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-2 hidden w-[min(100vw-1.5rem,380px)] md:block"
          role="dialog"
          aria-modal="true"
          aria-label="Notification center"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="flex max-h-[min(85vh,560px)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/95 shadow-2xl shadow-black/50 backdrop-blur-xl"
            style={{
              boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 24px 48px -12px rgba(0,0,0,0.6)",
            }}
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
              <span className="text-lg font-semibold tracking-tight text-white">Notifications</span>
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
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col">
              <NotificationCenterContent
                list={list}
                unreadCount={unreadCount}
                onMarkRead={handleMarkRead}
                onMarkAllRead={handleMarkAllRead}
                onNavigate={closePanel}
                role={role}
                compact
                omitTitleAndMarkAll
                isAdmin={isAdmin}
              />
            </div>
          </div>
        </div>
      )}

      {/* Mobile: bottom sheet; backdrop below sheet z-index so panel stays on top */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-[59] bg-black/70 backdrop-blur-sm md:hidden"
            style={{ padding: 0, margin: 0 }}
            aria-hidden
            onClick={closePanel}
          />
          <div
            className="fixed bottom-0 left-0 right-0 z-[60] flex max-h-[80vh] w-full max-w-[100vw] flex-col overflow-hidden rounded-t-2xl border border-white/10 border-b-0 bg-[#111] shadow-2xl md:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Notification center"
            onClick={(e) => e.stopPropagation()}
            style={{
              boxShadow: "0 -8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)",
            }}
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 bg-[#111] px-4 py-3.5">
              <span className="text-lg font-semibold tracking-tight text-white">Notifications</span>
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
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <NotificationCenterContent
                list={list}
                unreadCount={unreadCount}
                onMarkRead={handleMarkRead}
                onMarkAllRead={handleMarkAllRead}
                onNavigate={closePanel}
                role={role}
                compact={false}
                omitTitleAndMarkAll
                omitSettingsFooter
                isMobile
                isAdmin={isAdmin}
              />
            </div>
            <div className="shrink-0 border-t border-white/10 bg-[#111] pb-[max(12px,env(safe-area-inset-bottom))]">
              <Link
                href={ROUTES.settings}
                onClick={closePanel}
                className="block py-4 text-center text-sm text-white/50 hover:bg-white/5 hover:text-white"
              >
                Notification settings
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
