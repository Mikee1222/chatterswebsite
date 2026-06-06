"use server";

import { getTodayYmd } from "@/lib/weekly-program";
import { notify } from "@/services/notification-service";
import { findExistingNotification } from "@/services/notifications";
import { EVENT_TYPE_TO_AIRTABLE } from "@/lib/notifications-schema";
import { NOTIFICATION_ENTITY, NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import { getActiveModelUserAirtableIdByLinkedModelRecordId } from "@/services/users";
import { listAllModelss } from "@/services/modelss";
import { getUpcomingPeriod } from "@/services/model-periods";
import type { ModelRecord } from "@/types";
import { listDistinctVaUserIdsForModel } from "@/services/va-content-assignments";
import { getAdminNotificationIds } from "@/services/admin-notification-settings";

type NotifyArgs = {
  modelId: string;
  predictedDate: string;
};

function dayDiff(fromYmd: string, toYmd: string): number {
  const a = Date.parse(`${fromYmd}T12:00:00.000Z`);
  const b = Date.parse(`${toYmd}T12:00:00.000Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86400000);
}

async function notifyModelOnce(input: {
  modelId: string;
  eventType:
    | "period_3_day_reminder"| "period_predicted_day"| "period_confirmed_early"| "period_overdue"| "period_prediction_reset";
  title: string;
  body: string;
  entityId: string;
  priority?: "low" | "normal" | "high" | "critical";
}): Promise<boolean> {
  const userId = await getActiveModelUserAirtableIdByLinkedModelRecordId(input.modelId);
  if (!userId) return false;
  const eventAirtable = EVENT_TYPE_TO_AIRTABLE[input.eventType] ?? input.eventType;
  const exists = await findExistingNotification(
    userId,
    NOTIFICATION_ENTITY.PERIOD,
    input.entityId,
    eventAirtable
  ).catch(() => false);
  if (exists) return false;
  await notify({
    user_id: userId,
    event_type: input.eventType,
    priority: input.priority ?? NOTIFICATION_PRIORITY.NORMAL,
    title: input.title,
    body: input.body,
    entity_type: NOTIFICATION_ENTITY.PERIOD,
    entity_id: input.entityId,
    _triggerSource: "periodReminderCron",
  });
  return true;
}

export async function sendPeriodThreeDayReminder({ modelId, predictedDate }: NotifyArgs): Promise<boolean> {
  return notifyModelOnce({
    modelId,
    eventType: NOTIFICATION_EVENT.PERIOD_3_DAY_REMINDER,
    title: "Cycle reminder",
    body: `Your next period is predicted around ${predictedDate} (in 3 days).`,
    entityId: `period:reminder3:${predictedDate}`,
    priority: NOTIFICATION_PRIORITY.NORMAL,
  });
}

export async function sendPeriodPredictedDayNotification({ modelId, predictedDate }: NotifyArgs): Promise<boolean> {
  return notifyModelOnce({
    modelId,
    eventType: NOTIFICATION_EVENT.PERIOD_PREDICTED_DAY,
    title: "Predicted period day",
    body: `Today is your predicted period day (${predictedDate}).`,
    entityId: `period:predicted:${predictedDate}`,
    priority: NOTIFICATION_PRIORITY.HIGH,
  });
}

export async function sendPeriodConfirmedEarlyNotification({ modelId, predictedDate }: NotifyArgs): Promise<boolean> {
  return notifyModelOnce({
    modelId,
    eventType: NOTIFICATION_EVENT.PERIOD_CONFIRMED_EARLY,
    title: "Period confirmed",
    body: `Cycle updated. Period was confirmed before ${predictedDate}.`,
    entityId: `period:confirmed:${predictedDate}`,
    priority: NOTIFICATION_PRIORITY.NORMAL,
  });
}

export async function sendPeriodOverdueNotification({
  modelId,
  predictedDate,
  overdueDays,
}: NotifyArgs & { overdueDays: number }): Promise<boolean> {
  return notifyModelOnce({
    modelId,
    eventType: NOTIFICATION_EVENT.PERIOD_OVERDUE,
    title: "Period overdue",
    body: `Your period appears overdue by ${overdueDays} day${overdueDays === 1 ? "" : "s"}.`,
    entityId: `period:overdue:${predictedDate}:d${overdueDays}`,
    priority: NOTIFICATION_PRIORITY.HIGH,
  });
}

export async function sendPeriodPredictionResetNotification({
  modelId,
  previousPredictedDate,
}: {
  modelId: string;
  previousPredictedDate: string;
}): Promise<boolean> {
  return notifyModelOnce({
    modelId,
    eventType: NOTIFICATION_EVENT.PERIOD_PREDICTION_RESET,
    title: "Prediction reset",
    body: `Prediction from ${previousPredictedDate} was reset until next period log.`,
    entityId: `period:reset:${previousPredictedDate}`,
    priority: NOTIFICATION_PRIORITY.NORMAL,
  });
}

export type PeriodReminderCronResult = {
  ok: true;
  scanned: number;
  sent_three_day: number;
  sent_day_of: number;
  sent_overdue: number;
};

async function notifyPeriodCronStakeholders(model: ModelRecord, predicted: string, variant: "3d" | "day0"): Promise<void> {
  const modelName = (model.model_name ?? "").trim() || "Model";
  const eventAirtable = EVENT_TYPE_TO_AIRTABLE[NOTIFICATION_EVENT.SYSTEM_ALERT] ?? "system_alert";
  const baseEntity = `pcron:${variant}:${model.id}:${predicted}`;
  const title =
    variant === "3d" ? `⏰ ${modelName} — Period in 3 days` : ` ${modelName} — Period expected today`;
  const body =
    variant === "3d"? `Next expected start: ${predicted}.`
      : `Predicted period start: ${predicted}.`;

  const vaIds = await listDistinctVaUserIdsForModel(model.id, model.model_id);
  for (const vaUserId of vaIds) {
    const entityId = `${baseEntity}:va:${vaUserId}`;
    const exists = await findExistingNotification(vaUserId, NOTIFICATION_ENTITY.PERIOD, entityId, eventAirtable).catch(
      () => false
    );
    if (exists) continue;
    await notify({
      user_id: vaUserId,
      event_type: NOTIFICATION_EVENT.SYSTEM_ALERT,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      title,
      body,
      entity_type: NOTIFICATION_ENTITY.PERIOD,
      entity_id: entityId,
      _triggerSource: "periodReminderCron_stakeholder",
    }).catch(() => {});
  }

  const adminIds = await getAdminNotificationIds();
  for (const adminId of adminIds) {
    const entityId = `${baseEntity}:admin:${adminId}`;
    const exists = await findExistingNotification(adminId, NOTIFICATION_ENTITY.PERIOD, entityId, eventAirtable).catch(
      () => false
    );
    if (exists) continue;
    await notify({
      user_id: adminId,
      event_type: NOTIFICATION_EVENT.SYSTEM_ALERT,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      title,
      body,
      entity_type: NOTIFICATION_ENTITY.PERIOD,
      entity_id: entityId,
      _triggerSource: "periodReminderCron_stakeholder",
    }).catch(() => {});
  }
}

export async function runPeriodReminderCron(): Promise<PeriodReminderCronResult> {
  const today = getTodayYmd();
  const models = await listAllModelss();
  let sent_three_day = 0;
  let sent_day_of = 0;
  let sent_overdue = 0;

  for (const model of models) {
    if (model.period_tracking_enabled !== true) continue;
    const upcoming = await getUpcomingPeriod(model.id, model);
    const predicted = upcoming?.predicted_start ?? null;
    if (!predicted) continue;
    const delta = dayDiff(today, predicted);
    if (delta === 3) {
      if (await sendPeriodThreeDayReminder({ modelId: model.id, predictedDate: predicted })) sent_three_day += 1;
      await notifyPeriodCronStakeholders(model, predicted, "3d");
    } else if (delta === 0) {
      if (await sendPeriodPredictedDayNotification({ modelId: model.id, predictedDate: predicted })) sent_day_of += 1;
      await notifyPeriodCronStakeholders(model, predicted, "day0");
    } else if (delta < 0) {
      const overdueDays = Math.abs(delta);
      if (await sendPeriodOverdueNotification({ modelId: model.id, predictedDate: predicted, overdueDays })) sent_overdue += 1;
    }
  }

  return {
    ok: true,
    scanned: models.length,
    sent_three_day,
    sent_day_of,
    sent_overdue,
  };
}
