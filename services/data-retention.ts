/**
 * Retention / cleanup for unbounded-growth tables.
 * Safe deletes only — never touches storage attachments or business records.
 */

import { getSupabaseServiceClient } from "@/lib/supabase-server";

/** Visitor events: documented 90-day cache (also pruned in getmysocial-sync). */
export const VISITOR_EVENTS_RETENTION_DAYS = 90;
/** Credential reveal audit trail. */
export const CREDENTIAL_ACCESS_LOG_RETENTION_DAYS = 90;
/** Gunzo Agent proposed/executed action audit. */
export const AGENT_ACTION_LOG_RETENTION_DAYS = 90;
/** Read notifications older than this are purged. */
export const READ_NOTIFICATIONS_RETENTION_DAYS = 90;
/** Unread notifications hard-cap (prevents silent inbox growth forever). */
export const ALL_NOTIFICATIONS_RETENTION_DAYS = 180;

const DELETE_BATCH = 500;

export type RetentionCleanupResult = {
  visitorsPruned: number;
  credentialAccessLogPruned: number;
  agentActionLogPruned: number;
  readNotificationsPruned: number;
  staleNotificationsPruned: number;
  errors: string[];
};

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

/**
 * Select matching ids then delete by id (PostgREST delete+limit is unreliable).
 */
async function deleteBatched(
  table: string,
  column: string,
  cutoffIso: string,
  extraFilter?: { column: string; equals: boolean | string },
): Promise<number> {
  const sb = getSupabaseServiceClient();
  let total = 0;
  for (let i = 0; i < 40; i++) {
    let selectQ = sb.from(table).select("id").lt(column, cutoffIso).limit(DELETE_BATCH);
    if (extraFilter) {
      selectQ = selectQ.eq(extraFilter.column, extraFilter.equals);
    }
    const { data: rows, error: selectError } = await selectQ;
    if (selectError) throw new Error(`${table} select: ${selectError.message}`);
    const ids = (rows ?? []).map((r) => String((r as { id: string }).id)).filter(Boolean);
    if (!ids.length) break;

    const { error: deleteError } = await sb.from(table).delete().in("id", ids);
    if (deleteError) throw new Error(`${table} delete: ${deleteError.message}`);
    total += ids.length;
    if (ids.length < DELETE_BATCH) break;
  }
  return total;
}

/**
 * Prune unbounded log / cache tables. Idempotent; safe to run daily.
 * Does NOT delete Storage objects (attachments / feedback screenshots).
 */
export async function runDataRetentionCleanup(): Promise<RetentionCleanupResult> {
  const errors: string[] = [];
  let visitorsPruned = 0;
  let credentialAccessLogPruned = 0;
  let agentActionLogPruned = 0;
  let readNotificationsPruned = 0;
  let staleNotificationsPruned = 0;

  try {
    visitorsPruned = await deleteBatched(
      "getmysocial_visitor_events",
      "event_timestamp",
      daysAgoIso(VISITOR_EVENTS_RETENTION_DAYS),
    );
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  try {
    credentialAccessLogPruned = await deleteBatched(
      "credential_access_log",
      "timestamp",
      daysAgoIso(CREDENTIAL_ACCESS_LOG_RETENTION_DAYS),
    );
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  try {
    agentActionLogPruned = await deleteBatched(
      "agent_action_log",
      "proposed_at",
      daysAgoIso(AGENT_ACTION_LOG_RETENTION_DAYS),
    );
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  try {
    readNotificationsPruned = await deleteBatched(
      "notifications",
      "created_at",
      daysAgoIso(READ_NOTIFICATIONS_RETENTION_DAYS),
      { column: "is_read", equals: true },
    );
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  try {
    staleNotificationsPruned = await deleteBatched(
      "notifications",
      "created_at",
      daysAgoIso(ALL_NOTIFICATIONS_RETENTION_DAYS),
    );
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  return {
    visitorsPruned,
    credentialAccessLogPruned,
    agentActionLogPruned,
    readNotificationsPruned,
    staleNotificationsPruned,
    errors,
  };
}
