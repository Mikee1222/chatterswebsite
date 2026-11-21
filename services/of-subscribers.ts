import { isSupabaseBackend } from "@/lib/data-backend";
import {
  createRecord,
  listAllRecords,
  listRecords,
  updateRecord,
  type AirtableRecord,
} from "@/lib/airtable-server";
import { OF_SUBSCRIBERS_TABLE } from "@/lib/airtable-schema";

export type OFSubscriber = {
  of_user_id: number;
  username: string;
  display_name: string;
  subscribed_at: string;
  expires_at: string;
  total_spent: number;
};

export type OFSubscriberCategory =
  | "whale" // total_spent >= 1000
  | "vip" // total_spent >= 200
  | "high_spender" // total_spent >= 100
  | "medium" // total_spent >= 30
  | "freeloader" // total_spent < 30
  | "new"; // subscribed less than 7 days ago

export type OfSubscriberStoreRow = {
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

type SubscriberFields = {
  of_user_id?: number;
  of_account_id?: string;
  model_name?: string;
  display_name?: string;
  username?: string;
  subscribed_at?: string;
  expires_at?: string;
  total_spent?: number;
  category?: string;
  last_synced_at?: string;
};

function escapeFormulaString(s: string): string {
  return s.replace(/"/g, '""');
}

function mapAirtableRow(rec: AirtableRecord<SubscriberFields>): OfSubscriberStoreRow {
  const f = rec.fields;
  return {
    id: rec.id,
    of_user_id: Number(f.of_user_id ?? 0),
    of_account_id: String(f.of_account_id ?? ""),
    model_name: String(f.model_name ?? ""),
    display_name: String(f.display_name ?? ""),
    username: String(f.username ?? ""),
    subscribed_at: String(f.subscribed_at ?? ""),
    expires_at: String(f.expires_at ?? ""),
    total_spent: Number(f.total_spent ?? 0),
    category: String(f.category ?? ""),
    last_synced_at: String(f.last_synced_at ?? ""),
  };
}

export function categorizeSubscriber(sub: OFSubscriber): OFSubscriberCategory {
  const daysSinceSubscribed = (Date.now() - new Date(sub.subscribed_at).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceSubscribed < 7) return "new";
  if (sub.total_spent >= 1000) return "whale";
  if (sub.total_spent >= 200) return "vip";
  if (sub.total_spent >= 100) return "high_spender";
  if (sub.total_spent >= 30) return "medium";
  return "freeloader";
}

export function parseSubscriber(raw: Record<string, unknown>): OFSubscriber {
  const spent = Number(raw.total_spent);
  return {
    of_user_id: typeof raw.of_user_id === "number" ? raw.of_user_id : Number(raw.of_user_id),
    username: String(raw.username ?? ""),
    display_name: String(raw.display_name ?? ""),
    subscribed_at: String(raw.subscribed_at ?? ""),
    expires_at: String(raw.expires_at ?? ""),
    total_spent: Number.isFinite(spent) ? spent : 0,
  };
}

export function toApiSubscriber(row: OfSubscriberStoreRow) {
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

/** Cached store list for a model OF account id (Airtable or Supabase). */
export async function listStoredSubscribersByAccount(
  ofAccountId: string
): Promise<OfSubscriberStoreRow[]> {
  if (isSupabaseBackend()) {
    return (await import("./of-subscribers-supabase")).listSubscribersByAccount(ofAccountId);
  }
  const esc = escapeFormulaString(ofAccountId.trim());
  const records = await listAllRecords<SubscriberFields>(OF_SUBSCRIBERS_TABLE, {
    filterByFormula: `{of_account_id} = "${esc}"`,
    sort: [{ field: "total_spent", direction: "desc" }],
    _caller: "of-subscribers-list",
  });
  return records.map(mapAirtableRow);
}

export async function findStoredSubscriber(
  ofAccountId: string,
  fanUserId: number
): Promise<OfSubscriberStoreRow | null> {
  if (isSupabaseBackend()) {
    return (await import("./of-subscribers-supabase")).findSubscriberByAccountAndFan(
      ofAccountId,
      fanUserId
    );
  }
  const esc = escapeFormulaString(ofAccountId.trim());
  const { records } = await listRecords<SubscriberFields>(OF_SUBSCRIBERS_TABLE, {
    filterByFormula: `AND({of_account_id}="${esc}", {of_user_id}=${fanUserId})`,
    pageSize: 1,
    _caller: "of-subscribers-find",
  });
  return records[0] ? mapAirtableRow(records[0]) : null;
}

export async function updateStoredSubscriber(
  id: string,
  fields: Partial<{
    total_spent: number;
    category: string;
    last_synced_at: string;
    expires_at: string;
    display_name: string;
    username: string;
  }>
): Promise<OfSubscriberStoreRow> {
  if (isSupabaseBackend()) {
    return (await import("./of-subscribers-supabase")).updateSubscriberFields(id, fields);
  }
  const rec = await updateRecord<SubscriberFields>(OF_SUBSCRIBERS_TABLE, id, fields);
  return mapAirtableRow(rec);
}

export async function createStoredSubscriber(fields: {
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
}): Promise<OfSubscriberStoreRow> {
  if (isSupabaseBackend()) {
    return (await import("./of-subscribers-supabase")).createSubscriber(fields);
  }
  const rec = await createRecord<SubscriberFields>(OF_SUBSCRIBERS_TABLE, {
    of_user_id: fields.of_user_id,
    of_account_id: fields.of_account_id,
    model_name: fields.model_name,
    display_name: fields.display_name,
    username: fields.username,
    subscribed_at: fields.subscribed_at,
    expires_at: fields.expires_at || undefined,
    last_synced_at: fields.last_synced_at,
    total_spent: fields.total_spent,
    category: fields.category,
  });
  return mapAirtableRow(rec);
}
