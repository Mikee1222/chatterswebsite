/**
 * Supabase backend for services/custom-requests.ts
 */
import { getSupabaseServiceClient } from "@/lib/supabase-server";
import {
  publicId,
  sbAirtableIdsForUuids,
  sbDeleteByPublicId,
  sbInsert,
  sbSelectAll,
  sbSelectByPublicId,
  sbUpdateByPublicId,
  sbUuidsForAirtableIds,
  type SbRow,
} from "@/lib/supabase-data";
import { awardPoints } from "@/services/points-engine";
import { getPointsConfig } from "@/services/points-config";
import { getAdminNotificationIds } from "@/services/admin-notification-settings";
import { EVENT_TYPE_TO_AIRTABLE } from "@/lib/notifications-schema";
import { NOTIFICATION_EVENT, NOTIFICATION_ENTITY, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import type {
  CustomRequest,
  CustomRequestAdminStatus,
  CustomRequestModelStatus,
} from "@/types";
import type { CreateCustomRequestFields, CustomRequestFilters } from "./custom-requests";

const TABLE = "custom_requests";

type Row = SbRow & {
  request_id?: string | null;
  fan_username?: string | null;
  requested_by_chatter?: string[] | null;
  assigned_model?: string[] | null;
  request_title?: string | null;
  request_details?: string | null;
  price?: string | null;
  deadline_requested?: string | null;
  admin_status?: string | null;
  model_status?: string | null;
  model_scheduled_date?: string | null;
  model_scheduled_start?: string | null;
  model_scheduled_end?: string | null;
  admin_notes?: string | null;
  model_notes?: string | null;
  linked_schedule_item?: string[] | null;
  uploaded_at?: string | null;
  uploaded_by_model?: boolean | null;
  decline_reason?: string | null;
  stuck_alert_sent?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
  assigned_va?: string | null;
  chatter_name?: string | null;
  model_name?: string | null;
};

async function mapRow(row: Row): Promise<CustomRequest> {
  // Airtable/product sometimes say "approved"; canonical stored value is "accepted".
  const rawAdmin = row.admin_status === "approved" ? "accepted" : row.admin_status;
  const adminStatus = (rawAdmin === "pending" || rawAdmin === "accepted" || rawAdmin === "rejected")
    ? rawAdmin
    : "pending";
  const modelStatus = (row.model_status === "waiting_schedule" || row.model_status === "scheduled" ||
    row.model_status === "in_progress" || row.model_status === "completed" || row.model_status === "uploaded" ||
    row.model_status === "declined")
    ? row.model_status
    : "waiting_schedule";
  const chatterAtIds = await sbAirtableIdsForUuids("users", row.requested_by_chatter);
  const modelAtIds = await sbAirtableIdsForUuids("modelss", row.assigned_model);
  const scheduleAtIds = await sbAirtableIdsForUuids("model_schedule", row.linked_schedule_item);
  const assignedVa = typeof row.assigned_va === "string" ? row.assigned_va.trim() : "";
  const req: CustomRequest = {
    id: publicId(row),
    request_id: row.request_id ?? "",
    fan_username: row.fan_username ?? "",
    requested_by_chatter_id: chatterAtIds[0] ?? "",
    requested_by_chatter_name: String(row.chatter_name ?? ""),
    assigned_va_id: assignedVa,
    assigned_model_id: modelAtIds[0] ?? "",
    assigned_model_name: String(row.model_name ?? ""),
    request_title: row.request_title ?? "",
    request_details: row.request_details ?? "",
    price: row.price ?? "",
    deadline_requested: row.deadline_requested ?? null,
    admin_status: adminStatus as CustomRequestAdminStatus,
    model_status: modelStatus as CustomRequestModelStatus,
    model_scheduled_date: row.model_scheduled_date ?? null,
    model_scheduled_start: row.model_scheduled_start ?? null,
    model_scheduled_end: row.model_scheduled_end ?? null,
    admin_notes: row.admin_notes ?? "",
    model_notes: row.model_notes ?? "",
    decline_reason: typeof row.decline_reason === "string" ? row.decline_reason : "",
    linked_schedule_item_id: scheduleAtIds[0] ?? null,
    uploaded_at: (row.uploaded_at ?? "").trim() || null,
    uploaded_by_model: Boolean(row.uploaded_by_model),
    created_at: row.created_at ?? "",
    updated_at: row.updated_at ?? "",
  };
  req.chatter_id = req.requested_by_chatter_id;
  req.chatter_name = req.requested_by_chatter_name;
  req.model_id = req.assigned_model_id;
  req.model_name = req.assigned_model_name;
  return req;
}

function bump(patch: Record<string, unknown>): Record<string, unknown> {
  return { ...patch, updated_at: new Date().toISOString() };
}

async function selectAllSorted(): Promise<Row[]> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb.from(TABLE).select("*").order("created_at", { ascending: false });
  if (error) throw new Error(`custom_requests: ${error.message}`);
  return (data ?? []) as unknown as Row[];
}

