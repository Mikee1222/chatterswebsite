/**
 * Supabase backend for services/push-subscriptions.ts
 */
import {
  publicId,
  sbInsert,
  sbSelectEq,
  sbUpdateByPublicId,
  sbDeleteByPublicId,
  type SbRow,
} from "@/lib/supabase-data";
import type { PushSubscriptionRecord } from "@/types";
import { devLog } from "@/lib/dev-log";
import { sendWebPush } from "@/lib/web-push-server";

const TABLE = "push_subscriptions";
const PUSH_DEBUG = "[push-debug]";
const MAX_SUBSCRIPTIONS_PER_SEND = 5;

type Row = SbRow & {
  subscription_id?: string | null;
  user_id?: string | null;
  endpoint?: string | null;
  p256dh?: string | null;
  auth?: string | null;
  user_agent?: string | null;
  role?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
};

function mapRow(row: Row): PushSubscriptionRecord {
  return {
    id: publicId(row),
    subscription_id: row.subscription_id ?? "",
    user_id: row.user_id ?? "",
    endpoint: row.endpoint ?? "",
    p256dh: row.p256dh ?? "",
    auth: row.auth ?? "",
    user_agent: row.user_agent ?? "",
    role: (row.role as PushSubscriptionRecord["role"]) ?? undefined,
    active: row.is_active ?? true,
    created_at: row.created_at ?? "",
  };
}

function subscriptionSortKey(rec: PushSubscriptionRecord): number {
  const t = Date.parse(rec.created_at);
  return Number.isFinite(t) ? t : 0;
}

export async function getActiveSubscriptionsForUser(userId: string): Promise<PushSubscriptionRecord[]> {
  try {
    const rows = await sbSelectEq<Row>(TABLE, "user_id", userId);
    const mapped = rows.map(mapRow).filter((r) => r.active !== false);
    const sorted = [...mapped].sort((a, b) => {
      const diff = subscriptionSortKey(b) - subscriptionSortKey(a);
      if (diff !== 0) return diff;
      return (b.id ?? "").localeCompare(a.id ?? "");
    });
    return sorted.slice(0, MAX_SUBSCRIPTIONS_PER_SEND);
  } catch (err) {
    console.error(PUSH_DEBUG, "getActiveSubscriptionsForUser failed", err instanceof Error ? err.message : String(err));
    devLog(PUSH_DEBUG, "push failure", JSON.stringify({ stage: "getActiveSubscriptionsForUser", err: String(err) }));
    return [];
  }
}

export async function findSubscriptionByUserAndEndpoint(
  userId: string,
  endpoint: string
): Promise<PushSubscriptionRecord | null> {
  const rows = await sbSelectEq<Row>(TABLE, "user_id", userId);
  const match = rows.find((r) => (r.endpoint ?? "") === endpoint);
  return match ? mapRow(match) : null;
}

export async function createPushSubscription(fields: Partial<Row>) {
  const safe: Record<string, unknown> = {};
  if (fields.subscription_id != null) safe.subscription_id = fields.subscription_id;
  if (fields.user_id != null) safe.user_id = fields.user_id;
  if (fields.endpoint != null) safe.endpoint = fields.endpoint;
  if (fields.p256dh != null) safe.p256dh = fields.p256dh;
  if (fields.auth != null) safe.auth = fields.auth;
  if (fields.role != null) safe.role = fields.role;
  safe.is_active = true;
  const row = await sbInsert<Row>(TABLE, safe);
  return mapRow(row);
}

export async function updatePushSubscription(
  recordId: string,
  fields: Partial<Pick<Row, "p256dh" | "auth" | "role">>
) {
  const safe: Record<string, unknown> = {};
  if (fields.p256dh != null) safe.p256dh = fields.p256dh;
  if (fields.auth != null) safe.auth = fields.auth;
  if (fields.role != null) safe.role = fields.role;
  safe.is_active = true;
  const row = await sbUpdateByPublicId<Row>(TABLE, recordId, safe);
  return mapRow(row);
}

export async function deactivateSubscription(recordId: string) {
  const row = await sbUpdateByPublicId<Row>(TABLE, recordId, { is_active: false });
  return mapRow(row);
}

export async function deletePushSubscription(recordId: string): Promise<void> {
  await sbDeleteByPublicId(TABLE, recordId);
}

export async function sendPushToUser(
  userId: string,
  notification: { title: string; body: string; url?: string }
): Promise<void> {
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
      console.error(PUSH_DEBUG, "push failure", JSON.stringify({ stage: "sendPushToUser", err: String(err) }));
      devLog(PUSH_DEBUG, "push failure", JSON.stringify({ stage: "sendPushToUser", err: String(err) }));
    }
  }
}
