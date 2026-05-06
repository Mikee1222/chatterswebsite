"use client";

import { useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import type { AppNotification } from "@/types";
import { getEntityUrl } from "@/lib/notification-routes";
import { formatNotificationTime, NotificationCategoryIcon } from "@/lib/notification-ui";

const AUTO_DISMISS_MS = 6000;

export function NotificationToast({
  notification,
  onDismiss,
  className = "",
}: {
  notification: AppNotification;
  onDismiss: () => void;
  className?: string;
}) {
  const url = getEntityUrl(notification, undefined);
  const timeFmt = formatNotificationTime(notification.created_at);

  useEffect(() => {
    const t = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -18, scale: 0.96, filter: "blur(5px)" }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, x: 28, scale: 0.94, transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }}
      transition={{ type: "spring", damping: 26, stiffness: 360 }}
      className={`overflow-hidden rounded-xl border border-white/[0.12] bg-[#0a0a0a]/96 shadow-2xl backdrop-blur-2xl ${className}`}
      style={{
        boxShadow:
          "0 0 0 1px rgba(236,72,153,0.08), 0 16px 48px -12px rgba(0,0,0,0.55), 0 0 28px -16px rgba(236,72,153,0.12)",
      }}
      role="alert"
    >
      <motion.div
        className="h-0.5 w-full bg-gradient-to-r from-[hsl(330,78%,58%)] to-[hsl(280,65%,55%)]"
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: AUTO_DISMISS_MS / 1000, ease: "linear" }}
        style={{ transformOrigin: "left center" }}
      />
      <div className="flex gap-3 p-4">
        <NotificationCategoryIcon category={notification.category} eventType={notification.event_type} size={18} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-snug text-white/95">{notification.title}</p>
          <p className="mt-0.5 line-clamp-2 text-sm leading-relaxed text-white/65">{notification.body}</p>
          <p className="mt-1 text-xs text-white/40" title={timeFmt.title}>
            {timeFmt.label}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-3">
            {url && (
              <Link
                href={url}
                onClick={onDismiss}
                className="text-sm font-medium text-[hsl(330,90%,68%)] transition-colors hover:text-[hsl(330,92%,78%)] hover:underline"
              >
                Open
              </Link>
            )}
            <button
              type="button"
              onClick={onDismiss}
              className="text-sm text-white/50 transition-colors hover:text-white/90"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