export async function deleteCustomRequestRecord(recordId: string): Promise<void> {
  const id = recordId?.trim();
  if (!id) throw new Error("Missing record id");
  await sbDeleteByPublicId(TABLE, id);
}

export async function listCustomRequests(params: { filterByFormula?: string; pageSize?: number; offset?: string } = {}): Promise<{ requests: CustomRequest[]; offset?: string }> {
  const rows = await selectAllSorted();
  const requests = await Promise.all(rows.map(mapRow));
  return { requests, offset: undefined };
}

export async function listCustomRequestsByModel(assignedModelRecordId: string): Promise<CustomRequest[]> {
  const uuids = await sbUuidsForAirtableIds("modelss", [assignedModelRecordId]);
  if (!uuids.length) return [];
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb.from(TABLE).select("*").contains("assigned_model", uuids).order("created_at", { ascending: false });
  if (error) throw new Error(`custom_requests: ${error.message}`);
  return Promise.all(((data ?? []) as unknown as Row[]).map(mapRow));
}

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

export async function listAcceptedCustomRequestsInDateRange(fromDate: string, toDate: string): Promise<CustomRequest[]> {
  const rows = await selectAllSorted();
  const mapped = await Promise.all(rows.map(mapRow));
  return mapped
    .filter((r) => r.admin_status === "accepted")
    .filter((r) => {
      const d = customPrimaryDateKey(r);
      return d != null && d >= fromDate && d <= toDate;
    });
}

export async function countApprovedCustomRequestsWaitingSchedule(assignedModelRecordId: string): Promise<number> {
  const rows = await listApprovedCustomRequestsByModel(assignedModelRecordId);
  return rows.filter((r) => r.model_status === "waiting_schedule").length;
}

export async function listCustomRequestsByChatter(chatterRecordId: string): Promise<CustomRequest[]> {
  const uuids = await sbUuidsForAirtableIds("users", [chatterRecordId]);
  if (!uuids.length) return [];
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb.from(TABLE).select("*").contains("requested_by_chatter", uuids).order("created_at", { ascending: false });
  if (error) throw new Error(`custom_requests: ${error.message}`);
  return Promise.all(((data ?? []) as unknown as Row[]).map(mapRow));
}

