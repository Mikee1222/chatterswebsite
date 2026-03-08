"use client";

import * as React from "react";
import type { AppNotification } from "@/types";

type ToastItem = {
  id: string;
  notification: AppNotification;
  createdAt: number;
};

type ToastContextValue = {
  toasts: ToastItem[];
  addToast: (notification: AppNotification) => void;
  removeToast: (id: string) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function ToastProvider(props: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const addToast = React.useCallback((notification: AppNotification) => {
    setToasts((prev) => {
      const exists = prev.some((t) => t.id === notification.id);
      if (exists) return prev;
      return [{ id: notification.id, notification, createdAt: Date.now() }, ...prev].slice(0, 10);
    });
  }, []);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value = React.useMemo(
    () => ({ toasts, addToast, removeToast }),
    [toasts, addToast, removeToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {props.children}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (ctx == null) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
