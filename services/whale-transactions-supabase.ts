/**
 * Supabase backend for services/whale-transactions.ts (DATA_BACKEND=supabase).
 */

import { getSupabaseServiceClient } from "@/lib/supabase-server";
import {
  firstMappedLinkedId,
  publicId,
  sbDeleteByPublicId,
  sbInsert,
  sbResolveUuidToAirtableMap,
  sbSelectAll,
  sbSelectByPublicId,
  sbSelectWhere,
  sbUpdateByPublicId,
  sbUuidsForAirtableIds,
  requireSbUuids,
  type SbRow,
} from "@/lib/supabase-data";
import { TRANSACTION_TYPES } from "@/lib/airtable-options";
import type {
  WhaleTransaction,
  TransactionCurrency,
  TransactionType,
} from "@/types";
import { notifyByRoleConfig } from "@/services/notification-service";
import { NOTIFICATION_ENTITY } from "@/lib/notification-types";
import { whaleSessionSubmittedSelf } from "@/lib/notification-copy";
import { devLog } from "@/lib/dev-log";
import type {
  CreateWhaleTransactionFields,
  UpdateWhaleTransactionFields,
} from "./whale-transactions";

const TABLE = "whale_transactions";

type Row = SbRow & {
  transaction_id?: string | null;
  whale?: string[] | null;
  whale_username?: string | null;
  chatter?: string[] | null;
  chatter_name?: string | null;
  model?: string[] | null;
  model_name?: string | null;
  date?: string | null;
  time?: string | null;
  session_length_minutes?: number | null;
  amount?: number | null;
  currency?: string | null;
  type?: string | null;
  note?: string | null;
  created_at?: string | null;
};

function mapRowSync(
  row: Row,
  whaleAt: Map<string, string>,
  userAt: Map<string, string>,
  modelAt: Map<string, string>
): WhaleTransaction {
  const typeRaw = row.type ?? "";
  return {
    id: publicId(row),
    transaction_id: row.transaction_id ?? "",
    whale_id: firstMappedLinkedId(row.whale, whaleAt),
    whale_username: row.whale_username ?? "",
    chatter_id: firstMappedLinkedId(row.chatter, userAt),
    chatter_name: row.chatter_name ?? "",
    model_id: firstMappedLinkedId(row.model, modelAt),
    model_name: row.model_name ?? "",
    date: row.date ? String(row.date).slice(0, 10) : "",
    time: row.time ?? "",
    session_length_minutes:
      row.session_length_minutes != null ? Number(row.session_length_minutes) : null,
    amount: Number(row.amount ?? 0),
    currency: (row.currency as TransactionCurrency) ?? "usd",
    type: ((TRANSACTION_TYPES as readonly string[]).includes(typeRaw)
      ? typeRaw
      : "other") as TransactionType,
    note: row.note ?? "",
    created_at: row.created_at ?? "",
  };
}

async function mapRows(rows: Row[]): Promise<WhaleTransaction[]> {
  if (!rows.length) return [];
  const [whaleAt, userAt, modelAt] = await Promise.all([
    sbResolveUuidToAirtableMap("whales", rows.map((r) => r.whale)),
    sbResolveUuidToAirtableMap("users", rows.map((r) => r.chatter)),
    sbResolveUuidToAirtableMap("modelss", rows.map((r) => r.model)),
  ]);
  return rows.map((r) => mapRowSync(r, whaleAt, userAt, modelAt));
}

async function mapRow(row: Row): Promise<WhaleTransaction> {
  const [mapped] = await mapRows([row]);
  return mapped!;
}

export async function listWhaleTransactions(_params: { pageSize?: number } = {}) {
  const transactions = await listAllWhaleTransactions();
  return { transactions, offset: undefined as string | undefined };
}

export async function listAllWhaleTransactions(): Promise<WhaleTransaction[]> {
  const rows = await sbSelectAll<Row>(TABLE);
  const mapped = await mapRows(rows);
  mapped.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return mapped;
}

export async function listTransactionsByChatter(chatterRecordId: string, limit = 50) {
  const uuids = await sbUuidsForAirtableIds("users", [chatterRecordId]);
  if (!uuids[0]) return [];
  const rows = await sbSelectWhere<Row>(TABLE, (q) =>
    q.contains("chatter", [uuids[0]!]).order("created_at", { ascending: false })
  );
  const limited = (await mapRows(rows)).slice(0, limit);
  if (process.env.NODE_ENV !== "production") {
    devLog("[listTransactionsByChatter:sb]", {
      chatterRecordId,
      totalFetched: limited.length,
      matchedCount: limited.length,
      returnedCount: limited.length,
    });
  }
  return limited;
}

