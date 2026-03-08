"use client";

import { useToast } from "@/contexts/toast-context";
import { NotificationToast } from "@/components/notification-toast";

/** Renders the list of toasts. Must be mounted inside ToastProvider. Stacks newest on top. */
export function ToastViewport() {
  const { toasts, removeToast } = useToast();
  return (
    <div
      className="fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-3 px-4 md:bottom-6 md:right-6 md:max-w-[400px]"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <NotificationToast
          key={t.id}
          notification={t.notification}
          onDismiss={() => removeToast(t.id)}
        />
      ))}
    </div>
  );
}
