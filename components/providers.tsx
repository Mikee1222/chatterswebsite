"use client";

import * as React from "react";
import { ToastProvider } from "@/contexts/toast-context";
import { RealtimeProviderWrapper } from "@/components/realtime-provider-wrapper";
import { NotificationCenterProvider } from "@/contexts/notification-center-context";
import { NotificationPromptProvider } from "@/contexts/notification-prompt-context";
import { PwaProvider } from "@/components/pwa-provider";
import { ToastViewport } from "@/components/toast-viewport";

/**
 * Toast + realtime + notification center + PWA + notification prompt (for re-entry from More/settings).
 */
export function Providers(props: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <RealtimeProviderWrapper>
        <NotificationCenterProvider>
          <NotificationPromptProvider>
            <PwaProvider>
              <ToastViewport />
              {props.children}
            </PwaProvider>
          </NotificationPromptProvider>
        </NotificationCenterProvider>
      </RealtimeProviderWrapper>
    </ToastProvider>
  );
}
