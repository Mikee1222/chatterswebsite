"use client";

/**
 * Supabase live updates — only when DataBackendProvider says supabase.
 * Airtable path must keep SWR / RouterRefreshInterval / 30s polls unchanged.
 *
 * Transport (in priority order):
 * 1. Public broadcast topics `gunzo-live:<table>` (DB triggers → realtime.send)
 * 2. postgres_changes when /api/supabase/realtime-token returns a JWT
 *
 * Both call a debounced onEvent so UIs re-fetch via existing authenticated APIs.
 */

import * as React from "react";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useIsSupabaseBackend } from "@/contexts/data-backend-context";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export type GunzoRealtimePayload = {
  table: string;
  event: string;
  id?: string | null;
  user_id?: string | null;
  source: "broadcast" | "postgres_changes";
};

export type UseSupabaseRealtimeOptions = {
  /** Tables to watch (maps to gunzo-live:<table> + postgres_changes). */
  tables: string[];
  /** When false, no subscription (e.g. progress view only). Default true when supabase. */
  enabled?: boolean;
  /** Debounce coalesces bursty WAL/broadcast storms. */
  debounceMs?: number;
  /** Optional filter: ignore broadcast/pg events for other users when user_id present. */
  filterUserId?: string | null;
  onEvent: (payload: GunzoRealtimePayload) => void;
};

function normalizeUserId(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "object" && v !== null && "toString" in v) return String(v).trim() || null;
  return null;
}

export function useSupabaseRealtime(options: UseSupabaseRealtimeOptions): {
  connected: boolean;
  backendActive: boolean;
} {
  const isSupabase = useIsSupabaseBackend();
  const enabled = (options.enabled ?? true) && isSupabase;
  const tablesKey = options.tables.slice().sort().join(",");
  const debounceMs = options.debounceMs ?? 400;
  const filterUserId = options.filterUserId?.trim() || null;
  const onEventRef = React.useRef(options.onEvent);
  onEventRef.current = options.onEvent;

  const [connected, setConnected] = React.useState(false);

  React.useEffect(() => {
    if (!enabled) {
      setConnected(false);
      return;
    }

    const client = getSupabaseBrowserClient();
    if (!client) {
      setConnected(false);
      return;
    }

    const tables = tablesKey.split(",").filter(Boolean);
    if (!tables.length) return;

    let cancelled = false;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const channels: RealtimeChannel[] = [];

    const emit = (payload: GunzoRealtimePayload) => {
      if (filterUserId) {
        const uid = normalizeUserId(payload.user_id);
        if (uid && uid !== filterUserId) return;
      }
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (!cancelled) onEventRef.current(payload);
      }, debounceMs);
    };

    const handleBroadcast = (raw: { payload?: Record<string, unknown> }) => {
      const p = raw.payload ?? {};
      const table = typeof p.table === "string" ? p.table : "";
      if (table && !tables.includes(table)) return;
      emit({
        table: table || "unknown",
        event: typeof p.event === "string" ? p.event : "UNKNOWN",
        id: typeof p.id === "string" ? p.id : null,
        user_id: normalizeUserId(p.user_id),
        source: "broadcast",
      });
    };

    // Public broadcast per table (primary path — works with anon key)
    for (const table of tables) {
      const ch = client
        .channel(`gunzo-live:${table}`)
        .on("broadcast", { event: "invalidate" }, handleBroadcast)
        .subscribe((status) => {
          if (status === "SUBSCRIBED") setConnected(true);
        });
      channels.push(ch);
    }

    // Optional postgres_changes when JWT is configured on the server
    void (async () => {
      try {
        const res = await fetch("/api/supabase/realtime-token", { credentials: "include" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { token?: string | null };
        if (!data.token || cancelled) return;

        await client.realtime.setAuth(data.token);

        const pgChannel = client.channel(`gunzo-pg:${tablesKey}`);
        for (const table of tables) {
          pgChannel.on(
            "postgres_changes",
            { event: "*", schema: "public", table },
            (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
              const row = (payload.new ?? payload.old ?? {}) as Record<string, unknown>;
              emit({
                table,
                event: payload.eventType,
                id: typeof row.id === "string" ? row.id : null,
                user_id: normalizeUserId(
                  row.user_id ?? row.chatter_id ?? row.submitted_by_id ?? null
                ),
                source: "postgres_changes",
              });
            }
          );
        }
        pgChannel.subscribe((status) => {
          if (status === "SUBSCRIBED") setConnected(true);
        });
        channels.push(pgChannel);
      } catch {
        // Broadcast-only is enough; ignore JWT/pg failures
      }
    })();

    return () => {
      cancelled = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      setConnected(false);
      for (const ch of channels) {
        void client.removeChannel(ch);
      }
    };
  }, [enabled, tablesKey, debounceMs, filterUserId]);

  return { connected, backendActive: isSupabase };
}

/**
 * Convenience: subscribe and call router.refresh / reload when tables change.
 */
export function useSupabaseRealtimeRefresh(
  tables: string[],
  refresh: () => void,
  opts?: { enabled?: boolean; debounceMs?: number; filterUserId?: string | null }
) {
  const refreshRef = React.useRef(refresh);
  refreshRef.current = refresh;

  return useSupabaseRealtime({
    tables,
    enabled: opts?.enabled,
    debounceMs: opts?.debounceMs ?? 500,
    filterUserId: opts?.filterUserId,
    onEvent: () => refreshRef.current(),
  });
}
