"use server";

import { getWeekStartYmdInAthens } from "@/lib/airtable-datetime";
import {
  modelLiveStartedAdmin,
  modelLiveStartedChatter,
  modelLiveEndedAdmin,
  modelLiveEndedChatter,
} from "@/lib/notification-copy";
import { NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import { notifyByRoleConfig } from "@/services/notification-service";
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

async function notifyModelLiveByRoleConfig(params: {
  kind: LiveNotifyKind;
  modelRecord: ModelRecord;
  liveStreamRecordId: string;
  platform: string;
  modelActorUserId?: string;
  modelName: string;
}): Promise<void> {
  const { kind, modelRecord, liveStreamRecordId, platform, modelActorUserId, modelName } = params;
  const eventType =
    kind === "started" ? NOTIFICATION_EVENT.MODEL_LIVE_STARTED : NOTIFICATION_EVENT.MODEL_LIVE_ENDED;
  const adminCopy =
    kind === "started"
      ? modelLiveStartedAdmin(modelName, platform)
      : modelLiveEndedAdmin(modelName, platform);
  const chatterCopy =
    kind === "started"
      ? modelLiveStartedChatter(modelName, platform)
      : modelLiveEndedChatter(modelName, platform);
  const chatterIds = await resolveChatterIdsForModelLive(modelRecord);

  await notifyByRoleConfig(eventType, {
    recipient_mode: "monitoring_only",
    priority: NOTIFICATION_PRIORITY.HIGH,
    title: adminCopy.title,
    body: adminCopy.body,
    entity_type: "model_live_stream",
    entity_id: liveStreamRecordId,
    actor_user_id: modelActorUserId,
    actor_name: modelName,
  }).catch(() => {});

  if (chatterIds.length > 0) {
    await notifyByRoleConfig(eventType, {
      recipient_mode: "personal_only",
      personal_user_ids: chatterIds,
      priority: NOTIFICATION_PRIORITY.HIGH,
      title: chatterCopy.title,
      body: chatterCopy.body,
      entity_type: "model_live_stream",
      entity_id: liveStreamRecordId,
      actor_user_id: modelActorUserId,
      actor_name: modelName,
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
  await notifyModelLiveByRoleConfig({
    kind: "started",
    modelRecord,
    liveStreamRecordId,
    platform: resolvedPlatform,
    modelActorUserId,
    modelName,
  });
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
  await notifyModelLiveByRoleConfig({
    kind: "ended",
    modelRecord,
    liveStreamRecordId,
    platform: resolvedPlatform,
    modelActorUserId,
    modelName,
  });
}