export async function createCustomRequest(fields: CreateCustomRequestFields): Promise<CustomRequest> {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const request_title = (fields.request_title ?? fields.custom_type ?? "Custom request").trim();
  const request_details = (fields.request_details ?? fields.description ?? "").trim();
  const chatterUuids = await sbUuidsForAirtableIds("users", [fields.chatter_record_id]);
  const modelUuids = await sbUuidsForAirtableIds("modelss", [fields.model_record_id]);
  const payload = bump({
    request_id: requestId,
    requested_by_chatter: chatterUuids,
    assigned_model: modelUuids,
    fan_username: fields.fan_username.trim(),
    chatter_name: fields.chatter_name,
    model_name: fields.model_name,
    request_title,
    request_details,
    price: fields.price.trim(),
    deadline_requested: fields.deadline_requested ?? "",
    admin_status: "pending",
    model_status: "waiting_schedule",
    stuck_alert_sent: false,
    admin_notes: "",
    model_notes: "",
    created_at: new Date().toISOString(),
  });
  const row = await sbInsert<Row>(TABLE, payload);
  const request = await mapRow(row);

  const { notifyByRoleConfig } = await import("./notification-service");
  const { customRequestAdmin } = await import("@/lib/notification-copy");
  const { getActiveModelUserAirtableIdByLinkedModelRecordId } = await import("@/services/users");
  const { title, body } = customRequestAdmin(
    fields.chatter_name ?? "",
    fields.request_title ?? "Custom",
    fields.model_name ?? "",
    fields.fan_username ?? undefined
  );
  const personalIds = [fields.chatter_record_id?.trim()].filter((id): id is string => !!id);
  const modelUserId = fields.model_record_id
    ? await getActiveModelUserAirtableIdByLinkedModelRecordId(fields.model_record_id).catch(() => null)
    : null;
  if (modelUserId && !personalIds.includes(modelUserId)) personalIds.push(modelUserId);
  await notifyByRoleConfig(NOTIFICATION_EVENT.CUSTOM_REQUEST_CREATED, {
    personal_user_id: personalIds.length > 0 ? personalIds : undefined,
    priority: NOTIFICATION_PRIORITY.NORMAL,
    title,
    body,
    entity_type: NOTIFICATION_ENTITY.CUSTOM_REQUEST,
    entity_id: request.id,
    actor_name: fields.chatter_name,
    context: {
      modelName: fields.model_name,
      customTitle: fields.request_title,
      fanUsername: fields.fan_username,
      chatterName: fields.chatter_name,
    },
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
  const rows = await selectAllSorted();
  return Promise.all(rows.map(mapRow));
}

export async function listCustomRequestsPaginated(
  filters: CustomRequestFilters = {},
  page = 1,
  pageSize = 50,
  cursor?: string | null
): Promise<{ records: CustomRequest[]; hasMore: boolean; total: number; nextOffset: string | null }> {
  void filters;
  void cursor;
  const sb = getSupabaseServiceClient();
  const offset = (page - 1) * pageSize;
  const { data, error, count } = await sb
    .from(TABLE)
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);
  if (error) throw new Error(`custom_requests: ${error.message}`);
  const rows = (data ?? []) as unknown as Row[];
  const mapped = await Promise.all(rows.map(mapRow));
  const total = count ?? mapped.length;
  const hasMore = offset + rows.length < total;
  return {
    records: mapped,
    hasMore,
    total,
    nextOffset: hasMore ? String(page + 1) : null,
  };
}

export async function listAdminPendingCustomRequests(): Promise<CustomRequest[]> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb.from(TABLE).select("*").eq("admin_status", "pending").order("created_at", { ascending: false });
  if (error) throw new Error(`custom_requests: ${error.message}`);
  return Promise.all(((data ?? []) as unknown as Row[]).map(mapRow));
}

