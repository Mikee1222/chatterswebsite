"use client";

import * as React from "react";

type NotificationPromptContextValue = {
  isOpenFromSettings: boolean;
  openNotificationPrompt: () => void;
  closeNotificationPrompt: () => void;
};

const NotificationPromptContext = React.createContext<NotificationPromptContextValue | null>(null);

export function NotificationPromptProvider({ children }: { children: React.ReactNode }) {
  const [isOpenFromSettings, setIsOpenFromSettings] = React.useState(false);

  const openNotificationPrompt = React.useCallback(() => {
    setIsOpenFromSettings(true);
  }, []);

  const closeNotificationPrompt = React.useCallback(() => {
    setIsOpenFromSettings(false);
  }, []);

  const value = React.useMemo<NotificationPromptContextValue>(
    () => ({ isOpenFromSettings, openNotificationPrompt, closeNotificationPrompt }),
    [isOpenFromSettings, openNotificationPrompt, closeNotificationPrompt]
  );

  return <NotificationPromptContext.Provider value={value}>{children}</NotificationPromptContext.Provider>;
}

export function useNotificationPrompt(): NotificationPromptContextValue {
  const ctx = React.useContext(NotificationPromptContext);
  if (!ctx) {
    return {
      isOpenFromSettings: false,
      openNotificationPrompt: () => {},
      closeNotificationPrompt: () => {},
    };
  }
  return ctx;
}
