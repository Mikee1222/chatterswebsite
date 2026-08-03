"use server";

import {
  listRecords,
  listAllRecords,
  createRecord,
  deleteRecord,
  getRecord,
  updateRecord,
  type AirtableRecord,
  type ListParams,
} from "@/lib/airtable-server";
import { firstLinkedId, snapshotText } from "@/lib/airtable-linked";
import { isSupabaseBackend } from "@/lib/data-backend";
import { TRANSACTION_TYPES } from "@/lib/airtable-options";
import type {
  WhaleTransaction,
  TransactionCurrency,
  TransactionType,
} from "@/types";
import { devLog } from "@/lib/dev-log";
import { notifyByRoleConfig } from "@/services/notification-service";
import { NOTIFICATION_ENTITY } from "@/lib/notification-types";
import { whaleSessionSubmittedSelf } from "@/lib/notification-copy";

const TABLE = "whale_transactions";

type Fields = {
  transaction_id?: string;
  whale?: string | string[];
  whale_username?: string;
  chatter?: string | string[];
  chatter_name?: string;
  model?: string | string[];
  model_name?: string;
  date?: string;
  time?: string;
  session_length_minutes?: number;
  amount?: number;
  currency?: string;
  type?: string;
  note?: string;
  created_at?: string;
};

function mapRecord(rec: AirtableRecord<Fields>): WhaleTransaction {
  const f = rec.fields;
  return {
    id: rec.id,
    transaction_id: f.transaction_id ?? "",
    whale_id: firstLinkedId(f.whale) ?? "",
    whale_username: snapshotText(f.whale_username),
    chatter_id: firstLinkedId(f.chatter) ?? "",
    chatter_name: snapshotText(f.chatter_name),
    model_id: firstLinkedId(f.model) ?? "",
    model_name: snapshotText(f.model_name),
    date: f.date ?? "",
    time: f.time ?? "",
    session_length_minutes: f.session_length_minutes ?? null,
    amount: f.amount ?? 0,
    currency: (f.currency as TransactionCurrency) ?? "usd",
    type: ((TRANSACTION_TYPES as readonly string[]).includes(f.type ?? "") ? f.type : "other") as TransactionType,
    note: f.note ?? "",
    created_at: f.created_at ?? "",
  };
}

export async function listWhaleTransactions(params: ListParams & { filterByFormula?: string } = {}) {
  if (isSupabaseBackend()) return (await import("./whale-transactions-supabase")).listWhaleTransactions(params);
  const { records, offset } = await listRecords<Fields>(TABLE, params);
  return { transactions: records.map(mapRecord), offset };
}

/** List all transactions (for admin). Filter by yearMonth "YYYY-MM" in app using date field (YYYY-MM-DD). */
export async function listAllWhaleTransactions(): Promise<WhaleTransaction[]> {
  if (isSupabaseBackend()) {
    return (await import("./whale-transactions-supabase")).listAllWhaleTransactions();
  }
  const records = await listAllRecords<Fields>(TABLE, {
    sort: [{ field: "date", direction: "desc" }],
  });
  return records.map((r) => mapRecord(r as AirtableRecord<Fields>));
}

/**
 * List transactions for the given chatter (current user). Newest first.
 * Uses app-side filtering: Airtable filterByFormula on linked fields uses display values, not record IDs,
 * so we fetch records and filter by chatter linked record id in code.
 */
export async function listTransactionsByChatter(chatterRecordId: string, limit = 50) {
  if (isSupabaseBackend()) {
    return (await import("./whale-transactions-supabase")).listTransactionsByChatter(
      chatterRecordId,
      limit
    );
  }
  const allRecords = await listAllRecords<Fields>(TABLE, {
    sort: [{ field: "created_at", direction: "desc" }],
  });
  const matched = allRecords.filter(
    (rec) => firstLinkedId(rec.fields.chatter) === chatterRecordId
  );
  const limited = matched.slice(0, limit);
  if (process.env.NODE_ENV !== "production") {
    const sample = allRecords[0];
    devLog("[listTransactionsByChatter]", {
      chatterRecordId,
      totalFetched: allRecords.length,
      matchedCount: matched.length,
      returnedCount: limited.length,
      sampleChatter: sample ? firstLinkedId(sample.fields.chatter) : null,
      sampleChatterName: sample ? snapshotText(sample.fields.chatter_name) : null,
      rawChatterField: sample?.fields?.chatter ?? null,
    });
  }
  return limited.map((rec) => mapRecord(rec as AirtableRecord<Fields>));
}

export type CreateWhaleTransactionFields = {
  whale_record_id: string;
  whale_username: string;
  chatter_record_id: string;
  chatter_name: string;
  model_record_id?: string | null;
  model_name: string;
  date: string;
  time: string;
  /** Required. Session length in minutes (0 or positive integer). */
  session_length_minutes: number;
  amount: number;
  currency?: TransactionCurrency;
  type: TransactionType;
  note?: string;
};

