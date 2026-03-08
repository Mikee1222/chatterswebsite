"use server";

import {
  listRecords,
  listAllRecords,
  createRecord,
  updateRecord,
  type AirtableRecord,
  type ListParams,
} from "@/lib/airtable-server";
import { firstLinkedId, snapshotText } from "@/lib/airtable-linked";
import type { CustomRequest, CustomRequestStatus, CustomRequestType, CustomRequestPriority } from "@/types";

const TABLE = "custom_requests";

type Fields = {
  request_id?: string;
  chatter?: string | string[];
  chatter_name?: string;
  model?: string | string[];
  model_name?: string;
  whale?: string | string[];
  whale_username?: string;
  whale_name?: string;
  fan_username?: string;
  custom_type?: string;
  description?: string;
  price?: string;
  priority?: string;
  status?: string;
  created_at?: string;
};

function mapRecord(rec: AirtableRecord<Fields>): CustomRequest {
  const f = rec.fields;
  return {
    id: rec.id,
    request_id: f.request_id ?? "",
    chatter_id: firstLinkedId(f.chatter) ?? "",
    chatter_name: snapshotText(f.chatter_name),
    model_id: firstLinkedId(f.model) ?? "",
    model_name: snapshotText(f.model_name),
    whale_id: firstLinkedId(f.whale) ?? "",
    whale_username: snapshotText(f.whale_username),
    whale_name: snapshotText(f.whale_name),
    fan_username: f.fan_username ?? "",
    custom_type: (f.custom_type as CustomRequestType) ?? "other",
    description: f.description ?? "",
    price: f.price ?? "",
    priority: (f.priority as CustomRequestPriority) ?? "normal",
    status: (f.status as CustomRequestStatus) ?? "pending",
    created_at: f.created_at ?? "",
  };
}

export async function listCustomRequests(params: ListParams & { filterByFormula?: string } = {}) {
  const { records, offset } = await listRecords<Fields>(TABLE, params);
  return { requests: records.map(mapRecord), offset };
}

/**
 * List custom requests for the given chatter (current user). Newest first.
 * Uses app-side filtering: Airtable filterByFormula on linked fields uses display values, not record IDs,
 * so we fetch records and filter by chatter linked record id in code.
 */
export async function listCustomRequestsByChatter(chatterRecordId: string) {
  const allRecords = await listAllRecords<Fields>(TABLE, {
    sort: [{ field: "created_at", direction: "desc" }],
  });
  const matched = allRecords.filter(
    (rec) => firstLinkedId(rec.fields.chatter) === chatterRecordId
  );
  const sorted = [...matched].sort((a, b) =>
    (b.fields.created_at ?? "").localeCompare(a.fields.created_at ?? "")
  );
  if (process.env.NODE_ENV !== "production") {
    const sample = allRecords[0];
    console.log("[listCustomRequestsByChatter]", {
      chatterRecordId,
      totalFetched: allRecords.length,
      matchedCount: matched.length,
      sampleChatter: sample ? firstLinkedId(sample.fields.chatter) : null,
      sampleChatterName: sample ? snapshotText(sample.fields.chatter_name) : null,
      rawChatterField: sample?.fields?.chatter ?? null,
    });
  }
  return sorted.map(mapRecord);
}

export type CreateCustomRequestFields = {
  chatter_record_id: string;
  chatter_name: string;
  model_record_id: string;
  model_name: string;
  /** Whale/fan username for display; written to whale_username snapshot when present in base. */
  fan_username: string;
  custom_type: CustomRequestType;
  description: string;
  price: string;
  priority: CustomRequestPriority;
};

export async function createCustomRequest(fields: CreateCustomRequestFields) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const payload: Record<string, unknown> = {
    request_id: requestId,
    chatter: [fields.chatter_record_id],
    chatter_name: fields.chatter_name,
    model: [fields.model_record_id],
    model_name: fields.model_name,
    fan_username: fields.fan_username,
    custom_type: fields.custom_type,
    description: fields.description,
    price: fields.price,
    priority: fields.priority,
    status: "pending",
  };
  // Snapshot so "Previous customs" shows readable whale name (fan is the whale)
  if (fields.fan_username?.trim()) payload.whale_username = fields.fan_username.trim();
  const rec = await createRecord<Fields>(TABLE, payload as Fields);
  const request = mapRecord(rec as AirtableRecord<Fields>);

  const { notifyAdmins } = await import("./notification-service");
  await notifyAdmins({
    event_type: "custom_request_submitted",
    priority: "normal",
    title: "Custom request submitted",
    body: `${fields.chatter_name}: ${fields.custom_type} · ${fields.model_name}${fields.fan_username ? ` · ${fields.fan_username}` : ""}`,
    entity_type: "custom_request",
    entity_id: request.id,
  }).catch(() => {});

  return request;
}

/** List all custom requests (for admin). */
export async function listAllCustomRequests(): Promise<CustomRequest[]> {
  const records = await listAllRecords<Fields>(TABLE, {
    sort: [{ field: "created_at", direction: "desc" }],
  });
  return records.map((r) => mapRecord(r as AirtableRecord<Fields>));
}

/** Update custom request status (admin). */
export async function updateCustomRequestStatus(
  recordId: string,
  status: CustomRequestStatus
): Promise<CustomRequest> {
  const rec = await updateRecord<Fields>(TABLE, recordId, { status });
  return mapRecord(rec as AirtableRecord<Fields>);
}
