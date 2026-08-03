"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useIsSupabaseBackend } from "@/contexts/data-backend-context";

/**
 * Periodically refreshes server components (e.g. live shift lists) without full navigation.
 * When DATA_BACKEND=supabase, polling is disabled — pages should use useSupabaseRealtimeRefresh
 * (or rely on parent subscriptions) instead. Manual Refresh buttons stay as fallback.
 */
export function RouterRefreshInterval({
  children,
  intervalMs,
  /** Force polling even on supabase (escape hatch). Default: poll only on airtable. */
  forcePoll,
}: {
  children: React.ReactNode;
  intervalMs: number;
  forcePoll?: boolean;
}) {
  const router = useRouter();
  const isSupabase = useIsSupabaseBackend();
  const shouldPoll = forcePoll === true || (!isSupabase && intervalMs > 0);

  React.useEffect(() => {
    if (!shouldPoll) return;
    const id = setInterval(() => {
      router.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs, shouldPoll]);

  return <>{children}</>;
}
