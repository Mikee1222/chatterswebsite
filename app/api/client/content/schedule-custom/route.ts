import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireClientModelAccess } from "@/lib/client-content-auth";
import { ROUTES } from "@/lib/routes";
import {
  customScheduledAdmin,
  customScheduledChatter,
  formatTimeShort,
} from "@/lib/notification-copy";
import {
  NOTIFICATION_EVENT,
  NOTIFICATION_ENTITY,
  NOTIFICATION_PRIORITY,
} from "@/lib/notification-types";
import {
  getCustomRequestById,
  updateCustomRequestModelSchedule,
} from "@/services/custom-requests";
import { createModelScheduleItemForCustom } from "@/services/model-schedule";
import { notify, notifyAdmins } from "@/services/notification-service";
import { getModelById } from "@/services/modelss";
import { getActiveModelUserAirtableIdByLinkedModelRecordId } from "@/services/users";

const bodySchema = z.object({
  record_id: z.string().min(1),
  model_id: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().min(1),
  end_time: z.string().min(1),
  notes: z.string().max(8000).optional(),
});

function localDateTimeIso(dateYmd: string, timeHhMm: string): string {
  const [y, mo, d] = dateYmd.split("-").map((x) => Number(x));
  const parts = timeHhMm.trim().split(":");
  const hh = Number(parts[0]);
  const mm = Number(parts[1] ?? 0);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d) || !Number.isFinite(hh)) return "";
  const dt = new Date(y, mo - 1, d, hh, Number.isFinite(mm) ? mm : 0, 0, 0);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toISOString();
}

function mergeNotes(existing: string, addition: string): string {
  const a = existing.trim();
  const b = addition.trim();
  if (a && b) return `${a}\n\n${b}`;
  return a || b;
}

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { record_id, model_id, date, start_time, end_time, notes } = parsed.data;
  const access = await requireClientModelAccess(model_id);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const startIso = localDateTimeIso(date, start_time.length <= 5 ? `${start_time}:00` : start_time);
  const endIso = localDateTimeIso(date, end_time.length <= 5 ? `${end_time}:00` : end_time);
  if (!startIso || !endIso) {
    return NextResponse.json({ error: "Invalid date or time." }, { status: 400 });
  }
  if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
    return NextResponse.json({ error: "End time must be after start time." }, { status: 400 });
  }

  const existing = await getCustomRequestById(record_id);
  if (!existing) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }
  if (existing.assigned_model_id !== model_id) {
    return NextResponse.json({ error: "This request is not assigned to this model." }, { status: 403 });
  }
  if (existing.admin_status !== "accepted") {
    return NextResponse.json({ error: "This request is not approved yet." }, { status: 400 });
  }
  if (existing.model_status !== "waiting_schedule") {
    return NextResponse.json({ error: "Only pending requests can be scheduled." }, { status: 400 });
  }

  const modelRecord = await getModelById(model_id).catch(() => null);
  const modelName = modelRecord?.model_name?.trim() || existing.assigned_model_name?.trim() || "Model";
  const customTitle = (existing.request_title ?? "").trim() || "Custom request";
  const timeRange = `${formatTimeShort(startIso)}–${formatTimeShort(endIso)}`;

  try {
    const scheduleItem = await createModelScheduleItemForCustom({
      model_record_id: model_id,
      custom_request_id: record_id,
      title: customTitle,
      date,
      start_time: startIso,
      end_time: endIso,
      details: (notes ?? "").trim(),
      model_name: modelName,
      chatter_record_id: existing.requested_by_chatter_id?.trim() || null,
      created_by_record_id: access.actorUserId || null,
    });

    const nextNotes = mergeNotes(existing.model_notes ?? "", notes?.trim() ?? "");

    await updateCustomRequestModelSchedule(record_id, {
      model_status: "scheduled",
      model_scheduled_date: date,
      model_scheduled_start: startIso,
      model_scheduled_end: endIso,
      model_notes: nextNotes,
      linked_schedule_item_id: scheduleItem.id,
    });

    if (existing.requested_by_chatter_id) {
      const { title, body } = customScheduledChatter(customTitle, date, timeRange);
      await notify({
        user_id: existing.requested_by_chatter_id,
        event_type: NOTIFICATION_EVENT.CUSTOM_SCHEDULED,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title,
        body,
        entity_type: NOTIFICATION_ENTITY.CUSTOM_REQUEST,
        entity_id: record_id,
        actor_user_id: access.actorUserId,
        actor_name: access.actorName,
        _triggerSource: "client_schedule_custom_chatter",
      }).catch(() => {});
    }

    const adminCopy = customScheduledAdmin(modelName, date, timeRange);
    await notifyAdmins({
      event_type: NOTIFICATION_EVENT.CUSTOM_SCHEDULED,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      title: adminCopy.title,
      body: `${adminCopy.body} (${customTitle}). Scheduled by ${access.actorName}.`,
      entity_type: NOTIFICATION_ENTITY.CUSTOM_REQUEST,
      entity_id: record_id,
      actor_user_id: access.actorUserId,
      actor_name: access.actorName,
    }).catch(() => {});

    const modelUserId = await getActiveModelUserAirtableIdByLinkedModelRecordId(model_id);
    if (modelUserId) {
      await notify({
        user_id: modelUserId,
        event_type: NOTIFICATION_EVENT.CUSTOM_SCHEDULED,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: "🗓 Custom scheduled",
        body: `A custom "${customTitle}" has been scheduled. Check your calendar.`,
        entity_type: NOTIFICATION_ENTITY.CUSTOM_REQUEST,
        entity_id: record_id,
        actor_user_id: access.actorUserId,
        actor_name: access.actorName,
        _triggerSource: "client_schedule_custom_model",
      }).catch(() => {});
    }

    const { broadcastRealtimeToAll } = await import("@/lib/realtime-broadcast");
    await broadcastRealtimeToAll({ type: "custom_request_updated", custom_request_id: record_id }).catch(
      () => {},
    );

    revalidatePath(ROUTES.client.content);
    revalidatePath(ROUTES.model.customs);
    revalidatePath(ROUTES.model.schedule);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message || "Schedule failed." }, { status: 500 });
  }
}
