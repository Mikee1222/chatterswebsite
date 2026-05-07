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
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        dedupingInterval: 20_000,
        focusThrottleInterval: 10_000,
        errorRetryCount: 2,
        errorRetryInterval: 8_000,
        shouldRetryOnError: false,
        keepPreviousData: true,
        onError: () => {
          // Intentionally no-op: keep previous SWR data rendered on transient revalidation failures.
        },
      }}
    >
      {children}
    </SWRConfig>
  );
}
