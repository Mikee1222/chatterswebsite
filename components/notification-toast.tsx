"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AppNotification } from "@/types";
import { getEntityUrl } from "@/lib/notification-routes";

export function NotificationToast({
  notification,
  onDismiss,
}: {
  notification: AppNotification;
  onDismiss: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const url = getEntityUrl(notification, undefined);

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const autoDismissMs = 6000;
  useEffect(() => {
    const t = setTimeout(onDismiss, autoDismissMs);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div
      className={`overflow-hidden rounded-xl border border-white/10 bg-black/95 shadow-xl backdrop-blur-xl transition-all duration-300 ${
        visible ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0"
      }`}
      style={{
        boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 16px 40px -12px rgba(0,0,0,0.5), 0 0 0 1px rgba(236,72,153,0.08)",
      }}
      role="alert"
    >
      <div className="flex gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-white/95">{notification.title}</p>
          <p className="mt-0.5 line-clamp-2 text-sm text-white/65">{notification.body}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {url && (
              <Link
                href={url}
                onClick={onDismiss}
                className="text-sm font-medium text-[hsl(330,90%,65%)] hover:underline"
              >
                Open
              </Link>
            )}
            <button
              type="button"
              onClick={onDismiss}
              className="text-sm text-white/50 hover:text-white/80"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
