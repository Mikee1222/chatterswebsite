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

export async function createPushSubscription(fields: Partial<Fields>) {
  const rec = await createRecord(TABLE, fields);
  return mapRecord(rec as AirtableRecord<Fields>);
}

export async function updatePushSubscription(
  recordId: string,
  fields: Partial<Pick<Fields, "p256dh" | "auth" | "user_agent" | "role">>
) {
  const rec = await updateRecord<Fields>(TABLE, recordId, fields);
  return mapRecord(rec as AirtableRecord<Fields>);
}

/** Deactivate subscription. Table has no "active" field – we only update keys/role; consider deleting record in Airtable if needed. */
export async function deactivateSubscription(recordId: string) {
  const rec = await updateRecord<Fields>(TABLE, recordId, {});
  return mapRecord(rec);
}
