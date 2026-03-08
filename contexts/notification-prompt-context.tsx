"use client";

import * as React from "react";

type NotificationPromptContextValue = {
  openNotificationPrompt: () => void;
  closeNotificationPrompt: () => void;
  isOpenFromSettings: boolean;
};

const NotificationPromptContext = React.createContext<NotificationPromptContextValue>({
  openNotificationPrompt: () => {},
  closeNotificationPrompt: () => {},
  isOpenFromSettings: false,
});

export function useNotificationPrompt() {
  return React.useContext(NotificationPromptContext);
}

export function NotificationPromptProvider({ children }: { children: React.ReactNode }) {
  const [isOpenFromSettings, setIsOpenFromSettings] = React.useState(false);

  const value = React.useMemo(
    () => ({
      openNotificationPrompt: () => setIsOpenFromSettings(true),
      closeNotificationPrompt: () => setIsOpenFromSettings(false),
      isOpenFromSettings,
    }),
    [isOpenFromSettings]
  );

  return (
    <NotificationPromptContext.Provider value={value}>
      {children}
    </NotificationPromptContext.Provider>
  );
}
