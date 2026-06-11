"use client";

import * as React from "react";
import { RealtimeProvider } from "@/contexts/realtime-context";
import { useToast } from "@/contexts/toast-context";

export function RealtimeProviderWrapper(props: {
  children: React.ReactNode;
  initialUnreadCount?: number;
}) {
  const { addToast } = useToast();
  return (
    <RealtimeProvider addToast={addToast} initialUnreadCount={props.initialUnreadCount ?? 0}>
      {props.children}
    </RealtimeProvider>
  );
}
