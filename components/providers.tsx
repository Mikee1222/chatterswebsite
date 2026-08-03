"use client";

import * as React from "react";
import { ToastProvider } from "@/contexts/toast-context";
import { RealtimeProviderWrapper } from "@/components/realtime-provider-wrapper";
import { NotificationCenterProvider } from "@/contexts/notification-center-context";
import { NotificationPromptProvider } from "@/contexts/notification-prompt-context";
import { PwaProvider } from "@/components/pwa-provider";
import { ToastViewport } from "@/components/toast-viewport";
import { DashboardSwrProvider } from "@/components/dashboard-swr-provider";
import { FeedbackModalProvider } from "@/contexts/feedback-modal-context";
import { DataBackendProvider } from "@/contexts/data-backend-context";
import type { DataBackend } from "@/lib/data-backend";

/**
 * Toast + realtime + notification center + PWA + notification prompt (for re-entry from More/settings).
 * `dataBackend` is injected from the server layout (getDataBackend) so client Realtime
 * only activates when Preview/staging runs DATA_BACKEND=supabase — not via a Production NEXT_PUBLIC_ flag.
 */
export function Providers(props: {
  children: React.ReactNode;
  initialUnreadCount?: number;
  dataBackend?: DataBackend;
}) {
  return (
    <DataBackendProvider backend={props.dataBackend ?? "airtable"}>
      <DashboardSwrProvider>
        <ToastProvider>
          <RealtimeProviderWrapper initialUnreadCount={props.initialUnreadCount}>
            <NotificationCenterProvider>
              <NotificationPromptProvider>
                <PwaProvider>
                  <ToastViewport />
                  <FeedbackModalProvider>{props.children}</FeedbackModalProvider>
                </PwaProvider>
              </NotificationPromptProvider>
            </NotificationCenterProvider>
          </RealtimeProviderWrapper>
        </ToastProvider>
      </DashboardSwrProvider>
    </DataBackendProvider>
  );
}
