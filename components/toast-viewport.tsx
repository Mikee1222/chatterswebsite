"use client";

import { AnimatePresence } from "framer-motion";
import { useToast } from "@/contexts/toast-context";
import { NotificationToast } from "@/components/notification-toast";

/** Renders stacked toasts below the top bar on mobile and upper-right on desktop. */
export function ToastViewport() {
  const { toasts, removeToast } = useToast();
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-stretch gap-2 px-3 pt-[max(0.75rem,calc(env(safe-area-inset-top)+3.5rem))] md:inset-x-auto md:left-auto md:right-5 md:top-[4.5rem] md:max-w-[min(100vw-2.5rem,400px)] md:items-end md:px-0"
      aria-live="polite"
    >
      <AnimatePresence initial={false} mode="popLayout">
        {toasts.map((t) => (
          <NotificationToast
            key={t.id}
            notification={t.notification}
            onDismiss={() => removeToast(t.id)}
            className="pointer-events-auto w-full md:max-w-[min(100vw-2.5rem,400px)]"
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
