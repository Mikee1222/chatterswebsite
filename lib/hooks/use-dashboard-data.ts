"use client";

import * as React from "react";
import useSWR, { type SWRConfiguration, type SWRResponse } from "swr";
import { getTodayYmdAthens } from "@/lib/airtable-datetime";
import type { InflowwEarningsResponse } from "@/types/infloww";

export const dashboardSwrKeys = {
  notificationsUnreadCount: "/api/notifications/unread-count",
  inflowwTodayEarnings: "/api/infloww/today-earnings",
  inflowwEarningsByDate: (from: string, to: string) =>
    `/api/infloww/earnings?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
} as const;

type NotificationUnreadCountResponse = { count: number };
type InflowwTodayEarningsResponse = { date: string; gross: number; net: number; agency_cut: number };

export const dashboardFetcher = async <T>(url: string): Promise<T> => {
  const response = await fetch(url, {
    credentials: "include",
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => ({}))) as { error?: unknown };
  if (!response.ok) {
    const message = typeof payload.error === "string" ? payload.error : `Request failed (${response.status})`;
    throw new Error(message);
  }

  return payload as T;
};

export function useAdaptiveRefreshInterval(baseIntervalMs: number, hiddenIntervalMs = 0): number {
  const [refreshInterval, setRefreshInterval] = React.useState(baseIntervalMs);

  React.useEffect(() => {
    const update = () => {
      if (document.visibilityState === "visible") {
        setRefreshInterval(baseIntervalMs);
      } else {
        setRefreshInterval(hiddenIntervalMs);
      }
    };

    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, [baseIntervalMs, hiddenIntervalMs]);

  return refreshInterval;
}

export function useNotificationsUnreadCount(options?: {
  initialData?: NotificationUnreadCountResponse;
  refreshInterval?: number;
  swr?: SWRConfiguration<NotificationUnreadCountResponse, Error>;
}): SWRResponse<NotificationUnreadCountResponse, Error> {
  return useSWR<NotificationUnreadCountResponse, Error>(
    dashboardSwrKeys.notificationsUnreadCount,
    dashboardFetcher,
    {
      refreshInterval: options?.refreshInterval ?? 30_000,
      fallbackData: options?.initialData,
      ...options?.swr,
    }
  );
}

export function useInflowwTodayEarnings(options?: {
  initialData?: InflowwTodayEarningsResponse;
  refreshInterval?: number;
  swr?: SWRConfiguration<InflowwTodayEarningsResponse, Error>;
}): SWRResponse<InflowwTodayEarningsResponse, Error> {
  return useSWR<InflowwTodayEarningsResponse, Error>(
    dashboardSwrKeys.inflowwTodayEarnings,
    dashboardFetcher,
    {
      refreshInterval: options?.refreshInterval ?? 60_000,
      fallbackData: options?.initialData,
      ...options?.swr,
    }
  );
}

export function useAdminTodayEarnings(options?: {
  refreshInterval?: number;
  swr?: SWRConfiguration<InflowwEarningsResponse, Error>;
}): SWRResponse<InflowwEarningsResponse, Error> {
  const today = getTodayYmdAthens();
  const key = dashboardSwrKeys.inflowwEarningsByDate(today, today);
  return useSWR<InflowwEarningsResponse, Error>(key, dashboardFetcher, {
    refreshInterval: options?.refreshInterval ?? 5 * 60_000,
    ...options?.swr,
  });
}
