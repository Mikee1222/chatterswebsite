"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSupabaseRealtimeRefresh } from "@/lib/hooks/use-supabase-realtime";

const LIVE_SHIFT_TABLES = ["shifts", "shift_models"] as const;

/**
 * When supabase backend: subscribe to shift table changes and router.refresh().
 * No-op on airtable (RouterRefreshInterval keeps polling).
 */
export function SupabaseLiveShiftsRealtime() {
  const router = useRouter();
  useSupabaseRealtimeRefresh([...LIVE_SHIFT_TABLES], () => router.refresh(), {
    debounceMs: 600,
  });
  return null;
}
