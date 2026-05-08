"use server";

import {
  listRecords,
  listAllRecords,
  getRecord,
  createRecord,
  updateRecord,
  deleteRecord,
  type AirtableRecord,
  type ListParams,
} from "@/lib/airtable-server";
import { awardPoints } from "@/services/points-engine";
import { getPointsConfig } from "@/services/points-config";
import { getAdminNotificationIds } from "@/services/admin-notification-settings";
import { EVENT_TYPE_TO_AIRTABLE } from "@/lib/notifications-schema";
import { NOTIFICATION_EVENT, NOTIFICATION_ENTITY, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import { firstLinkedId, snapshotText } from "@/lib/airtable-linked";
import type {
  CustomRequest,
  CustomRequestAdminStatus,
  CustomRequestModelStatus,
} from "@/types";

const TABLE = "custom_requests";

export async function deleteCustomRequestRecord(recordId: string): Promise<void> {
  const id = recordId?.trim();
  if (!id) throw new Error("Missing record id");
  await deleteRecord(TABLE, id);
}

type Fields = {
  request_id?: string;
  fan_username?: string;
  requested_by_chatter?: string | string[];
  assigned_model?: string | string[];
  request_title?: string;
  request_details?: string;
  price?: string;
  deadline_requested?: string;
  admin_status?: string;
  model_status?: string;
  model_scheduled_date?: string;
  model_scheduled_start?: string;
  model_scheduled_end?: string;
  admin_notes?: string;
  model_notes?: string;
  linked_schedule_item?: string | string[];
  uploaded_at?: string;
  uploaded_by_model?: boolean;
  decline_reason?: string;
  stuck_alert_sent?: boolean;
  created_at?: string;
  updated_at?: string;
  /** Optional multipleRecordLinks → users (VA assigned to handle this custom). */
  assigned_va?: string | string[];
};

function mapRecord(rec: AirtableRecord<Fields>): CustomRequest {
  const f = rec.fields;
  const adminStatus = (f.admin_status === "pending" || f.admin_status === "accepted" || f.admin_status === "rejected")
    ? f.admin_status
    : "pending";
  const modelStatus = (f.model_status === "waiting_schedule" || f.model_status === "scheduled" ||
    f.model_status === "in_progress" || f.model_status === "completed" || f.model_status === "uploaded" ||
    f.model_status === "declined")
    ? f.model_status
    : "waiting_schedule";
  const req: CustomRequest = {
    id: rec.id,
    request_id: f.request_id ?? "",
    fan_username: f.fan_username ?? "",
    requested_by_chatter_id: firstLinkedId(f.requested_by_chatter) ?? "",
    requested_by_chatter_name: snapshotText(f.requested_by_chatter),
    assigned_va_id: firstLinkedId(f.assigned_va) ?? "",
    assigned_model_id: firstLinkedId(f.assigned_model) ?? "",
    assigned_model_name: snapshotText(f.assigned_model),
    request_title: f.request_title ?? "",
    request_details: f.request_details ?? "",
    price: f.price ?? "",
    deadline_requested: f.deadline_requested ?? null,
    admin_status: adminStatus as CustomRequestAdminStatus,
    model_status: modelStatus as CustomRequestModelStatus,
    model_scheduled_date: f.model_scheduled_date ?? null,
    model_scheduled_start: f.model_scheduled_start ?? null,
    model_scheduled_end: f.model_scheduled_end ?? null,
    admin_notes: f.admin_notes ?? "",
    model_notes: f.model_notes ?? "",
    decline_reason: typeof f.decline_reason === "string" ? f.decline_reason : "",
    linked_schedule_item_id: firstLinkedId(f.linked_schedule_item) ?? null,
    uploaded_at: (f.uploaded_at ?? "").trim() || null,
    uploaded_by_model: Boolean(f.uploaded_by_model),
    created_at: f.created_at ?? "",
    updated_at: f.updated_at ?? "",
  };
  req.chatter_id = req.requested_by_chatter_id;
  req.chatter_name = req.requested_by_chatter_name;
  req.model_id = req.assigned_model_id;
  req.model_name = req.assigned_model_name;
  return req;
}

export async function listCustomRequests(params: ListParams & { filterByFormula?: string } = {}) {
  const { records, offset } = await listRecords<Fields>(TABLE, params);
  return { requests: records.map((r) => mapRecord(r as AirtableRecord<Fields>)), offset };
}

/** List custom requests assigned to this model (modelss record id). */
export async function listCustomRequestsByModel(assignedModelRecordId: string): Promise<CustomRequest[]> {
  const all = await listAllRecords<Fields>(TABLE, {
    sort: [{ field: "created_at", direction: "desc" }],
  });
  const matched = all.filter((rec) => firstLinkedId(rec.fields.assigned_model) === assignedModelRecordId);
  return matched.map((r) => mapRecord(r as AirtableRecord<Fields>));
}

/** Customs assigned to this model with agency acceptance (`admin_status === 'accepted'`). */
export async function listApprovedCustomRequestsByModel(assignedModelRecordId: string): Promise<CustomRequest[]> {
  const rows = await listCustomRequestsByModel(assignedModelRecordId);
  return rows.filter((r) => r.admin_status === "accepted");
}

function customPrimaryDateKey(r: CustomRequest): string | null {
  const sched = r.model_scheduled_date?.trim().slice(0, 10);
  if (sched && /^\d{4}-\d{2}-\d{2}$/.test(sched)) return sched;
  const dl = r.deadline_requested?.trim().slice(0, 10);
  if (dl && /^\d{4}-\d{2}-\d{2}$/.test(dl)) return dl;
  return r.created_at?.trim().slice(0, 10) ?? null;
}

/**
 * Agency-approved customs (`admin_status === 'accepted'` in Airtable; product language “approved”)
 * whose primary date (scheduled date, else deadline, else created) falls in [fromDate, toDate] inclusive.
 */
export async function listAcceptedCustomRequestsInDateRange(fromDate: string, toDate: string): Promise<CustomRequest[]> {
  const all = await listAllRecords<Fields>(TABLE, {
    sort: [{ field: "created_at", direction: "desc" }],
  });
  return all
    .map((r) => mapRecord(r as AirtableRecord<Fields>))
    .filter((r) => r.admin_status === "accepted")
    .filter((r) => {
      const d = customPrimaryDateKey(r);
      return d != null && d >= fromDate && d <= toDate;
    });
}

/** Accepted customs still waiting for the model to schedule (`waiting_schedule`). */
export async function countApprovedCustomRequestsWaitingSchedule(assignedModelRecordId: string): Promise<number> {
  const rows = await listApprovedCustomRequestsByModel(assignedModelRecordId);
  return rows.filter((r) => r.model_status === "waiting_schedule").length;
}

/** List custom requests by chatter (requested_by_chatter link). */
export async function listCustomRequestsByChatter(chatterRecordId: string): Promise<CustomRequest[]> {
  const all = await listAllRecords<Fields>(TABLE, {
    sort: [{ field: "created_at", direction: "desc" }],
  });
  const matched = all.filter((rec) => firstLinkedId(rec.fields.requested_by_chatter) === chatterRecordId);
  return matched.map((r) => mapRecord(r as AirtableRecord<Fields>));
}

export type CreateCustomRequestFields = {
  chatter_record_id: string;
  chatter_name: string;
  model_record_id: string;
  model_name: string;
  fan_username: string;
  /** Preferred; otherwise derived from custom_type/description */
  request_title?: string;
  request_details?: string;
  /** Legacy form: maps to request_title if request_title not provided */
  custom_type?: string;
  /** Legacy form: maps to request_details if request_details not provided */
  description?: string;
  price: string;
  deadline_requested?: string | null;
};

export async function createCustomRequest(fields: CreateCustomRequestFields): Promise<CustomRequest> {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const request_title = (fields.request_title ?? fields.custom_type ?? "Custom request").trim();
  const request_details = (fields.request_details ?? fields.description ?? "").trim();
  const payload: Record<string, unknown> = {
    request_id: requestId,
    requested_by_chatter: [fields.chatter_record_id],
    assigned_model: [fields.model_record_id],
    fan_username: fields.fan_username.trim(),
    request_title,
    request_details,
    price: fields.price.trim(),
    deadline_requested: fields.deadline_requested ?? "",
    admin_status: "pending",
    model_status: "waiting_schedule",
    stuck_alert_sent: false,
    admin_notes: "",
    model_notes: "",
  };
  const rec = await createRecord<Fields>(TABLE, payload as Fields);
  const request = mapRecord(rec as AirtableRecord<Fields>);

  const { notifyAdmins } = await import("./notification-service");
  const { NOTIFICATION_EVENT, NOTIFICATION_ENTITY, NOTIFICATION_PRIORITY } = await import("@/lib/notification-types");
  const { customRequestAdmin } = await import("@/lib/notification-copy");
  const { title, body } = customRequestAdmin(
    fields.chatter_name ?? "",
    fields.request_title ?? "Custom",
    fields.model_name ?? "",
    fields.fan_username ?? undefined
  );
  await notifyAdmins({
    event_type: NOTIFICATION_EVENT.CUSTOM_REQUEST_CREATED,
    priority: NOTIFICATION_PRIORITY.NORMAL,
    title,
    body,
    entity_type: NOTIFICATION_ENTITY.CUSTOM_REQUEST,
    entity_id: request.id,
    actor_name: fields.chatter_name,
  }).catch((e) => console.error("[notify] custom_request_created failed", e));

  const { notifyActiveVirtualAssistantsCustomCreated } = await import("@/services/custom-request-notify-vas");
  await notifyActiveVirtualAssistantsCustomCreated({
    chatter_name: fields.chatter_name ?? "",
    request_title,
    model_name: fields.model_name ?? "",
    fan_username: fields.fan_username,
    entity_id: request.id,
  }).catch((e) => console.error("[notify] VA custom_request_created failed", e));

  const { broadcastRealtimeToAll } = await import("@/lib/realtime-broadcast");
  await broadcastRealtimeToAll({ type: "custom_request_created", custom_request_id: request.id }).catch(() => {});

  return request;
}

export async function listAllCustomRequests(): Promise<CustomRequest[]> {
  const records = await listAllRecords<Fields>(TABLE, {
    sort: [{ field: "created_at", direction: "desc" }],
  });
  return records.map((r) => mapRecord(r as AirtableRecord<Fields>));
}

/** Filters for paginated reads (passed through to `listRecords`). */
export type CustomRequestFilters = {
  filterByFormula?: string;
};

/**
 * Cursor-based pagination for admin UI. Prefer `cursor`/`nextOffset` over `page` (included for signature parity).
 */
export async function listCustomRequestsPaginated(
  filters: CustomRequestFilters = {},
  page = 1,
  pageSize = 50,
  cursor?: string | null
): Promise<{ records: CustomRequest[]; hasMore: boolean; total: number; nextOffset: string | null }> {
  void page;
  const { records, offset } = await listRecords<Fields>(TABLE, {
    sort: [{ field: "created_at", direction: "desc" }],
    pageSize,
    ...(cursor ? { offset: cursor } : {}),
    ...(filters.filterByFormula?.trim()
      ? { filterByFormula: filters.filterByFormula.trim() }
      : {}),
    _caller: "custom-requests.listCustomRequestsPaginated",
  });
  const mapped = records.map((r) => mapRecord(r as AirtableRecord<Fields>));
  const nextOffset = offset ?? null;
  return {
    records: mapped,
    hasMore: Boolean(nextOffset),
    total: mapped.length,
    nextOffset,
  };
}

/** Admin queue: `admin_status` pending only (Airtable value is `pending`, not `declined`). */
export async function listAdminPendingCustomRequests(): Promise<CustomRequest[]> {
  const records = await listAllRecords<Fields>(TABLE, {
    filterByFormula: `{admin_status} = "pending"`,
    sort: [{ field: "created_at", direction: "desc" }],
  });
  return records.map((r) => mapRecord(r as AirtableRecord<Fields>));
}

/** Partial update for admin edit / decline fields (sanitized via updateRecord). */
export async function patchCustomRequestRecord(
  recordId: string,
  fields: Partial<Pick<Fields, "request_details" | "price" | "deadline_requested" | "admin_status" | "decline_reason">>
): Promise<CustomRequest> {
  const nextFields: Partial<Fields> = { ...fields };
  if (fields.admin_status !== undefined) {
    // Any status transition should allow future stuck alerts if the request stalls again.
    nextFields.stuck_alert_sent = false;
  }
  const rec = await updateRecord<Fields>(TABLE, recordId, nextFields);
  return mapRecord(rec as AirtableRecord<Fields>);
}

/** Update admin_status (admin accept/reject). */
export async function updateCustomRequestAdminStatus(
  recordId: string,
  admin_status: CustomRequestAdminStatus
): Promise<CustomRequest> {
  const rec = await updateRecord<Fields>(TABLE, recordId, { admin_status, stuck_alert_sent: false });
  return mapRecord(rec as AirtableRecord<Fields>);
}

/** Update model_status and/or schedule (model scheduling). Date/datetime: only set when non-empty; Airtable expects date YYYY-MM-DD and start/end as full ISO. */
export async function updateCustomRequestModelSchedule(
  recordId: string,
  input: {
    model_status?: CustomRequestModelStatus;
    model_scheduled_date?: string | null;
    model_scheduled_start?: string | null;
    model_scheduled_end?: string | null;
    model_notes?: string;
    linked_schedule_item_id?: string | null;
    uploaded_at?: string | null;
    uploaded_by_model?: boolean;
  }
): Promise<CustomRequest> {
  const prev = await getCustomRequestById(recordId);
  const fields: Partial<Fields> = {};
  if (input.model_status !== undefined) fields.model_status = input.model_status;
  if (input.model_status !== undefined) {
    // Reset so future stalls can alert again after status moves.
    fields.stuck_alert_sent = false;
  }
  if (input.model_scheduled_date !== undefined && input.model_scheduled_date?.trim()) {
    fields.model_scheduled_date = input.model_scheduled_date.trim().slice(0, 10);
  }
  if (input.model_scheduled_start !== undefined && input.model_scheduled_start?.trim()) {
    fields.model_scheduled_start = input.model_scheduled_start.trim();
  }
  if (input.model_scheduled_end !== undefined && input.model_scheduled_end?.trim()) {
    fields.model_scheduled_end = input.model_scheduled_end.trim();
  }
  if (input.model_notes !== undefined) fields.model_notes = input.model_notes;
  if (input.linked_schedule_item_id !== undefined) {
    fields.linked_schedule_item = input.linked_schedule_item_id ? [input.linked_schedule_item_id] : [];
  }
  if (input.uploaded_at !== undefined) {
    fields.uploaded_at = input.uploaded_at?.trim() ? input.uploaded_at.trim() : "";
  }
  if (input.uploaded_by_model !== undefined) {
    fields.uploaded_by_model = input.uploaded_by_model;
  }
  const rec = await updateRecord<Fields>(TABLE, recordId, fields);
  const updated = mapRecord(rec as AirtableRecord<Fields>);
  const becameDelivered =
    (input.model_status === "completed" || input.model_status === "uploaded") &&
    prev &&
    prev.model_status !== "completed" &&
    prev.model_status !== "uploaded" &&
    updated.requested_by_chatter_id;
  if (becameDelivered) {
    const reason =
      input.model_status === "uploaded" ? "Custom request uploaded" : "Custom request completed";
    setTimeout(() => {
      void getPointsConfig()
        .then((pointsConfig) =>
          awardPoints(
            updated.requested_by_chatter_id,
            pointsConfig.CUSTOM_COMPLETED,
            reason,
            "custom",
            recordId
          )
        )
        .catch((e) => console.error("[points-engine] custom completed awardPoints failed", e));
    }, 100);
    setTimeout(() => {
      void import("@/services/challenges").then(({ updateChallengeProgress }) =>
        updateChallengeProgress(updated.requested_by_chatter_id, "customs_completed", 1).catch((e) =>
          console.error("[challenges] updateChallengeProgress customs_completed failed", e)
        )
      );
    }, 100);
  }
  return updated;
}

/** Legacy: update status (maps to admin_status for accepted/rejected). */
export async function updateCustomRequestStatus(
  recordId: string,
  status: string
): Promise<CustomRequest> {
  const admin_status = (status === "accepted" || status === "rejected" ? status : "pending") as CustomRequestAdminStatus;
  return updateCustomRequestAdminStatus(recordId, admin_status);
}

export async function getCustomRequestById(recordId: string): Promise<CustomRequest | null> {
  try {
    const rec = await getRecord<Fields>(TABLE, recordId);
    return mapRecord(rec as AirtableRecord<Fields>);
  } catch {
    return null;
  }
}

const STALE_UPDATE_MS = 48 * 60 * 60 * 1000;
const AIRTABLE_EVENT_CUSTOM_OVERDUE =
  EVENT_TYPE_TO_AIRTABLE[NOTIFICATION_EVENT.CUSTOM_OVERDUE] ?? "custom_request_updated";

function customRequestRawTerminal(adminRaw: string, modelRaw: string): boolean {
  const a = String(adminRaw ?? "").toLowerCase().trim();
  const m = String(modelRaw ?? "").toLowerCase().trim();
  if (a === "rejected" || a === "accepted" || a === "approved" || a === "cancelled") return true;
  if (m === "completed" || m === "uploaded" || m === "declined") return true;
  return false;
}

/**
 * Cron: custom requests with no update in 48+ hours (non-terminal). One admin notification per request
 * (dedup entity_id `custom_overdue_${recordId}`), per admin via findExistingNotification.
 */
export async function runCustomRequestOverdue48hAdminAlerts(): Promise<{ ok: true; alerts_sent: number }> {
  const { findExistingNotification } = await import("@/services/notifications");
  const { notify } = await import("@/services/notification-service");
  const adminIds = await getAdminNotificationIds();
  if (adminIds.length === 0) return { ok: true, alerts_sent: 0 };

  const records = await listAllRecords<Fields>(TABLE, {});
  const now = Date.now();
  let alerts_sent = 0;

  for (const rec of records) {
    const f = rec.fields;
    const adminRaw = String(f.admin_status ?? "");
    const modelRaw = String(f.model_status ?? "");
    if (customRequestRawTerminal(adminRaw, modelRaw)) continue;

    const updatedRaw = (f.updated_at ?? f.created_at ?? "").trim();
    const updatedMs = new Date(updatedRaw).getTime();
    if (!Number.isFinite(updatedMs) || now - updatedMs < STALE_UPDATE_MS) continue;

    const req = mapRecord(rec as AirtableRecord<Fields>);
    const customTitle = (req.request_title || "Custom request").trim() || "Custom request";
    const chatterName = (req.chatter_name || "—").trim();
    const title = "⚠️ Custom request overdue";
    const body = `${customTitle} has had no update in over 48 hours. Assigned to: ${chatterName}.`;
    const entityId = `custom_overdue_${rec.id}`;

    for (const adminId of adminIds) {
      const dup = await findExistingNotification(
        adminId,
        NOTIFICATION_ENTITY.CUSTOM_REQUEST,
        entityId,
        AIRTABLE_EVENT_CUSTOM_OVERDUE
      ).catch(() => true);
      if (dup) continue;
      await notify({
        user_id: adminId,
        event_type: NOTIFICATION_EVENT.CUSTOM_OVERDUE,
        priority: NOTIFICATION_PRIORITY.HIGH,
        title,
        body,
        entity_type: NOTIFICATION_ENTITY.CUSTOM_REQUEST,
        entity_id: entityId,
        actor_name: chatterName,
      }).catch(() => {});
      alerts_sent++;
    }
  }

  return { ok: true, alerts_sent };
}

/** Cron helper: requests stuck for 2+ days without updates and not yet alerted. */
export async function listStuckCustomRequestsSince(olderThanIso: string): Promise<CustomRequest[]> {
  const thresholdMs = new Date(olderThanIso).getTime();
  if (!Number.isFinite(thresholdMs)) return [];
  const all = await listAllRecords<Fields>(TABLE, {});
  return all
    .filter((rec) => {
      const f = rec.fields;
      if (Boolean(f.stuck_alert_sent)) return false;
      const admin = String(f.admin_status ?? "").toLowerCase().trim();
      const model = String(f.model_status ?? "").toLowerCase().trim();
      const inTargetStatus =
        admin === "pending" || admin === "accepted" || admin === "approved" || model === "waiting_schedule";
      if (!inTargetStatus) return false;
      if (model === "completed" || model === "uploaded" || model === "declined") return false;
      const updatedRaw = (f.updated_at ?? f.created_at ?? "").trim();
      const updatedMs = new Date(updatedRaw).getTime();
      if (!Number.isFinite(updatedMs)) return false;
      return updatedMs <= thresholdMs;
    })
    .map((r) => mapRecord(r as AirtableRecord<Fields>));
}

export async function markCustomRequestStuckAlertSent(recordId: string, sent: boolean): Promise<void> {
  await updateRecord<Fields>(TABLE, recordId, { stuck_alert_sent: sent });
}

/** Open customs with admin pending or model in_progress (raw fields; excludes terminal statuses). */
export async function countCustomRequestsPendingOrInProgress(): Promise<number> {
  const records = await listAllRecords<Fields>(TABLE, {});
  let n = 0;
  for (const rec of records) {
    const adminRaw = String(rec.fields.admin_status ?? "");
    const modelRaw = String(rec.fields.model_status ?? "");
    if (customRequestRawTerminal(adminRaw, modelRaw)) continue;
    const al = adminRaw.toLowerCase().trim();
    const ml = modelRaw.toLowerCase().trim();
    if (al === "pending" || ml === "in_progress") n++;
  }
  return n;
}
