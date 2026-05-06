"use client";

import * as React from "react";
import { SWRConfig } from "swr";

type DashboardSwrProviderProps = {
  children: React.ReactNode;
};

export function DashboardSwrProvider({ children }: DashboardSwrProviderProps) {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        dedupingInterval: 20_000,
        focusThrottleInterval: 10_000,
        errorRetryCount: 2,
        errorRetryInterval: 8_000,
        shouldRetryOnError: true,
      }}
    >
      {children}
    </SWRConfig>
  );
}
