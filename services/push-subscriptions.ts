"use server";

import {
  listAllRecords,
  createRecord,
  updateRecord,
  deleteRecord,
  type AirtableRecord,
} from "@/lib/airtable-server";
import { isSupabaseBackend } from "@/lib/data-backend";
import type { PushSubscriptionRecord } from "@/types";
import { devLog } from "@/lib/dev-log";
import { sendWebPush } from "@/lib/web-push-server";

const TABLE = "push_subscriptions";
/** Try several endpoints so stale newest rows don't block still-valid older ones. */
const MAX_SUBSCRIPTIONS_PER_SEND = 5;

type Fields = {
  subscription_id?: string;
  user_id?: string;
  endpoint?: string;
  p256dh?: string;
  auth?: string;
  user_agent?: string;
  role?: string;
  active?: boolean;
  created_at?: string;
};

function mapRecord(rec: AirtableRecord<Fields>): PushSubscriptionRecord {
  const f = rec.fields;
  return {
    id: rec.id,
    subscription_id: f.subscription_id ?? "",
    user_id: f.user_id ?? "",
    endpoint: f.endpoint ?? "",
    p256dh: f.p256dh ?? "",
    auth: f.auth ?? "",
    user_agent: f.user_agent ?? "",
    role: (f.role as PushSubscriptionRecord["role"]) ?? undefined,
    active: f.active ?? true,
    created_at: f.created_at ?? "",
  };
}

const PUSH_DEBUG = "[push-debug]";

function subscriptionSortKey(rec: PushSubscriptionRecord): number {
  const t = Date.parse(rec.created_at);
  return Number.isFinite(t) ? t : 0;
}

/**
 * Get subscriptions for user (push sends are capped per Worker subrequest limit).
 * Returns at most the newest active subscriptions for this user.
 */
export async function getActiveSubscriptionsForUser(userId: string): Promise<PushSubscriptionRecord[]> {
  if (isSupabaseBackend()) return (await import("./push-subscriptions-supabase")).getActiveSubscriptionsForUser(userId);
  try {
    const filterFormula = `{user_id} = "${userId.replace(/"/g, '""')}"`;
    const records = await listAllRecords<Fields>(TABLE, {
      filterByFormula: filterFormula,
    });
    const mapped = records.map(mapRecord).filter((r) => r.active !== false);
    const sorted = [...mapped].sort((a, b) => {
      const diff = subscriptionSortKey(b) - subscriptionSortKey(a);
      if (diff !== 0) return diff;
      return (b.id ?? "").localeCompare(a.id ?? "");
    });
    const result = sorted.slice(0, MAX_SUBSCRIPTIONS_PER_SEND);
    devLog(
      PUSH_DEBUG,
      "subscriptions found count",
      JSON.stringify({
        recipient_user_id: userId,
        total_in_airtable: mapped.length,
        returned: result.length,
        capped_at: MAX_SUBSCRIPTIONS_PER_SEND,
        filter: "user_id equals recipient, newest first",
      })
    );
    return result;
  } catch (err) {
    console.error(PUSH_DEBUG, "getActiveSubscriptionsForUser failed", err instanceof Error ? err.message : String(err));
    devLog(PUSH_DEBUG, "push failure with exact error", JSON.stringify({ stage: "getActiveSubscriptionsForUser", recipient_user_id: userId, error: err instanceof Error ? err.message : String(err) }));
    return [];
  }
}

/** Find an existing subscription for this user and endpoint (for upsert). */
export async function findSubscriptionByUserAndEndpoint(
  userId: string,
  endpoint: string
): Promise<PushSubscriptionRecord | null> {
  if (isSupabaseBackend()) return (await import("./push-subscriptions-supabase")).findSubscriptionByUserAndEndpoint(userId, endpoint);
  const records = await listAllRecords<Fields>(TABLE, {
    filterByFormula: `{user_id} = "${userId.replace(/"/g, '""')}"`,
  });
  const match = records.find((r) => (r.fields.endpoint ?? "") === endpoint);
  return match ? mapRecord(match as AirtableRecord<Fields>) : null;
}

/** Minimal fields required for Airtable push_subscriptions. Omit user_agent so save does not fail if column is missing. */
type SafeCreateFields = Pick<Fields, "subscription_id" | "user_id" | "endpoint" | "p256dh" | "auth"> & {
  role?: string;
};

export async function createPushSubscription(fields: Partial<Fields>) {
  if (isSupabaseBackend()) return (await import("./push-subscriptions-supabase")).createPushSubscription(fields);
  const safe: Record<string, unknown> = {};
  if (fields.subscription_id != null) safe.subscription_id = fields.subscription_id;
  if (fields.user_id != null) safe.user_id = fields.user_id;
  if (fields.endpoint != null) safe.endpoint = fields.endpoint;
  if (fields.p256dh != null) safe.p256dh = fields.p256dh;
  if (fields.auth != null) safe.auth = fields.auth;
  if (fields.role != null) safe.role = fields.role;
  const rec = await createRecord(TABLE, safe as SafeCreateFields);
  return mapRecord(rec as AirtableRecord<Fields>);
}

/** Only pass writable fields that exist on the table. Omit user_agent to avoid INVALID_VALUE if column missing. */
export async function updatePushSubscription(
  recordId: string,
  fields: Partial<Pick<Fields, "p256dh" | "auth" | "role">>
) {
  if (isSupabaseBackend()) return (await import("./push-subscriptions-supabase")).updatePushSubscription(recordId, fields);
  const safe: Record<string, unknown> = {};
  if (fields.p256dh != null) safe.p256dh = fields.p256dh;
  if (fields.auth != null) safe.auth = fields.auth;
  if (fields.role != null) safe.role = fields.role;
  const rec = await updateRecord<Fields>(TABLE, recordId, safe);
  return mapRecord(rec as AirtableRecord<Fields>);
}

/** Deactivate subscription (Supabase) or delete (Airtable — no reliable active column). */
export async function deactivateSubscription(recordId: string) {
  if (isSupabaseBackend()) return (await import("./push-subscriptions-supabase")).deactivateSubscription(recordId);
  await deleteRecord(TABLE, recordId);
  return null;
}

/** Permanently remove a push subscription row (e.g. after push service 410 Gone). */
export async function deletePushSubscription(recordId: string): Promise<void> {
  if (isSupabaseBackend()) {
    await (await import("./push-subscriptions-supabase")).deletePushSubscription(recordId);
    return;
  }
  await deleteRecord(TABLE, recordId);
}

/** Send web push to a user's active subscriptions (newest first). Prunes stale endpoints. */
export async function sendPushToUser(
  userId: string,
  notification: { title: string; body: string; url?: string }
): Promise<void> {
  if (isSupabaseBackend()) return (await import("./push-subscriptions-supabase")).sendPushToUser(userId, notification);
  const subscriptions = await getActiveSubscriptionsForUser(userId);
  for (const sub of subscriptions) {
    try {
      const result = await sendWebPush(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        {
          title: notification.title,
          body: notification.body,
          url: notification.url ?? "/notifications",
          tag: "billing",
        }
      );
      if (result.stale && sub.id) {
        await deletePushSubscription(sub.id).catch((err) => {
          console.error(PUSH_DEBUG, "failed to prune stale subscription", sub.id, err);
        });
      }
    } catch (err) {
      console.error(
        PUSH_DEBUG,
        "push failure with exact error",
        JSON.stringify({
          stage: "sendPushToUser",
          recipient_user_id: userId,
          error: err instanceof Error ? err.message : String(err),
        })
      );
    }
  }
}
