"use server";

import { getWeekStartYmdInAthens } from "@/lib/airtable-datetime";
import {
  modelLiveStartedAdmin,
  modelLiveStartedChatter,
  modelLiveEndedAdmin,
  modelLiveEndedChatter,
} from "@/lib/notification-copy";
import { NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import { notify } from "@/services/notification-service";
import { getModelLiveStreamById } from "@/services/model-live-streams";
import { getActiveShiftsWithModel, getChatterIdsFromOpenShiftModels } from "@/services/shifts";
import { getActiveModelUserAirtableIdByLinkedModelRecordId, listAllUsers } from "@/services/users";
import { getProgramsForWeek } from "@/services/weekly-program";
import { listAllWhales } from "@/services/whales";
import type { ModelRecord } from "@/types";

type LiveNotifyKind = "started" | "ended";

async function resolveLivePlatform(liveStreamRecordId: string, platform?: string): Promise<string> {
  const trimmed = platform?.trim();
  if (trimmed) return trimmed;
  const live = await getModelLiveStreamById(liveStreamRecordId).catch(() => null);
  return live?.platform?.trim() ?? "";
}

async function getFallbackChatterIdsForModel(modelId: string, modelRecord: ModelRecord): Promise<string[]> {
  const trimmed = modelId.trim();
  if (!trimmed) return [];

  const weekStart = getWeekStartYmdInAthens(0);
  const [users, programs, whales] = await Promise.all([
    listAllUsers().catch(() => []),
    getProgramsForWeek(weekStart).catch(() => []),
    listAllWhales().catch(() => []),
  ]);

  const activeChatterIds = new Set(
    users
      .filter((u) => u.role === "chatter" && (u.status ?? "").toLowerCase() === "active" && u.id?.trim())
      .map((u) => u.id.trim())
  );
  if (activeChatterIds.size === 0) return [];

  const candidateIds = new Set<string>();

  const currentChatter = modelRecord.current_chatter_id?.trim();
  if (currentChatter) candidateIds.add(currentChatter);

  for (const program of programs) {
    if ((program.model_ids ?? []).includes(trimmed) && program.chatter_id?.trim()) {
      candidateIds.add(program.chatter_id.trim());
    }
  }

  for (const chatterId of await getChatterIdsFromOpenShiftModels(trimmed).catch(() => [])) {
    candidateIds.add(chatterId);
  }

  for (const whale of whales) {
    if (whale.assigned_model_id === trimmed && whale.assigned_chatter_id?.trim()) {
      candidateIds.add(whale.assigned_chatter_id.trim());
    }
  }

  return [...candidateIds].filter((id) => activeChatterIds.has(id));
}

async function resolveChatterIdsForModelLive(modelRecord: ModelRecord): Promise<string[]> {
  const modelId = modelRecord.id;
  const shifts = await getActiveShiftsWithModel(modelId);
  const fromShifts = [...new Set(shifts.map((s) => s.chatter_id.trim()).filter(Boolean))];
  if (fromShifts.length > 0) return fromShifts;
  return getFallbackChatterIdsForModel(modelId, modelRecord);
}

async function notifyAdminsAndManagersModelLive(params: {
  event_type: (typeof NOTIFICATION_EVENT)[keyof typeof NOTIFICATION_EVENT];
  priority: (typeof NOTIFICATION_PRIORITY)[keyof typeof NOTIFICATION_PRIORITY];
  title: string;
  body: string;
  entity_type: string;
  entity_id: string;
  actor_user_id?: string;
  actor_name?: string;
}): Promise<void> {
  const adminUsers = await listAllUsers();
  const recipients = adminUsers.filter(
    (u) =>
      (u.role === "admin" || u.role === "manager") &&
      (u.status ?? "").toLowerCase() === "active" &&
      u.can_login === true
  );
  for (const admin of recipients) {
    await notify({
      user_id: admin.id,
      ...params,
    }).catch(() => {});
  }
}

async function notifyChattersModelLive(
  modelRecord: ModelRecord,
  liveStreamRecordId: string,
  kind: LiveNotifyKind,
  modelActorUserId: string | undefined,
  modelName: string,
  platform: string
): Promise<void> {
  const chatterIds = await resolveChatterIdsForModelLive(modelRecord);
  const chatterCopy =
    kind === "started"
      ? modelLiveStartedChatter(modelName, platform)
      : modelLiveEndedChatter(modelName, platform);
  const eventType =
    kind === "started" ? NOTIFICATION_EVENT.MODEL_LIVE_STARTED : NOTIFICATION_EVENT.MODEL_LIVE_ENDED;
  const priority = NOTIFICATION_PRIORITY.HIGH;
  const triggerSource = kind === "started" ? "live_start_chatter" : "live_end_chatter";

  for (const chatterId of chatterIds) {
    await notify({
      user_id: chatterId,
      event_type: eventType,
      priority,
      title: chatterCopy.title,
      body: chatterCopy.body,
      entity_type: "model_live_stream",
      entity_id: liveStreamRecordId,
      actor_user_id: modelActorUserId,
      actor_name: modelName,
      _triggerSource: triggerSource,
    }).catch(() => {});
  }
}

/** Admins + chatters on active shifts (or weekly-program fallback when none). */
export async function notifyModelLiveStarted(
  modelRecord: ModelRecord,
  liveStreamRecordId: string,
  platform?: string
): Promise<void> {
  const modelName = (modelRecord.model_name ?? "Model").trim() || "Model";
  const resolvedPlatform = await resolveLivePlatform(liveStreamRecordId, platform);
  const modelActorUserId =
    (await getActiveModelUserAirtableIdByLinkedModelRecordId(modelRecord.id)) ?? undefined;
  const adminCopy = modelLiveStartedAdmin(modelName, resolvedPlatform);
  await notifyAdminsAndManagersModelLive({
    event_type: NOTIFICATION_EVENT.MODEL_LIVE_STARTED,
    priority: NOTIFICATION_PRIORITY.HIGH,
    title: adminCopy.title,
    body: adminCopy.body,
    entity_type: "model_live_stream",
    entity_id: liveStreamRecordId,
    actor_user_id: modelActorUserId,
    actor_name: modelName,
  });
  await notifyChattersModelLive(
    modelRecord,
    liveStreamRecordId,
    "started",
    modelActorUserId,
    modelName,
    resolvedPlatform
  );
}

export async function notifyModelLiveEnded(
  modelRecord: ModelRecord,
  liveStreamRecordId: string,
  platform?: string
): Promise<void> {
  const modelName = (modelRecord.model_name ?? "Model").trim() || "Model";
  const resolvedPlatform = await resolveLivePlatform(liveStreamRecordId, platform);
  const modelActorUserId =
    (await getActiveModelUserAirtableIdByLinkedModelRecordId(modelRecord.id)) ?? undefined;
  const adminCopy = modelLiveEndedAdmin(modelName, resolvedPlatform);
  await notifyAdminsAndManagersModelLive({
    event_type: NOTIFICATION_EVENT.MODEL_LIVE_ENDED,
    priority: NOTIFICATION_PRIORITY.HIGH,
    title: adminCopy.title,
    body: adminCopy.body,
    entity_type: "model_live_stream",
    entity_id: liveStreamRecordId,
    actor_user_id: modelActorUserId,
    actor_name: modelName,
  });
  await notifyChattersModelLive(
    modelRecord,
    liveStreamRecordId,
    "ended",
    modelActorUserId,
    modelName,
    resolvedPlatform
  );
}
