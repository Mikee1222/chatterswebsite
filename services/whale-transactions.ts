"use server";

import {
  listRecords,
  listAllRecords,
  createRecord,
  type AirtableRecord,
  type ListParams,
} from "@/lib/airtable-server";
import { firstLinkedId, snapshotText } from "@/lib/airtable-linked";
import { TRANSACTION_TYPES } from "@/lib/airtable-options";
import type {
  WhaleTransaction,
  TransactionCurrency,
  TransactionType,
} from "@/types";

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
  const { records, offset } = await listRecords<Fields>(TABLE, params);
  return { transactions: records.map(mapRecord), offset };
}

/** List all transactions (for admin). Filter by yearMonth "YYYY-MM" in app using date field (YYYY-MM-DD). */
export async function listAllWhaleTransactions(): Promise<WhaleTransaction[]> {
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
  const allRecords = await listAllRecords<Fields>(TABLE, {
    sort: [{ field: "created_at", direction: "desc" }],
  });
  const matched = allRecords.filter(
    (rec) => firstLinkedId(rec.fields.chatter) === chatterRecordId
  );
  const limited = matched.slice(0, limit);
  if (process.env.NODE_ENV !== "production") {
    const sample = allRecords[0];
    console.log("[listTransactionsByChatter]", {
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

  const { notify, notifyAdmins } = await import("./notification-service");
  await notify({
    user_id: fields.chatter_record_id,
    event_type: "whale_session_submitted",
    priority: "normal",
    title: "Whale session submitted",
    body: `${fields.whale_username} · ${fields.amount} ${fields.currency ?? "usd"}`,
    entity_type: "whale",
    entity_id: transaction.id,
  }).catch(() => {});

  await notifyAdmins({
    event_type: "whale_session_submitted",
    priority: "normal",
    title: "Whale session submitted",
    body: `${fields.chatter_name}: ${fields.whale_username} · ${fields.amount} ${fields.currency ?? "usd"} · ${fields.model_name}`,
    entity_type: "whale",
    entity_id: transaction.id,
  }).catch(() => {});

  return transaction;
}