export async function createWhaleTransaction(fields: CreateWhaleTransactionFields) {
  if (isSupabaseBackend()) {
    return (await import("./whale-transactions-supabase")).createWhaleTransaction(fields);
  }
  const mins = fields.session_length_minutes;
  if (mins == null || typeof mins !== "number" || !Number.isInteger(mins) || mins < 0) {
    throw new Error("session_length_minutes is required and must be a non-negative integer");
  }
  const transactionId = `txn_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const payload: Record<string, unknown> = {
    transaction_id: transactionId,
    whale: [fields.whale_record_id],
    whale_username: fields.whale_username,
    chatter: [fields.chatter_record_id], // linked to users (current chatter Airtable record id)
    chatter_name: fields.chatter_name, // snapshot of current chatter name
    model_name: fields.model_name,
    date: fields.date,
    time: fields.time,
    session_length_minutes: mins,
    amount: fields.amount,
    currency: fields.currency ?? "usd",
    type: fields.type,
    note: fields.note ?? "",
  };
  if (fields.model_record_id) payload.model = [fields.model_record_id];
  const rec = await createRecord<Fields>(TABLE, payload as Fields);
  const transaction = mapRecord(rec as AirtableRecord<Fields>);

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

async function assertWhaleTransactionOwnedByChatter(
  recordId: string,
  chatterRecordId: string
): Promise<WhaleTransaction> {
  const rec = await getRecord<Fields>(TABLE, recordId);
  const owner = firstLinkedId(rec.fields.chatter);
  if (owner !== chatterRecordId) {
    throw new Error("You can only change your own session records.");
  }
  return mapRecord(rec as AirtableRecord<Fields>);
}

/** Snapshot for chatter-owned row; null when missing or not owned. */
export async function peekWhaleTransactionForChatter(
  recordId: string,
  chatterRecordId: string,
): Promise<WhaleTransaction | null> {
  if (isSupabaseBackend()) {
    return (await import("./whale-transactions-supabase")).peekWhaleTransactionForChatter(
      recordId,
      chatterRecordId
    );
  }
  try {
    return await assertWhaleTransactionOwnedByChatter(recordId, chatterRecordId);
  } catch {
    return null;
  }
}

export type UpdateWhaleTransactionFields = {
  model_name?: string;
  date?: string;
  time?: string;
  session_length_minutes?: number;
  amount?: number;
  currency?: TransactionCurrency;
  type?: TransactionType;
  note?: string;
};

/**
 * Partial update; caller must be the linked chatter. Does not change whale or chatter links.
 */
export async function updateWhaleTransactionForChatter(
  recordId: string,
  chatterRecordId: string,
  fields: UpdateWhaleTransactionFields
) {
  if (isSupabaseBackend()) {
    return (await import("./whale-transactions-supabase")).updateWhaleTransactionForChatter(
      recordId,
      chatterRecordId,
      fields
    );
  }
  await assertWhaleTransactionOwnedByChatter(recordId, chatterRecordId);
  if (fields.session_length_minutes != null) {
    const m = fields.session_length_minutes;
    if (typeof m !== "number" || !Number.isInteger(m) || m < 0) {
      throw new Error("Session length must be a whole number (0 or more).");
    }
  }
  const payload: Partial<Fields> = {};
  if (fields.model_name !== undefined) payload.model_name = fields.model_name;
  if (fields.date !== undefined) payload.date = fields.date;
  if (fields.time !== undefined) payload.time = fields.time;
  if (fields.session_length_minutes !== undefined) payload.session_length_minutes = fields.session_length_minutes;
  if (fields.amount !== undefined) payload.amount = fields.amount;
  if (fields.currency !== undefined) payload.currency = fields.currency;
  if (fields.type !== undefined) payload.type = fields.type;
  if (fields.note !== undefined) payload.note = fields.note;
  if (Object.keys(payload).length === 0) {
    return assertWhaleTransactionOwnedByChatter(recordId, chatterRecordId);
  }
  const updated = await updateRecord<Fields>(TABLE, recordId, payload);
  return mapRecord(updated as AirtableRecord<Fields>);
}

export async function deleteWhaleTransactionForChatter(recordId: string, chatterRecordId: string) {
  if (isSupabaseBackend()) {
    return (await import("./whale-transactions-supabase")).deleteWhaleTransactionForChatter(
      recordId,
      chatterRecordId
    );
  }
  await assertWhaleTransactionOwnedByChatter(recordId, chatterRecordId);
  await deleteRecord(TABLE, recordId);
}

/** Delete all transactions linked to a whale (before deleting the whale). */
export async function deleteWhaleTransactionsForWhale(whaleRecordId: string): Promise<void> {
  if (isSupabaseBackend()) {
    return (await import("./whale-transactions-supabase")).deleteWhaleTransactionsForWhale(
      whaleRecordId
    );
  }
  const txns = await listAllRecords<Fields>(TABLE, {
    fields: ["whale"],
    pageSize: 100,
    _caller: "whale-transactions.deleteWhaleTransactionsForWhale",
  });
  for (const rec of txns) {
    if (firstLinkedId(rec.fields.whale) === whaleRecordId) {
      await deleteRecord(TABLE, rec.id);
    }
  }
}
