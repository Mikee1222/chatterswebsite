"use client";

import { useEffect, useState, useRef } from "react";
import { Bell } from "lucide-react";
import {
  getMyUnreadCount,
  getMyNotifications,
  markNotificationRead,
  markAllMyNotificationsRead,
} from "@/app/actions/notifications";
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
  const realtime = useRealtime();
  const centerContext = useNotificationCenter();
  const [fallbackUnread, setFallbackUnread] = useState(0);
  const [fallbackList, setFallbackList] = useState<AppNotification[]>([]);
  const [localOpen, setLocalOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const open = centerContext ? centerContext.open : localOpen;
  const setOpen = centerContext ? centerContext.setOpen : setLocalOpen;

  const unreadCount = realtime ? realtime.unreadCount : fallbackUnread;
  const setUnreadCount = realtime ? realtime.setUnreadCount : setFallbackUnread;
  const list = realtime ? realtime.notifications : fallbackList;

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
    await markAllMyNotificationsRead();
    setUnreadCount(0);
    if (realtime) {
      realtime.setNotifications((prev) =>
        prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() }))
      );
    } else {
      setFallbackList((prev) =>
        prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() }))
      );
    }
  };

  const closePanel = () => setOpen(false);
  const isAdmin = role === "admin" || role === "manager";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`relative rounded-xl p-2.5 transition-all md:rounded-lg md:p-2 ${
          unreadCount > 0
            ? "text-[hsl(330,90%,65%)] ring-1 ring-[hsl(330,80%,55%)]/30 hover:bg-[hsl(330,80%,55%)]/10 hover:ring-[hsl(330,80%,55%)]/50"
            : "text-white/70 hover:bg-white/5 hover:text-white"
        }`}
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5 md:h-5 md:w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[hsl(330,80%,55%)] px-1 text-[10px] font-semibold text-white shadow-[0_0_0_2px_rgba(0,0,0,0.9)]">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Desktop: premium dropdown panel (hidden on mobile; mobile uses sheet below) */}
      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-2 hidden w-[380px] overflow-hidden rounded-2xl border border-white/10 bg-black/95 shadow-2xl shadow-black/50 backdrop-blur-xl md:block"
          role="dialog"
          aria-label="Notification center"
          style={{
            boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 24px 48px -12px rgba(0,0,0,0.6)",
          }}
        >
          <NotificationCenterContent
            list={list}
            unreadCount={unreadCount}
            onMarkRead={handleMarkRead}
            onMarkAllRead={handleMarkAllRead}
            onNavigate={closePanel}
            role={role}
            compact
            isAdmin={isAdmin}
          />
        </div>
      )}

      {/* Mobile: full-screen notification sheet */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm md:hidden"
            aria-hidden
            onClick={closePanel}
          />
          <div
            className="fixed inset-0 top-auto z-[101] flex max-h-[88dvh] flex-col rounded-t-2xl border border-white/10 border-b-0 bg-black/95 shadow-2xl backdrop-blur-xl md:hidden"
            style={{
              paddingBottom: "env(safe-area-inset-bottom)",
              boxShadow: "0 -8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)",
            }}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
              <span className="text-lg font-semibold text-white">Notifications</span>
              <button
                type="button"
                onClick={closePanel}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-white/70 hover:bg-white/10 hover:text-white"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <NotificationCenterContent
              list={list}
              unreadCount={unreadCount}
              onMarkRead={handleMarkRead}
              onMarkAllRead={handleMarkAllRead}
              onNavigate={closePanel}
              role={role}
              compact={false}
              isAdmin={isAdmin}
            />
          </div>
        </>
      )}
    </div>
  );
}
