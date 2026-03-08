"use server";

import {
  listAllRecords,
  createRecord,
  updateRecord,
  type AirtableRecord,
} from "@/lib/airtable-server";
import type { PushSubscriptionRecord } from "@/types";

const TABLE = "push_subscriptions";

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

/** Get subscriptions for user. push_subscriptions table has no "active" field – filter by user_id only. */
export async function getActiveSubscriptionsForUser(userId: string): Promise<PushSubscriptionRecord[]> {
  try {
    const records = await listAllRecords<Fields>(TABLE, {
      filterByFormula: `{user_id} = "${userId.replace(/"/g, '""')}"`,
    });
    return records.map(mapRecord);
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[push-subscriptions] getActiveSubscriptionsForUser failed", err);
    }
    return [];
  }
}

/** Find an existing subscription for this user and endpoint (for upsert). */
export async function findSubscriptionByUserAndEndpoint(
  userId: string,
  endpoint: string
): Promise<PushSubscriptionRecord | null> {
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
  const safe: Record<string, unknown> = {};
  if (fields.p256dh != null) safe.p256dh = fields.p256dh;
  if (fields.auth != null) safe.auth = fields.auth;
  if (fields.role != null) safe.role = fields.role;
  const rec = await updateRecord<Fields>(TABLE, recordId, safe);
  return mapRecord(rec as AirtableRecord<Fields>);
}

/** Deactivate subscription. Table has no "active" field – we only update keys/role; consider deleting record in Airtable if needed. */
export async function deactivateSubscription(recordId: string) {
  const rec = await updateRecord<Fields>(TABLE, recordId, {});
  return mapRecord(rec);
}
