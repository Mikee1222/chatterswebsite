import { NextResponse } from "next/server";
import { z } from "zod";
import { requireModelApiContext } from "@/lib/model-api-auth";
import {
  createModelPersonalEvent,
  listModelPersonalEventsForModel,
  personalEventEmoji,
  personalEventLabel,
} from "@/services/model-personal-events";
import { listVAContentAssignmentsForModel } from "@/services/va-content-assignments";
import { notify, notifyAdmins } from "@/services/notification-service";
import { NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";

const bodySchema = z
  .object({
    event_type: z.enum(["nails", "lashes", "hairdresser", "surgery", "fillers", "custom"]),
    custom_label: z.string().trim().max(120).optional(),
    event_date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
    event_time: z.string().trim().max(20).optional(),
    notes: z.string().trim().max(4000).optional(),
  })
  .refine((v) => (v.event_type === "custom" ? (v.custom_label ?? "").trim().length > 0 : true), {
    message: "Custom label is required for custom event",
    path: ["custom_label"],
  });

export async function GET() {
  const ctx = await requireModelApiContext();
  if (!ctx.ok) return ctx.response;
  const records = await listModelPersonalEventsForModel(ctx.linkedModelId).catch(() => []);
  return NextResponse.json({ records });
}

export async function POST(req: Request) {
  const ctx = await requireModelApiContext();
  if (!ctx.ok) return ctx.response;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(" ") }, { status: 400 });
  }

  const row = await createModelPersonalEvent({
    model_id: ctx.linkedModelId,
    model_user_id: ctx.userRecordId,
    event_type: parsed.data.event_type,
    custom_label: parsed.data.custom_label,
    event_date: parsed.data.event_date,
    event_time: parsed.data.event_time,
    notes: parsed.data.notes,
  });

  const modelName = (ctx.modelRecord.model_name ?? "").trim() || "Model";
  const eventEmoji = personalEventEmoji(row.event_type);
  const eventLabel = personalEventLabel(row);
  const formattedDate = row.event_date;

  await notifyAdmins({
    event_type: NOTIFICATION_EVENT.SCHEDULE_UPDATED,
    priority: NOTIFICATION_PRIORITY.NORMAL,
    title: ` ${modelName} added a personal event`,
    body: `${eventEmoji} ${eventLabel} on ${formattedDate}`,
    entity_type: "system",
    entity_id: row.id,
    actor_user_id: ctx.userRecordId,
    actor_name: modelName,
  }).catch(() => {});

  const assignments = await listVAContentAssignmentsForModel(ctx.linkedModelId, ctx.modelRecord.model_id).catch(() => []);
  const vaIds = [...new Set(assignments.map((a) => a.va_id?.trim()).filter((v): v is string => Boolean(v)))];
  await Promise.all(
    vaIds.map((vaId) =>
      notify({
        user_id: vaId,
        event_type: NOTIFICATION_EVENT.SCHEDULE_UPDATED,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: ` ${modelName} added a personal event`,
        body: `${eventEmoji} ${eventLabel} on ${formattedDate} — plan content around this.`,
        entity_type: "system",
        entity_id: row.id,
      }).catch(() => {})
    )
  );

  return NextResponse.json({ success: true, record: row });
}