export async function createWhaleTransaction(fields: CreateWhaleTransactionFields) {
  const mins = fields.session_length_minutes;
  if (mins == null || typeof mins !== "number" || !Number.isInteger(mins) || mins < 0) {
    throw new Error("session_length_minutes is required and must be a non-negative integer");
  }
  const transactionId = `txn_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const [whale, chatter] = await Promise.all([
    requireSbUuids("whales", [fields.whale_record_id], "whale"),
    requireSbUuids("users", [fields.chatter_record_id], "chatter"),
  ]);
  const model = fields.model_record_id
    ? await sbUuidsForAirtableIds("modelss", [fields.model_record_id])
    : [];
  const payload: Record<string, unknown> = {
    transaction_id: transactionId,
    whale,
    whale_username: fields.whale_username,
    chatter,
    chatter_name: fields.chatter_name,
    model_name: fields.model_name,
    date: fields.date,
    time: fields.time,
    session_length_minutes: mins,
    amount: fields.amount,
    currency: fields.currency ?? "usd",
    type: fields.type,
    note: fields.note ?? "",
    created_at: new Date().toISOString(),
  };
  if (model.length) payload.model = model;
  const inserted = await sbInsert<Row>(TABLE, payload);
  const transaction = await mapRow(inserted);

  const currency = (fields.currency ?? "usd").toLowerCase();
  const selfCopy = whaleSessionSubmittedSelf(
    fields.whale_username,
    fields.amount,
    currency,
    fields.model_name
  );
  await notifyByRoleConfig("whale_session_submitted", {
    priority: "normal",
    title: selfCopy.title,
    body: selfCopy.body,
    entity_type: NOTIFICATION_ENTITY.WHALE,
    entity_id: transaction.id,
    actor_user_id: fields.chatter_record_id,
    actor_name: fields.chatter_name,
    personal_user_id: fields.chatter_record_id,
    context: {
      whaleUsername: fields.whale_username,
      amount: fields.amount,
      currency,
      modelName: fields.model_name,
      chatterName: fields.chatter_name,
    },
  }).catch(() => {});

  try {
    const { updateChallengeProgress } = await import("@/services/challenges");
    await updateChallengeProgress(fields.chatter_record_id, "transactions", 1);
  } catch (e) {
    console.error("[challenges] updateChallengeProgress transactions failed", e);
  }

  return transaction;
}

async function assertOwned(
  recordId: string,
  chatterRecordId: string
): Promise<WhaleTransaction> {
  const row = await sbSelectByPublicId<Row>(TABLE, recordId);
  if (!row) throw new Error("You can only change your own session records.");
  const txn = await mapRow(row);
  if (txn.chatter_id !== chatterRecordId) {
    throw new Error("You can only change your own session records.");
  }
  return txn;
}

export async function peekWhaleTransactionForChatter(
  recordId: string,
  chatterRecordId: string
): Promise<WhaleTransaction | null> {
  try {
    return await assertOwned(recordId, chatterRecordId);
  } catch {
    return null;
  }
}

export async function updateWhaleTransactionForChatter(
  recordId: string,
  chatterRecordId: string,
  fields: UpdateWhaleTransactionFields
) {
  await assertOwned(recordId, chatterRecordId);
  if (fields.session_length_minutes != null) {
    const m = fields.session_length_minutes;
    if (typeof m !== "number" || !Number.isInteger(m) || m < 0) {
      throw new Error("Session length must be a whole number (0 or more).");
    }
  }
  const payload: Record<string, unknown> = {};
  if (fields.model_name !== undefined) payload.model_name = fields.model_name;
  if (fields.date !== undefined) payload.date = fields.date;
  if (fields.time !== undefined) payload.time = fields.time;
  if (fields.session_length_minutes !== undefined) {
    payload.session_length_minutes = fields.session_length_minutes;
  }
  if (fields.amount !== undefined) payload.amount = fields.amount;
  if (fields.currency !== undefined) payload.currency = fields.currency;
  if (fields.type !== undefined) payload.type = fields.type;
  if (fields.note !== undefined) payload.note = fields.note;
  if (Object.keys(payload).length === 0) {
    return assertOwned(recordId, chatterRecordId);
  }
  payload.updated_at = new Date().toISOString();
  const updated = await sbUpdateByPublicId<Row>(TABLE, recordId, payload);
  return mapRow(updated);
}

export async function deleteWhaleTransactionForChatter(
  recordId: string,
  chatterRecordId: string
) {
  await assertOwned(recordId, chatterRecordId);
  await sbDeleteByPublicId(TABLE, recordId);
}

/** Delete all transactions linked to a whale (before deleting the whale). */
export async function deleteWhaleTransactionsForWhale(whaleRecordId: string): Promise<void> {
  const id = whaleRecordId.trim();
  if (!id) return;
  const whaleUuids = await sbUuidsForAirtableIds("whales", [id]);
  // Native supabase rows may already use uuid as public id
  const uuid =
    whaleUuids[0] ??
    (await sbSelectByPublicId<{ id: string }>("whales", id))?.id ??
    (id.includes("-") ? id : null);
  if (!uuid) return;

  const { getSupabaseServiceClient } = await import("@/lib/supabase-server");
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from(TABLE)
    .select("id, airtable_id")
    .contains("whale", [uuid]);
  if (error) throw new Error(`deleteWhaleTransactionsForWhale: ${error.message}`);
  for (const row of data ?? []) {
    await sbDeleteByPublicId(TABLE, publicId(row as { id: string; airtable_id?: string | null }));
  }
}
