"use client";

import * as React from "react";

type NotificationCenterContextValue = {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

const NotificationCenterContext = React.createContext<NotificationCenterContextValue | null>(null);

export function NotificationCenterProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const value = React.useMemo<NotificationCenterContextValue>(() => ({ open, setOpen }), [open]);
  return <NotificationCenterContext.Provider value={value}>{children}</NotificationCenterContext.Provider>;
}

export function useNotificationCenter(): NotificationCenterContextValue | null {
  return React.useContext(NotificationCenterContext);
}
