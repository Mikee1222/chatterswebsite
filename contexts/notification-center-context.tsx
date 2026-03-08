"use client";

import * as React from "react";

type NotificationCenterContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const NotificationCenterContext = React.createContext<NotificationCenterContextValue | null>(null);

export function NotificationCenterProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const value = React.useMemo(() => ({ open, setOpen }), [open]);
  return (
    <NotificationCenterContext.Provider value={value}>
      {children}
    </NotificationCenterContext.Provider>
  );
}

export function useNotificationCenter() {
  const ctx = React.useContext(NotificationCenterContext);
  return ctx;
}