export async function countAdminPendingCustomRequests(): Promise<number> {
  try {
    const sb = getSupabaseServiceClient();
    const { count, error } = await sb.from(TABLE).select("id", { count: "exact", head: true }).eq("admin_status", "pending");
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function patchCustomRequestRecord(
  recordId: string,
  fields: Partial<{ request_details: string; price: string; deadline_requested: string; admin_status: CustomRequestAdminStatus; decline_reason: string }>
): Promise<CustomRequest> {
  const nextFields: Record<string, unknown> = { ...fields };
  if (fields.admin_status !== undefined) nextFields.stuck_alert_sent = false;
  const row = await sbUpdateByPublicId<Row>(TABLE, recordId, bump(nextFields));
  return mapRow(row);
}

export async function updateCustomRequestAdminStatus(
  recordId: string,
  admin_status: CustomRequestAdminStatus | "approved"
): Promise<CustomRequest> {
  // Product UI says "approved"; Postgres/Airtable canonical value is "accepted".
  const status: CustomRequestAdminStatus =
    admin_status === "approved" ? "accepted" : admin_status;
  const row = await sbUpdateByPublicId<Row>(TABLE, recordId, bump({ admin_status: status, stuck_alert_sent: false }));
  return mapRow(row);
}

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
  const fields: Record<string, unknown> = {};
  if (input.model_status !== undefined) {
    fields.model_status = input.model_status;
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
    const schedUuids = input.linked_schedule_item_id
      ? await sbUuidsForAirtableIds("model_schedule", [input.linked_schedule_item_id])
      : [];
    fields.linked_schedule_item = schedUuids;
  }
  if (input.uploaded_at !== undefined) {
    fields.uploaded_at = input.uploaded_at?.trim() ? input.uploaded_at.trim() : "";
  }
  if (input.uploaded_by_model !== undefined) {
    fields.uploaded_by_model = input.uploaded_by_model;
  }
  const row = await sbUpdateByPublicId<Row>(TABLE, recordId, bump(fields));
  const updated = await mapRow(row);
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

export async function updateCustomRequestStatus(recordId: string, status: string): Promise<CustomRequest> {
  const admin_status = (status === "accepted" || status === "rejected" ? status : "pending") as CustomRequestAdminStatus;
  return updateCustomRequestAdminStatus(recordId, admin_status);
}

export async function getCustomRequestById(recordId: string): Promise<CustomRequest | null> {
  const row = await sbSelectByPublicId<Row>(TABLE, recordId);
  return row ? mapRow(row) : null;
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

export async function runCustomRequestOverdue48hAdminAlerts(): Promise<{ ok: true; alerts_sent: number }> {
  const { findExistingNotification } = await import("@/services/notifications");
  const { notify } = await import("@/services/notification-service");
  const adminIds = await getAdminNotificationIds();
  if (adminIds.length === 0) return { ok: true, alerts_sent: 0 };

  const rows = await sbSelectAll<Row>(TABLE);
  const now = Date.now();
  let alerts_sent = 0;

  for (const row of rows) {
    const adminRaw = String(row.admin_status ?? "");
    const modelRaw = String(row.model_status ?? "");
    if (customRequestRawTerminal(adminRaw, modelRaw)) continue;
    const updatedRaw = (row.updated_at ?? row.created_at ?? "").trim();
    const updatedMs = new Date(updatedRaw).getTime();
    if (!Number.isFinite(updatedMs) || now - updatedMs < STALE_UPDATE_MS) continue;

    const req = await mapRow(row);
    const customTitle = (req.request_title || "Custom request").trim() || "Custom request";
    const chatterName = (req.chatter_name || "—").trim();
    const title = "⏰ Custom request overdue";
    const body = `⏰ ${customTitle} has had no update in over 48 hours. Assigned to: ${chatterName}.`;
    const entityId = `custom_overdue_${req.id}`;

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

export async function listStuckCustomRequestsSince(olderThanIso: string): Promise<CustomRequest[]> {
  const thresholdMs = new Date(olderThanIso).getTime();
  if (!Number.isFinite(thresholdMs)) return [];
  const rows = await sbSelectAll<Row>(TABLE);
  const filtered = rows.filter((row) => {
    if (Boolean(row.stuck_alert_sent)) return false;
    const admin = String(row.admin_status ?? "").toLowerCase().trim();
    const model = String(row.model_status ?? "").toLowerCase().trim();
    const inTargetStatus =
      admin === "pending" || admin === "accepted" || admin === "approved" || model === "waiting_schedule";
    if (!inTargetStatus) return false;
    if (model === "completed" || model === "uploaded" || model === "declined") return false;
    const updatedRaw = (row.updated_at ?? row.created_at ?? "").trim();
    const updatedMs = new Date(updatedRaw).getTime();
    if (!Number.isFinite(updatedMs)) return false;
    return updatedMs <= thresholdMs;
  });
  return Promise.all(filtered.map(mapRow));
}

export async function markCustomRequestStuckAlertSent(recordId: string, sent: boolean): Promise<void> {
  await sbUpdateByPublicId(TABLE, recordId, bump({ stuck_alert_sent: sent }));
}

export async function countCustomRequestsPendingOrInProgress(): Promise<number> {
  const rows = await sbSelectAll<Row>(TABLE);
  let n = 0;
  for (const row of rows) {
    const adminRaw = String(row.admin_status ?? "");
    const modelRaw = String(row.model_status ?? "");
    if (customRequestRawTerminal(adminRaw, modelRaw)) continue;
    const al = adminRaw.toLowerCase().trim();
    const ml = modelRaw.toLowerCase().trim();
    if (al === "pending" || ml === "in_progress") n++;
  }
  return n;
}
