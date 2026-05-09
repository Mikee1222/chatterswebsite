/**
 * POST /api/model/period/log
 *
 * Response JSON (model period UI):
 * - `success`: true on success
 * - `current_period`: active window from latest start + avg period length, or null
 * - `predicted_next_start`: YYYY-MM-DD from last start + cycle
 * - `avg_cycle_length` / `avg_period_length`: rolling averages on modelss after sync
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireModelApiContext } from "@/lib/model-api-auth";
import { getModelById } from "@/services/modelss";
import { getModelCycleInfoResponse, getUpcomingPeriod, logModelPeriodFromStartDate } from "@/services/model-periods";
import { sendPeriodConfirmedEarlyNotification } from "@/services/period-notifications";
import { notify, notifyAdmins } from "@/services/notification-service";
import { NOTIFICATION_ENTITY, NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import { listDistinctVaUserIdsForModel } from "@/services/va-content-assignments";

const bodySchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(5000).optional(),
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
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const model = await getModelById(ctx.linkedModelId);
    const previousUpcoming = await getUpcomingPeriod(ctx.linkedModelId, model);
    await logModelPeriodFromStartDate(ctx.linkedModelId, parsed.data.start_date, parsed.data.notes, "model");
    if (previousUpcoming?.predicted_start && parsed.data.start_date < previousUpcoming.predicted_start) {
      await sendPeriodConfirmedEarlyNotification({
        modelId: ctx.linkedModelId,
        predictedDate: previousUpcoming.predicted_start,
      }).catch(() => {});
    }
    const refreshed = await getModelById(ctx.linkedModelId);
    const upcoming = await getUpcomingPeriod(ctx.linkedModelId, refreshed);
    const nextExpected = upcoming?.predicted_start ?? "—";
    const start_date = parsed.data.start_date;
    const modelName = (ctx.modelRecord.model_name ?? "").trim() || "Model";

    await notify({
      user_id: ctx.userRecordId,
      event_type: NOTIFICATION_EVENT.SYSTEM_ALERT,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      title: "🩸 Period logged",
      body: `Your period has been logged starting ${start_date}. Next expected: ${nextExpected}.`,
      entity_type: NOTIFICATION_ENTITY.PERIOD,
      entity_id: `period:log:${ctx.linkedModelId}:${start_date}`,
      _triggerSource: "model_period_log",
    }).catch(() => {});

    const vaIds = await listDistinctVaUserIdsForModel(ctx.linkedModelId, ctx.modelRecord.model_id);
    for (const vaUserId of vaIds) {
      await notify({
        user_id: vaUserId,
        event_type: NOTIFICATION_EVENT.SYSTEM_ALERT,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: `🩸 ${modelName} — Period started`,
        body: `${modelName}'s period started (${start_date}). Next expected: ${nextExpected}.`,
        entity_type: NOTIFICATION_ENTITY.PERIOD,
        entity_id: `period:log:va:${vaUserId}:${ctx.linkedModelId}:${start_date}`,
        _triggerSource: "model_period_log",
      }).catch(() => {});
    }

    await notifyAdmins({
      event_type: NOTIFICATION_EVENT.SYSTEM_ALERT,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      title: `🩸 ${modelName} — Period started`,
      body: `Period started: ${start_date}. Next expected: ${nextExpected}.`,
      entity_type: NOTIFICATION_ENTITY.PERIOD,
      entity_id: `period:log:admin:${ctx.linkedModelId}:${start_date}`,
      _triggerSource: "model_period_log",
    }).catch(() => {});

    const cycle = await getModelCycleInfoResponse(ctx.linkedModelId);
    return NextResponse.json({ success: true, ...cycle });
  } catch {
    return NextResponse.json({ error: "Request failed" }, { status: 500 });
  }
}
