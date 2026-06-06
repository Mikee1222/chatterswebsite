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
import {
  getUpcomingPeriod,
  logModelPeriodFromStartDate,
  markModelPeriodRecentlyLogged,
} from "@/services/model-periods";
import { sendPeriodConfirmedEarlyNotification } from "@/services/period-notifications";
import { notify, notifyAdmins } from "@/services/notification-service";
import { NOTIFICATION_ENTITY, NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import { listDistinctVaUserIdsForModel } from "@/services/va-content-assignments";
import type { ModelPeriodRecord } from "@/types";

const bodySchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(5000).optional(),
});

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
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
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const model = await getModelById(ctx.linkedModelId);
    const previousUpcoming = await getUpcomingPeriod(ctx.linkedModelId, model);
    await logModelPeriodFromStartDate(ctx.linkedModelId, parsed.data.start_date, parsed.data.notes, "model");
    markModelPeriodRecentlyLogged(ctx.linkedModelId);
    await delay(1500);
    if (previousUpcoming?.predicted_start && parsed.data.start_date < previousUpcoming.predicted_start) {
      await sendPeriodConfirmedEarlyNotification({
        modelId: ctx.linkedModelId,
        predictedDate: previousUpcoming.predicted_start,
      }).catch(() => {});
    }
    const avgCycleLength = Math.max(1, Math.round(model?.avg_cycle_length ?? 28));
    const avgPeriodLength = Math.max(1, Math.round(model?.avg_period_length ?? 5));
    /** Always set for notifications (avoids null upcoming right after write). */
    const start_date = parsed.data.start_date;
    const periodEndDate = addDays(start_date, avgPeriodLength - 1);
    const nextExpected = addDays(start_date, avgCycleLength);
    const upcoming = {
      predicted_start: nextExpected,
      predicted_end: addDays(nextExpected, avgPeriodLength - 1),
    };
    const currentPeriod: ModelPeriodRecord = {
      id: "optimistic",
      model_id: ctx.linkedModelId,
      start_date,
      end_date: periodEndDate,
      cycle_length_days: null,
      period_length_days: avgPeriodLength,
      notes: parsed.data.notes ?? "",
      logged_by: "model",
      created_at: null,
      came_early: false,
      missed_period: false,
      predicted_next_date: nextExpected,
      day_number: 1,
    };
    const modelName = (ctx.modelRecord.model_name ?? "").trim() || "Model";

    await notify({
      user_id: ctx.userRecordId,
      event_type: NOTIFICATION_EVENT.SYSTEM_ALERT,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      title: " Period logged",
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
        title: ` ${modelName} — Period started`,
        body: `${modelName}'s period started (${start_date}). Next expected: ${nextExpected}.`,
        entity_type: NOTIFICATION_ENTITY.PERIOD,
        entity_id: `period:log:va:${vaUserId}:${ctx.linkedModelId}:${start_date}`,
        _triggerSource: "model_period_log",
      }).catch(() => {});
    }

    await notifyAdmins({
      event_type: NOTIFICATION_EVENT.SYSTEM_ALERT,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      title: ` ${modelName} — Period started`,
      body: `Period started: ${start_date}. Next expected: ${nextExpected}.`,
      entity_type: NOTIFICATION_ENTITY.PERIOD,
      entity_id: `period:log:admin:${ctx.linkedModelId}:${start_date}`,
      _triggerSource: "model_period_log",
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      current_period: currentPeriod,
      predicted_next_start: upcoming.predicted_start,
      avg_cycle_length: avgCycleLength,
      avg_period_length: avgPeriodLength,
    });
  } catch {
    return NextResponse.json({ error: "Request failed" }, { status: 500 });
  }
}
