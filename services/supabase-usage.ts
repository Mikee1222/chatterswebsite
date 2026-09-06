/**
 * Supabase DB + Storage usage snapshot (via get_supabase_usage_stats RPC).
 * Used by Integration Health to warn before Pro plan quotas are approached.
 */

import { getSupabaseServiceClient } from "@/lib/supabase-server";

/** Soft thresholds vs Pro included quotas (100 GB storage / 8 GB DB). */
export const STORAGE_AMBER_BYTES = 40 * 1024 * 1024 * 1024; // 40 GB
export const STORAGE_RED_BYTES = 80 * 1024 * 1024 * 1024; // 80 GB
export const DB_AMBER_BYTES = 4 * 1024 * 1024 * 1024; // 4 GB
export const DB_RED_BYTES = 6 * 1024 * 1024 * 1024; // 6 GB

export type StorageBucketUsage = {
  name: string;
  objects: number;
  bytes: number;
};

export type TableUsage = {
  name: string;
  approx_rows: number;
  total_bytes: number;
};

export type SupabaseUsageSnapshot = {
  generatedAt: string;
  dbBytes: number;
  storageBytes: number;
  buckets: StorageBucketUsage[];
  tables: TableUsage[];
  /** Human-readable alerts for Integration Health. */
  alerts: string[];
  status: "green" | "amber" | "red";
};

function n(v: unknown): number {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export async function getSupabaseUsageSnapshot(): Promise<SupabaseUsageSnapshot | null> {
  try {
    const sb = getSupabaseServiceClient();
    const { data, error } = await sb.rpc("get_supabase_usage_stats");
    if (error || data == null) {
      console.error("[supabase-usage] rpc failed", error?.message);
      return null;
    }
    const raw = data as Record<string, unknown>;
    const bucketsRaw = Array.isArray(raw.buckets) ? raw.buckets : [];
    const tablesRaw = Array.isArray(raw.tables) ? raw.tables : [];

    const buckets: StorageBucketUsage[] = bucketsRaw.map((b) => {
      const row = b as Record<string, unknown>;
      return {
        name: String(row.name ?? ""),
        objects: n(row.objects),
        bytes: n(row.bytes),
      };
    });
    const tables: TableUsage[] = tablesRaw.map((t) => {
      const row = t as Record<string, unknown>;
      return {
        name: String(row.name ?? ""),
        approx_rows: n(row.approx_rows),
        total_bytes: n(row.total_bytes),
      };
    });

    const dbBytes = n(raw.db_bytes);
    const storageBytes = n(raw.storage_bytes);
    const alerts: string[] = [];
    let status: "green" | "amber" | "red" = "green";

    if (storageBytes >= STORAGE_RED_BYTES) {
      status = "red";
      alerts.push(
        `File storage is ${formatBytes(storageBytes)} — approaching Pro included limit (100 GB).`,
      );
    } else if (storageBytes >= STORAGE_AMBER_BYTES) {
      status = "amber";
      alerts.push(
        `File storage is ${formatBytes(storageBytes)} — review attachments / feedback screenshots.`,
      );
    }

    if (dbBytes >= DB_RED_BYTES) {
      status = "red";
      alerts.push(`Database is ${formatBytes(dbBytes)} — approaching Pro included limit (8 GB).`);
    } else if (dbBytes >= DB_AMBER_BYTES) {
      if (status === "green") status = "amber";
      alerts.push(`Database is ${formatBytes(dbBytes)} — review large tables and retention.`);
    }

    const topBucket = buckets[0];
    if (topBucket && topBucket.bytes > 500 * 1024 * 1024) {
      alerts.push(
        `Largest bucket: ${topBucket.name} (${formatBytes(topBucket.bytes)}, ${topBucket.objects.toLocaleString()} objects).`,
      );
    }

    return {
      generatedAt:
        typeof raw.generated_at === "string" ? raw.generated_at : new Date().toISOString(),
      dbBytes,
      storageBytes,
      buckets,
      tables,
      alerts,
      status,
    };
  } catch (e) {
    console.error("[supabase-usage]", e);
    return null;
  }
}
