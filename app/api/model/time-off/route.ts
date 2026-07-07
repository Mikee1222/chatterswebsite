import { NextResponse } from "next/server";
import { z } from "zod";
import { requireModelApiContext } from "@/lib/model-api-auth";
import { createModelScheduleTimeOff } from "@/services/model-schedule";
import { notifyAdmins } from "@/services/notification-service";
import { NOTIFICATION_EVENT, NOTIFICATION_ENTITY, NOTIFICATION_PRIORITY } from "@/lib/notification-types";

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const bodySchema = z.object({
  start_date: ymd,
  end_date: ymd,
  reason: z.string().min(1).max(2000),
});

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
  if (!parsed.success || parsed.data.start_date > parsed.data.end_date) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const modelName = (ctx.modelRecord.model_name ?? "").trim() || "Model";
    await createModelScheduleTimeOff({
      model_record_id: ctx.linkedModelId,
      start_date: parsed.data.start_date,
      end_date: parsed.data.end_date,
      reason: parsed.data.reason,
      model_name: modelName,
      created_by_record_id: ctx.userRecordId,
    });
    await notifyAdmins({
      event_type: NOTIFICATION_EVENT.TIME_OFF_REQUESTED,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      title: "🌴 Time off requested",
      body: `${modelName} requested time off from ${parsed.data.start_date} to ${parsed.data.end_date}. Reason: ${parsed.data.reason.slice(0, 500)}`,
      entity_type: NOTIFICATION_ENTITY.ACCOUNT,
      entity_id: ctx.linkedModelId,
      actor_name: modelName,
    }).catch(() => {});
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Request failed" }, { status: 500 });
  }
}
