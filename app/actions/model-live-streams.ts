"use server";

import { revalidatePath } from "next/cache";
import { getModelContext } from "@/lib/model-context-server";
import {
  createModelLiveStream,
  updateModelLiveStream,
  getModelLiveStreamById,
  getActiveLiveStreamForModel,
} from "@/services/model-live-streams";
import { getModelById } from "@/services/modelss";
import { ROUTES } from "@/lib/routes";
import { isModelLiveStreamPlatform, modelLiveStreamPlatformLabel } from "@/lib/airtable-options";
import { formatDurationMinutes } from "@/lib/format";
import { notifyAdmins, notify } from "@/services/notification-service";
import {
  modelLiveStartedAdmin,
  modelLiveStartedChatter,
  modelLiveEndedAdmin,
  modelLiveEndedChatter,
} from "@/lib/notification-copy";
import { broadcastRealtimeToAll } from "@/lib/realtime-broadcast";

export type StartLiveResult = { success: true; liveStreamId: string } | { success: false; error: string };
export type EndLiveResult = { success: true } | { success: false; error: string };

/** Model starts a live stream manually (like shift start). Records actual_start and status in_progress. Notifies all users. */
export async function startLiveAction(params: {
  platform: string;
  plannedDurationMinutes?: number | null;
  title?: string | null;
  notes?: string | null;
}): Promise<StartLiveResult> {
  const { linkedModelId, modelRecord } = await getModelContext();
  if (!linkedModelId) return { success: false, error: "Model account not linked." };

  const active = await getActiveLiveStreamForModel(linkedModelId);
  if (active) return { success: false, error: "You already have a live in progress. End it first." };

  const platform = (params.platform ?? "").trim();
  if (!platform) return { success: false, error: "Platform is required." };
  if (!isModelLiveStreamPlatform(platform)) {
    return { success: false, error: "Invalid platform. Choose OnlyFans, Instagram, TikTok, or Other." };
  }

  const now = new Date();
  const dateYmd = now.toISOString().slice(0, 10);
  const actualStartIso = now.toISOString();

  let plannedEndIso: string | null = null;
  if (params.plannedDurationMinutes != null && params.plannedDurationMinutes > 0) {
    const end = new Date(now.getTime() + params.plannedDurationMinutes * 60 * 1000);
    plannedEndIso = end.toISOString();
  }

  const details = [params.title?.trim(), params.notes?.trim()].filter(Boolean).join("\n\n") || undefined;

  try {
    const created = await createModelLiveStream({
      model_id: linkedModelId,
      date: dateYmd,
      planned_start: actualStartIso,
      planned_end: plannedEndIso,
      actual_start: actualStartIso,
      platform,
      status: "in_progress",
      details,
      details_en: details ?? undefined,
    });

    const modelName = modelRecord?.model_name?.trim() || "A model";
    const platformLabel = modelLiveStreamPlatformLabel(platform);
    const durationMinutes = params.plannedDurationMinutes ?? 0;
    const titleLine = params.title?.trim() || undefined;
    const adminCopy = modelLiveStartedAdmin(modelName);
    const chatterCopy = modelLiveStartedChatter(modelName);

    const baseNotifyFields = {
      event_type: "model_live_started" as const,
      entity_type: "model_live_stream" as const,
      entity_id: created.id,
      metadata: [
        { label: "Model", value: modelName },
        { label: "Platform", value: platformLabel },
        ...(durationMinutes > 0 ? [{ label: "Expected duration", value: formatDurationMinutes(durationMinutes) }] : []),
        ...(titleLine ? [{ label: "Title", value: titleLine }] : []),
      ],
    };

    const LIVE_NOTIF = "[live-notif]";
    const freshModel = await getModelById(linkedModelId);
    const chatterUserId = freshModel?.current_chatter_id?.trim() ?? null;
    console.log(LIVE_NOTIF, "live_start recipient_resolution", JSON.stringify({
      event: "model_live_started",
      model_id: linkedModelId,
      admin_will_notify: true,
      chatter_user_id: chatterUserId ?? "none",
    }));
    await notifyAdmins({ ...baseNotifyFields, ...adminCopy }).catch((err) => {
      console.error(LIVE_NOTIF, "live_start notifyAdmins failed", err instanceof Error ? err.message : String(err));
    });
    if (chatterUserId) {
      await notify({
        ...baseNotifyFields,
        ...chatterCopy,
        user_id: chatterUserId,
        _triggerSource: "live_start_chatter",
      }).catch((err) => {
        console.error(LIVE_NOTIF, "live_start notify chatter failed", JSON.stringify({ chatter_user_id: chatterUserId, error: err instanceof Error ? err.message : String(err) }));
      });
    }

    await broadcastRealtimeToAll({
      type: "model_live_started",
      model_id: linkedModelId,
      live_stream_id: created.id,
      platform,
      model_name: modelName,
    }).catch(() => {});

    revalidatePath(ROUTES.model.liveStreams);
    revalidatePath(ROUTES.model.home);
    revalidatePath(ROUTES.model.schedule);
    return { success: true, liveStreamId: created.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

/** Model ends the current live stream. Records actual_end and status completed. Notifies all users. */
export async function endLiveAction(liveStreamRecordId: string): Promise<EndLiveResult> {
  const { linkedModelId } = await getModelContext();
  if (!linkedModelId) return { success: false, error: "Model account not linked." };

  const stream = await getModelLiveStreamById(liveStreamRecordId);
  if (!stream) return { success: false, error: "Live stream not found." };
  if (stream.model_id !== linkedModelId) return { success: false, error: "Not your live stream." };
  if (stream.actual_end) return { success: false, error: "This live is already ended." };

  const nowIso = new Date().toISOString();

  try {
    await updateModelLiveStream(liveStreamRecordId, {
      actual_end: nowIso,
      status: "completed",
    });

    const model = await getModelById(stream.model_id);
    const modelName = model?.model_name?.trim() || "A model";
    const platformLabel = modelLiveStreamPlatformLabel(stream.platform);

    let durationMeta: { label: string; value: string } | null = null;
    if (stream.actual_start) {
      const startMs = new Date(stream.actual_start).getTime();
      const endMs = new Date(nowIso).getTime();
      const minutes = Math.round((endMs - startMs) / 60000);
      if (minutes >= 0) durationMeta = { label: "Actual duration", value: formatDurationMinutes(minutes) };
    }

    const adminCopy = modelLiveEndedAdmin(modelName);
    const chatterCopy = modelLiveEndedChatter(modelName);

    const baseNotifyFields = {
      event_type: "model_live_ended" as const,
      entity_type: "model_live_stream" as const,
      entity_id: liveStreamRecordId,
      metadata: [
        { label: "Model", value: modelName },
        { label: "Platform", value: platformLabel },
        ...(durationMeta ? [durationMeta] : []),
      ],
    };

    const LIVE_NOTIF = "[live-notif]";
    const chatterUserId = model?.current_chatter_id?.trim() ?? null;
    console.log(LIVE_NOTIF, "live_end recipient_resolution", JSON.stringify({
      event: "model_live_ended",
      model_id: stream.model_id,
      admin_will_notify: true,
      chatter_user_id: chatterUserId ?? "none",
    }));
    await notifyAdmins({ ...baseNotifyFields, ...adminCopy }).catch((err) => {
      console.error(LIVE_NOTIF, "live_end notifyAdmins failed", err instanceof Error ? err.message : String(err));
    });
    if (chatterUserId) {
      await notify({
        ...baseNotifyFields,
        ...chatterCopy,
        user_id: chatterUserId,
        _triggerSource: "live_end_chatter",
      }).catch((err) => {
        console.error(LIVE_NOTIF, "live_end notify chatter failed", JSON.stringify({ chatter_user_id: chatterUserId, error: err instanceof Error ? err.message : String(err) }));
      });
    }

    await broadcastRealtimeToAll({
      type: "model_live_ended",
      model_id: linkedModelId,
      live_stream_id: liveStreamRecordId,
      platform: stream.platform,
      model_name: modelName,
    }).catch(() => {});

    revalidatePath(ROUTES.model.liveStreams);
    revalidatePath(ROUTES.model.home);
    revalidatePath(ROUTES.model.schedule);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
