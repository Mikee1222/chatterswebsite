"use client";

import * as React from "react";
import { RealtimeProvider } from "@/contexts/realtime-context";
import { useToast } from "@/contexts/toast-context";

export function RealtimeProviderWrapper(props: { children: React.ReactNode }) {
  const { addToast } = useToast();
  return (
    <RealtimeProvider addToast={addToast} initialUnreadCount={0}>
      {props.children}
    </RealtimeProvider>
  );
}
