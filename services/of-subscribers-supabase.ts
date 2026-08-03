/**
 * Supabase store for of_subscribers (API + webhook).
 */
import { getSupabaseServiceClient } from "@/lib/supabase-server";
import { publicId, sbInsert, sbUpdateByPublicId, type SbRow } from "@/lib/supabase-data";
import {
  categorizeSubscriber,
  parseSubscriber,
  type OFSubscriber,
  type OFSubscriberCategory,
} from "./of-subscribers";

const TABLE = "of_subscribers";

export type OfSubscriberRow = {
  id: string;
  of_user_id: number;
  of_account_id: string;
  model_name: string;
  display_name: string;
  username: string;
  subscribed_at: string;
  expires_at: string;
  total_spent: number;
  category: string;
  last_synced_at: string;
};

type Row = SbRow & {
  of_user_id?: number | string | null;
  of_account_id?: string | null;
  model_name?: string | null;
  display_name?: string | null;
  username?: string | null;
  subscribed_at?: string | null;
  expires_at?: string | null;
  total_spent?: number | string | null;
  category?: string | null;
  last_synced_at?: string | null;
};

function mapRow(row: Row): OfSubscriberRow {
  const ofUserId = Number(row.of_user_id ?? 0);
  const totalSpent = Number(row.total_spent ?? 0);
  return {
    id: publicId(row),
    of_user_id: Number.isFinite(ofUserId) ? ofUserId : 0,
    of_account_id: String(row.of_account_id ?? ""),
    model_name: String(row.model_name ?? ""),
    display_name: String(row.display_name ?? ""),
    username: String(row.username ?? ""),
    subscribed_at: String(row.subscribed_at ?? ""),
    expires_at: String(row.expires_at ?? ""),
    total_spent: Number.isFinite(totalSpent) ? totalSpent : 0,
    category: String(row.category ?? ""),
    last_synced_at: String(row.last_synced_at ?? ""),
  };
}

export async function listSubscribersByAccount(ofAccountId: string): Promise<OfSubscriberRow[]> {
  const account = ofAccountId.trim();
  if (!account) return [];
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from(TABLE)
    .select("*")
    .eq("of_account_id", account)
    .order("total_spent", { ascending: false });
  if (error) throw new Error(`listSubscribersByAccount: ${error.message}`);
  return ((data ?? []) as unknown as Row[]).map(mapRow);
}

export async function findSubscriberByAccountAndFan(
  ofAccountId: string,
  fanUserId: number
): Promise<OfSubscriberRow | null> {
  const account = ofAccountId.trim();
  if (!account || !Number.isFinite(fanUserId)) return null;
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from(TABLE)
    .select("*")
    .eq("of_account_id", account)
    .eq("of_user_id", fanUserId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`findSubscriberByAccountAndFan: ${error.message}`);
  return data ? mapRow(data as unknown as Row) : null;
}

export async function updateSubscriberFields(
  id: string,
  fields: Partial<{
    total_spent: number;
    category: string;
    last_synced_at: string;
    expires_at: string;
    display_name: string;
    username: string;
  }>
): Promise<OfSubscriberRow> {
  const row = await sbUpdateByPublicId<Row>(TABLE, id, fields);
  return mapRow(row);
}

export async function createSubscriber(fields: {
  of_user_id: number;
  of_account_id: string;
  model_name: string;
  display_name: string;
  username: string;
  subscribed_at: string;
  expires_at?: string;
  last_synced_at: string;
  total_spent: number;
  category: string;
}): Promise<OfSubscriberRow> {
  const row = await sbInsert<Row>(TABLE, {
    of_user_id: fields.of_user_id,
    of_account_id: fields.of_account_id,
    model_name: fields.model_name,
    display_name: fields.display_name,
    username: fields.username,
    subscribed_at: fields.subscribed_at || null,
    expires_at: fields.expires_at || null,
    last_synced_at: fields.last_synced_at || null,
    total_spent: fields.total_spent,
    category: fields.category,
  });
  return mapRow(row);
}

export function toApiSubscriber(row: OfSubscriberRow) {
  const sub = parseSubscriber({
    of_user_id: row.of_user_id,
    username: row.username,
    display_name: row.display_name,
    subscribed_at: row.subscribed_at,
    expires_at: row.expires_at,
    total_spent: row.total_spent,
  });
  const cat =
    (row.category as OFSubscriberCategory | undefined) || categorizeSubscriber(sub);
  return { ...sub, category: cat };
}

export type { OFSubscriber };
