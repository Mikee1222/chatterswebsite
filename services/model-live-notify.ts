"use server";

import { notify, notifyAdmins } from "@/services/notification-service";
import { NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import { getActiveModelUserAirtableIdByLinkedModelRecordId } from "@/services/users";
import {
  modelLiveStartedAdmin,
  modelLiveStartedChatter,
  modelLiveEndedAdmin,
  modelLiveEndedChatter,
} from "@/lib/notification-copy";
import type { ModelRecord } from "@/types";

/** Admins + assigned chatter (when model is occupied). */
export async function notifyModelLiveStarted(modelRecord: ModelRecord, liveStreamRecordId: string): Promise<void> {
  const modelName = (modelRecord.model_name ?? "Model").trim() || "Model";
  const modelActorUserId =
    (await getActiveModelUserAirtableIdByLinkedModelRecordId(modelRecord.id)) ?? undefined;
  const adminCopy = modelLiveStartedAdmin(modelName);
  await notifyAdmins({
    event_type: NOTIFICATION_EVENT.MODEL_LIVE_STARTED,
    priority: NOTIFICATION_PRIORITY.HIGH,
    title: adminCopy.title,
    body: adminCopy.body,
    entity_type: "model_live_stream",
    entity_id: liveStreamRecordId,
    actor_user_id: modelActorUserId,
    actor_name: modelName,
  }).catch(() => {});
  const chatterId = modelRecord.current_chatter_id?.trim();
  if (chatterId) {
    const chatterCopy = modelLiveStartedChatter(modelName);
    await notify({
      user_id: chatterId,
      event_type: NOTIFICATION_EVENT.MODEL_LIVE_STARTED,
      priority: NOTIFICATION_PRIORITY.HIGH,
      title: chatterCopy.title,
      body: chatterCopy.body,
      entity_type: "model_live_stream",
      entity_id: liveStreamRecordId,
      actor_user_id: modelActorUserId,
      actor_name: modelName,
      _triggerSource: "live_start_chatter",
    }).catch(() => {});
  }
}

export async function notifyModelLiveEnded(modelRecord: ModelRecord, liveStreamRecordId: string): Promise<void> {
  const modelName = (modelRecord.model_name ?? "Model").trim() || "Model";
  const modelActorUserId =
    (await getActiveModelUserAirtableIdByLinkedModelRecordId(modelRecord.id)) ?? undefined;
  const adminCopy = modelLiveEndedAdmin(modelName);
  await notifyAdmins({
    event_type: NOTIFICATION_EVENT.MODEL_LIVE_ENDED,
    priority: NOTIFICATION_PRIORITY.NORMAL,
    title: adminCopy.title,
    body: adminCopy.body,
    entity_type: "model_live_stream",
    entity_id: liveStreamRecordId,
    actor_user_id: modelActorUserId,
    actor_name: modelName,
  }).catch(() => {});
  const chatterId = modelRecord.current_chatter_id?.trim();
  if (chatterId) {
    const chatterCopy = modelLiveEndedChatter(modelName);
    await notify({
      user_id: chatterId,
      event_type: NOTIFICATION_EVENT.MODEL_LIVE_ENDED,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      title: chatterCopy.title,
      body: chatterCopy.body,
      entity_type: "model_live_stream",
      entity_id: liveStreamRecordId,
      actor_user_id: modelActorUserId,
      actor_name: modelName,
      _triggerSource: "live_end_chatter",
    }).catch(() => {});
  }
}
