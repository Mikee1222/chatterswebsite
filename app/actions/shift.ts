"use server";

import { revalidatePath } from "next/cache";

/** Next.js redirect() throws; don't treat it as a real error. Re-throw so redirect can complete. */
function isRedirectError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    String((err as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
  );
}
import {
  createShift,
  updateShift,
  getShiftById,
  listShiftModels,
  getActiveShiftByChatter,
  getActiveShiftByStaff,
  createShiftModel,
  updateShiftModel,
} from "@/services/shifts";
import { getUserByAirtableId } from "@/services/users";
import { updateModel, getModelById } from "@/services/modelss";
import { batchCreateRecords, batchUpdateRecords, deleteRecord, listRecords } from "@/lib/airtable-server";
import { ROUTES } from "@/lib/routes";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { createActivityLog } from "@/services/activity-logs";
import { notify, notifyAdmins, notifyByRoleConfig } from "@/services/notification-service";
import { awardShiftEndPoints } from "@/services/points-engine";

const MAX_BREAK_MINUTES_PER_SHIFT = 45;

const MODELSS_TABLE = "modelss";
const SHIFT_MODELS_TABLE = "shift_models";

/** Fewer Airtable reads than N×getRecord; chunked OR(RECORD_ID()…) stays under formula size limits. */
async function fetchFreeModelsByRecordIds(recordIds: string[]): Promise<Map<string, { model_name: string }>> {
  const out = new Map<string, { model_name: string }>();
  const unique = [...new Set(recordIds.filter((id) => id?.trim()))];
  const chunkSize = 25;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const escaped = chunk.map((id) => id.replace(/"/g, '""'));
    const orClause =
      chunk.length === 1
        ? `RECORD_ID()="${escaped[0]}"`
        : `OR(${escaped.map((id) => `RECORD_ID()="${id}"`).join(",")})`;
    const formula = `AND(${orClause}, {current_status}="free")`;
    const { records } = await listRecords<{ model_name?: string }>(MODELSS_TABLE, {
      filterByFormula: formula,
      fields: ["model_name", "current_status"],
      pageSize: 100,
      _caller: "shift.fetchFreeModelsByRecordIds",
    });
    for (const r of records) {
      out.set(r.id, { model_name: typeof r.fields?.model_name === "string" ? r.fields.model_name : "" });
    }
  }
  return out;
}
import { broadcastRealtimeToAll } from "@/lib/realtime-broadcast";
import { NOTIFICATION_EVENT, NOTIFICATION_ENTITY, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import {
  shiftStartedSelf,
  shiftCompletedSelf,
  breakStartedSelf,
  breakStartedAdmin,
  breakEndedSelf,
  breakEndedAdmin,
  taskShiftStartedAdmin,
  taskShiftEndedAdmin,
} from "@/lib/notification-copy";
import { devLog } from "@/lib/dev-log";
import { formatTimeAthens } from "@/lib/format";
import { listShiftQueueWaitingForShift, updateShiftQueueRecord } from "@/services/shift-queue";

export type StartShiftResult = { success: true; shiftId: string } | { success: false; error: string };

/** Create shift only after model selection. One active shift per chatter. Returns structured result; client handles navigation. */
export async function startShiftWithModels(
  chatterRecordId: string,
  chatterName: string,
  modelRecordIds: string[],
  options?: { suppressNotifications?: boolean }
): Promise<StartShiftResult> {
  try {
    if (!chatterRecordId?.trim()) {
      console.warn("[startShiftWithModels] validation: chatterRecordId missing");
      return { success: false, error: "User session missing. Please log in again." };
    }
    if (!Array.isArray(modelRecordIds) || modelRecordIds.length === 0) {
      return { success: false, error: "Select at least one model to start a shift." };
    }
    const existing = await getActiveShiftByChatter(chatterRecordId);
    if (existing) {
      devLog("[startShiftWithModels] already has active shift", { shiftId: existing.id });
      return { success: false, error: "You already have an active shift. Use the dashboard to add models or end it." };
    }

    let chatterUserFetched: Awaited<ReturnType<typeof getUserByAirtableId>> = null;
    try {
      chatterUserFetched = await getUserByAirtableId(chatterRecordId);
    } catch (fetchErr) {
      devLog(
        "[startShiftWithModels] chatter user fetch threw",
        JSON.stringify({
          chatterRecordId,
          error: fetchErr instanceof Error ? fetchErr.message : String(fetchErr),
        })
      );
    }
    devLog(
      "[startShiftWithModels] chatter user record (from users table by chatterRecordId)",
      JSON.stringify(
        chatterUserFetched
          ? {
              full_name: chatterUserFetched.full_name,
              airtable_record_id: chatterUserFetched.id,
              role: chatterUserFetched.role,
              email: chatterUserFetched.email,
              status: chatterUserFetched.status,
            }
          : {
              fetched: null,
              lookupId: chatterRecordId,
              note: "getUserByAirtableId returned null or fetch failed — compare to session id passed from client",
            }
      )
    );

    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const startTime = now.toISOString();
    const shiftId = `shift_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    devLog("[startShiftWithModels] creating shift with", {
      chatterRecordId,
      chatterLinkedValue: [chatterRecordId],
      chatter_name: chatterName,
    });
    const created = await createShift({
      shift_id: shiftId,
      chatter: [chatterRecordId],
      chatter_name: chatterName,
      date,
      start_time: startTime,
      status: "active",
      break_minutes: 0,
      staff_role: "chatter",
    });
    const nowStr = now.toISOString();
    const freeById = await fetchFreeModelsByRecordIds(modelRecordIds);
    const eligible: { modelRecordId: string; model_name: string }[] = [];
    const seen = new Set<string>();
    for (const modelRecordId of modelRecordIds) {
      if (!modelRecordId?.trim() || seen.has(modelRecordId)) continue;
      const row = freeById.get(modelRecordId);
      if (!row) continue;
      seen.add(modelRecordId);
      eligible.push({ modelRecordId, model_name: row.model_name });
    }
    const modelNames = eligible.map((e) => e.model_name).filter(Boolean);

    if (eligible.length > 0) {
      await batchCreateRecords(
        SHIFT_MODELS_TABLE,
        eligible.map((e) => ({
          shift: [created.id],
          model: [e.modelRecordId],
          model_name: e.model_name,
          chatter: [chatterRecordId],
          chatter_name: chatterName,
          entered_at: nowStr,
          status: "active",
        }))
      );
      await batchUpdateRecords(
        MODELSS_TABLE,
        eligible.map((e) => ({
          id: e.modelRecordId,
          fields: {
            current_status: "occupied",
            current_chatter: [chatterRecordId],
            current_chatter_name: chatterName,
            current_shift_id: created.id,
            entered_at: nowStr,
          },
        }))
      );
      for (const e of eligible) {
        await broadcastRealtimeToAll({ type: "model_status_changed", model_id: e.modelRecordId, status: "occupied" }).catch(() => {});
      }
    }
    devLog("[startShiftWithModels] created shift", {
      shiftId: created.id,
      start_time: startTime,
      modelsAttached: modelNames.length,
    });
    await broadcastRealtimeToAll({ type: "shift_started", chatter_id: chatterRecordId, shift_id: created.id }).catch(() => {});
    revalidatePath(ROUTES.chatter.shift);

    if (!options?.suppressNotifications) {
      const selfCopy = shiftStartedSelf(startTime, modelNames);
      try {
        await notifyByRoleConfig(NOTIFICATION_EVENT.SHIFT_STARTED, {
          priority: NOTIFICATION_PRIORITY.NORMAL,
          title: selfCopy.title,
          body: selfCopy.body,
          entity_type: NOTIFICATION_ENTITY.SHIFT,
          entity_id: created.id,
          actor_user_id: chatterRecordId,
          actor_name: chatterName,
          personal_user_id: chatterRecordId,
          context: {
            startTime,
            modelNames,
          },
        });
      } catch (e) {
        console.error("[notify] shift_started failed", e);
      }
      if (modelNames.length === 0) {
        try {
          await notifyByRoleConfig(NOTIFICATION_EVENT.CHATTER_NO_MODELS, {
            priority: NOTIFICATION_PRIORITY.HIGH,
            title: "⚠️ Shift started with no models",
            body: "⚠️ You're on shift but no models are attached yet. Add models from the shift page.",
            entity_type: NOTIFICATION_ENTITY.SHIFT,
            entity_id: created.id,
            actor_user_id: chatterRecordId,
            actor_name: chatterName,
            personal_user_id: chatterRecordId,
            context: { chatterName },
          });
        } catch (e) {
          console.error("[notify] chatter_no_models failed", e);
        }
      }
    }

    return { success: true, shiftId: created.id };
  } catch (err) {
    if (isRedirectError(err)) throw err;
    const message = err instanceof Error ? err.message : String(err);
    console.error("[startShiftWithModels] error", err);
    return { success: false, error: message };
  }
}

export type AddModelToShiftResult = { success: true } | { success: false; error: string };

/** Attach one model to the existing active shift. Fails if model already in shift or occupied by another chatter. */
export async function addModelToShift(params: {
  shiftRecordId: string;
  modelRecordId: string;
  modelName: string;
  chatterRecordId: string;
  chatterName: string;
}): Promise<AddModelToShiftResult> {
  try {
    const existing = await listShiftModels(params.shiftRecordId);
    const alreadyAttached = existing.some((sm) => sm.model_id === params.modelRecordId && !sm.left_at);
    if (alreadyAttached) {
      return { success: false, error: "This model is already in your shift." };
    }
    const model = await getModelById(params.modelRecordId);
    if (!model) {
      return { success: false, error: "Model not found." };
    }
    if (model.current_status !== "free") {
      return { success: false, error: "Model is not available (occupied by another chatter)." };
    }
    const now = new Date().toISOString();
    let createdShiftModel: Awaited<ReturnType<typeof createShiftModel>> | null = null;
    try {
      createdShiftModel = await createShiftModel({
        shift: [params.shiftRecordId],
        model: [params.modelRecordId],
        model_name: params.modelName,
        chatter: [params.chatterRecordId],
        chatter_name: params.chatterName,
        entered_at: now,
        status: "active",
      });
    } catch (e) {
      console.error("[addModelToShift] failed to create shift_model row:", e);
      return { success: false, error: "Failed to add model. Please try again." };
    }
    try {
      await updateModel(params.modelRecordId, {
        current_status: "occupied",
        current_chatter: [params.chatterRecordId],
        current_chatter_name: params.chatterName,
        current_shift_id: params.shiftRecordId,
        entered_at: now,
      });
    } catch (e) {
      console.error("[addModelToShift] model status update failed — rolling back shift_model row:", e);
      try {
        if (createdShiftModel?.id) {
          await updateShiftModel(createdShiftModel.id, { left_at: now, status: "left" });
        }
        console.log("[addModelToShift] rollback successful");
      } catch (rollbackErr) {
        console.error("[addModelToShift] ROLLBACK FAILED — orphaned row may exist:", rollbackErr);
      }
      return { success: false, error: "Failed to update model status. Please try again." };
    }
    devLog("[addModelToShift] attached model", { modelRecordId: params.modelRecordId, modelName: params.modelName });
    revalidatePath(ROUTES.chatter.shift);
    try {
      const { getActiveModelUserAirtableIdByLinkedModelRecordId } = await import("@/services/users");
      const modelUserId = await getActiveModelUserAirtableIdByLinkedModelRecordId(params.modelRecordId).catch(
        () => null
      );
      const personalIds = [params.chatterRecordId, modelUserId].filter((id): id is string => !!id);
      await notifyByRoleConfig(NOTIFICATION_EVENT.MODEL_TAKEN, {
        personal_user_id: personalIds,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: "🟢 Model Added to Shift",
        body: params.modelName.trim()
          ? `🟢 You're now chatting with ${params.modelName.trim()}.`
          : "🟢 A model was added to your shift.",
        entity_type: "model",
        entity_id: params.modelRecordId,
        actor_user_id: params.chatterRecordId,
        actor_name: params.chatterName,
        context: { modelName: params.modelName, chatterName: params.chatterName },
      });
    } catch (e) {
      console.error("[notify] addModelToShift failed", e);
    }
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[addModelToShift] error", err);
    return { success: false, error: message };
  }
}

export type BulkAddModelsToShiftResult =
  | { success: true; added: number }
  | { success: false; error: string };

/**
 * Attach multiple free models to an active chatter shift in one round-trip (batch Airtable writes + single revalidate).
 * Fails atomically before any write if any model is missing, already on shift, or not free.
 */
export async function bulkAddModelsToShift(params: {
  shiftRecordId: string;
  items: { modelRecordId: string; modelName: string }[];
  chatterRecordId: string;
  chatterName: string;
  /** When true, skip the in-app push for models added (e.g. shift-queue auto-attach sends its own copy). */
  skipNotification?: boolean;
}): Promise<BulkAddModelsToShiftResult> {
  try {
    const { shiftRecordId, chatterRecordId, chatterName } = params;
    const deduped: { modelRecordId: string; modelName: string }[] = [];
    const seen = new Set<string>();
    for (const it of params.items) {
      const id = it.modelRecordId?.trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      deduped.push({ modelRecordId: id, modelName: (it.modelName ?? "").trim() });
    }
    if (deduped.length === 0) {
      return { success: false, error: "Select at least one model." };
    }

    const existing = await listShiftModels(shiftRecordId);
    const attachedIds = new Set(
      existing
        .filter((sm) => !sm.left_at)
        .map((sm) => sm.model_id)
        .filter(Boolean)
    );

    const eligible: { modelRecordId: string; modelName: string }[] = [];
    for (const it of deduped) {
      if (attachedIds.has(it.modelRecordId)) {
        return {
          success: false,
          error: `${it.modelName || "A model"} is already on this shift.`,
        };
      }
      const model = await getModelById(it.modelRecordId);
      if (!model) {
        return { success: false, error: "Model not found." };
      }
      if (model.current_status !== "free") {
        const label = (it.modelName || model.model_name || "Model").trim();
        return {
          success: false,
          error: `${label} is not available (occupied by another chatter).`,
        };
      }
      eligible.push({
        modelRecordId: it.modelRecordId,
        modelName: ((it.modelName || model.model_name) ?? "").trim() || "Model",
      });
      attachedIds.add(it.modelRecordId);
    }

    const now = new Date().toISOString();
    let createdRecords: { id: string }[] = [];
    try {
      createdRecords = await batchCreateRecords(
        SHIFT_MODELS_TABLE,
        eligible.map((e) => ({
          shift: [shiftRecordId],
          model: [e.modelRecordId],
          model_name: e.modelName,
          chatter: [chatterRecordId],
          chatter_name: chatterName,
          entered_at: now,
          status: "active",
        }))
      );
    } catch (e) {
      console.error("[bulkAddModelsToShift] failed to create shift_model rows:", e);
      return { success: false, error: "Failed to add models. Please try again." };
    }
    try {
      await batchUpdateRecords(
        MODELSS_TABLE,
        eligible.map((e) => ({
          id: e.modelRecordId,
          fields: {
            current_status: "occupied",
            current_chatter: [chatterRecordId],
            current_chatter_name: chatterName,
            current_shift_id: shiftRecordId,
            entered_at: now,
          },
        }))
      );
    } catch (e) {
      console.error("[bulkAddModelsToShift] model status update failed — rolling back shift_model rows:", e);
      try {
        await batchUpdateRecords(
          SHIFT_MODELS_TABLE,
          createdRecords.map((r) => ({
            id: r.id,
            fields: { left_at: now, status: "left" },
          }))
        );
        console.log("[bulkAddModelsToShift] rollback successful");
      } catch (rollbackErr) {
        console.error("[bulkAddModelsToShift] ROLLBACK FAILED — orphaned rows may exist:", rollbackErr);
      }
      return { success: false, error: "Failed to update model status. Please try again." };
    }
    for (const e of eligible) {
      await broadcastRealtimeToAll({
        type: "model_status_changed",
        model_id: e.modelRecordId,
        status: "occupied",
      }).catch(() => {});
    }

    devLog("[bulkAddModelsToShift] attached", { count: eligible.length, shiftRecordId });
    revalidatePath(ROUTES.chatter.shift);

    if (!params.skipNotification) {
      const names = eligible.map((e) => e.modelName).filter(Boolean);
      const body =
        eligible.length === 1
          ? names[0]
            ? `You're now chatting with ${names[0]}.`
            : "A model was added to your shift.": `${eligible.length} models were added to your shift.`;

      try {
        const { getActiveModelUserAirtableIdByLinkedModelRecordId } = await import("@/services/users");
        const modelUserIds = await Promise.all(
          eligible.map((e) =>
            getActiveModelUserAirtableIdByLinkedModelRecordId(e.modelRecordId).catch(() => null)
          )
        );
        const personalIds = [
          chatterRecordId,
          ...modelUserIds.filter((id): id is string => !!id),
        ];
        await notifyByRoleConfig(NOTIFICATION_EVENT.MODEL_TAKEN, {
          personal_user_id: personalIds,
          priority: NOTIFICATION_PRIORITY.NORMAL,
          title: eligible.length === 1 ? "Model added to shift" : "Models added to shift",
          body,
          entity_type: "model",
          entity_id: eligible[0]?.modelRecordId ?? shiftRecordId,
          actor_user_id: chatterRecordId,
          actor_name: chatterName,
          context: { chatterName },
        });
      } catch (e) {
        console.error("[notify] bulkAddModelsToShift failed", e);
      }
    }

    return { success: true, added: eligible.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[bulkAddModelsToShift] error", err);
    return { success: false, error: message };
  }
}

export type RemoveModelFromShiftResult = { success: true; shiftEnded: boolean } | { success: false; error: string };

/**
 * Remove a model from the current shift. Resolves the `shift_models` row from shift + model,
 * sets `left_at`, and sets the model back to free. If no active models remain, ends the shift.
 */
export async function removeModelFromShift(
  shiftRecordId: string,
  modelRecordId: string
): Promise<RemoveModelFromShiftResult> {
  try {
    devLog("[removeModel] called", { shiftId: shiftRecordId, modelRecordId });
    if (!shiftRecordId?.trim() || !modelRecordId?.trim()) {
      return { success: false, error: "Missing shift or model." };
    }

    const models = await listShiftModels(shiftRecordId);
    const attachment = models.find((m) => m.model_id === modelRecordId && !m.left_at);
    if (!attachment) {
      devLog("[removeModel] no active shift_model row", { shiftRecordId, modelRecordId });
      return { success: false, error: "This model is not on this shift anymore." };
    }

    const shiftModelRecordId = attachment.id;
    const now = new Date().toISOString();
    const model = await getModelById(modelRecordId);
    await updateShiftModel(shiftModelRecordId, { left_at: now });

    const chatterIdForNotify = (attachment.chatter_id ?? "").trim();
    const modelLabel = (attachment.model_name ?? "").trim() || "Model";

    await updateModel(modelRecordId, {
      current_status: "free",
      current_chatter: [],
      current_chatter_name: "",
      current_shift_id: "",
      last_chatter: model?.current_chatter_id ? [model.current_chatter_id] : [],
      last_chatter_name: model?.current_chatter_name ?? "",
      last_exit_at: now,
    });

    const remaining = await listShiftModels(shiftRecordId);
    const activeRemaining = remaining.filter((sm) => !sm.left_at);
    if (activeRemaining.length === 0) {
      await updateShift(shiftRecordId, { end_time: now, status: "completed" });
      const endedShift = await getShiftById(shiftRecordId);
      const endedModels = await listShiftModels(shiftRecordId);
      const endedModelNames = endedModels.map((sm) => sm.model_name).filter(Boolean);
      devLog("[removeModelFromShift] last model removed, shift auto-ended", { shiftId: shiftRecordId });
      revalidatePath(ROUTES.chatter.shift);
      if (endedShift?.chatter_id) {
        const selfCopy = shiftCompletedSelf(now, endedModelNames, endedShift.worked_minutes ?? undefined);
        try {
          await notifyByRoleConfig(NOTIFICATION_EVENT.SHIFT_ENDED, {
            priority: NOTIFICATION_PRIORITY.NORMAL,
            title: selfCopy.title,
            body: selfCopy.body,
            entity_type: NOTIFICATION_ENTITY.SHIFT,
            entity_id: shiftRecordId,
            actor_user_id: endedShift.chatter_id,
            actor_name: endedShift.chatter_name ?? undefined,
            personal_user_id: endedShift.chatter_id,
            context: {
              endTime: now,
              modelNames: endedModelNames,
              workedMinutes: endedShift.worked_minutes ?? undefined,
            },
          });
        } catch (e) {
          console.error("[notify] removeModelFromShift shift_ended failed", e);
        }
      }
      return { success: true, shiftEnded: true };
    }
    revalidatePath(ROUTES.chatter.shift);
    if (chatterIdForNotify) {
      try {
        await notifyByRoleConfig(NOTIFICATION_EVENT.MODEL_BECAME_FREE, {
          priority: NOTIFICATION_PRIORITY.NORMAL,
          title: "🔒 Model Removed from Shift",
          body: `🔒 ${modelLabel} is off your shift.`,
          entity_type: "model",
          entity_id: modelRecordId,
          actor_user_id: chatterIdForNotify,
          actor_name: attachment.chatter_name ?? undefined,
          personal_user_id: chatterIdForNotify,
          context: { modelName: modelLabel, chatterName: attachment.chatter_name ?? undefined },
        });
      } catch (e) {
        console.error("[notify] removeModelFromShift model_became_free failed", e);
      }
    }
    return { success: true, shiftEnded: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[removeModelFromShift] error", err);
    return { success: false, error: message };
  }
}

export type StartBreakResult = { success: true } | { success: false; error: string };

const ALLOWED_BREAK_REMINDER_MINUTES = new Set([5, 10, 15, 20, 30]);

/**
 * Start break: records break_started_at and optional `break_reminder_at` for cron push.
 * Blocks if this shift has already used 45+ credited break minutes.
 */
export async function startBreak(
  shiftRecordId: string,
  reminderMinutes?: number | null
): Promise<StartBreakResult> {
  const before = await getShiftById(shiftRecordId);
  if (!before) {
    return { success: false, error: "Shift not found." };
  }
  if (before.status === "on_break" || before.break_started_at) {
    console.warn("[startBreak] already on break:", shiftRecordId);
    return { success: false, error: "Already on break" };
  }
  if (before.status !== "active") {
    return { success: false, error: "You can only start a break while your shift is active." };
  }
  const used = before.break_minutes ?? 0;
  if (used >= MAX_BREAK_MINUTES_PER_SHIFT) {
    return { success: false, error: "You have used all your break time for this shift (45 min max)" };
  }
  const breakStartedIso = new Date().toISOString();
  let breakReminderAt = "";
  if (
    reminderMinutes != null &&
    typeof reminderMinutes === "number" &&
    ALLOWED_BREAK_REMINDER_MINUTES.has(reminderMinutes)
  ) {
    breakReminderAt = new Date(Date.now() + reminderMinutes * 60 * 1000).toISOString();
  }
  await updateShift(shiftRecordId, {
    status: "on_break",
    break_started_at: breakStartedIso,
    break_reminder_at: breakReminderAt,
  });
  devLog("[break-reminder] set", {
    shiftId: shiftRecordId,
    reminderAt: breakReminderAt,
    reminderMins: reminderMinutes ?? null,
  });
  const shift = await getShiftById(shiftRecordId);
  revalidatePath(ROUTES.chatter.shift);
  revalidatePath(ROUTES.va.shift);
  if (shift?.chatter_id) {
    const breakStartedAt = shift.break_started_at ?? new Date().toISOString();
    const selfCopy = breakStartedSelf();
    const adminCopy = breakStartedAdmin(shift.chatter_name ?? "Staff", breakStartedAt);
    try {
      await notify({
        user_id: shift.chatter_id,
        event_type: NOTIFICATION_EVENT.BREAK_STARTED,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: selfCopy.title,
        body: selfCopy.body,
        entity_type: NOTIFICATION_ENTITY.SHIFT,
        entity_id: shiftRecordId,
      });
    } catch (e) {
      console.error("[notify] startBreak notify failed", e);
    }
    try {
      await notifyAdmins({
        event_type: NOTIFICATION_EVENT.BREAK_STARTED,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: adminCopy.title,
        body: adminCopy.body,
        entity_type: NOTIFICATION_ENTITY.SHIFT,
        entity_id: shiftRecordId,
        actor_user_id: shift.chatter_id,
        actor_name: shift.chatter_name ?? undefined,
      });
    } catch (e) {
      console.error("[notify] startBreak notifyAdmins failed", e);
    }
  }
  return { success: true };
}

export type EndBreakResult = { success: true } | { success: false; error: string };

export async function endBreak(shiftRecordId: string, additionalBreakMinutes: number): Promise<EndBreakResult> {
  const shiftBefore = await getShiftById(shiftRecordId);

  if (!shiftBefore || shiftBefore.status !== "on_break") {
    console.warn("[endBreak] shift is not on_break — already ended or invalid:", shiftRecordId);
    return { success: false, error: "Break already ended" };
  }

  if (!shiftBefore.break_started_at) {
    console.warn("[endBreak] no break_started_at — already ended:", shiftRecordId);
    return { success: false, error: "Break already ended" };
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const startMs = new Date(shiftBefore.break_started_at).getTime();
  const fallbackMinutes = Number.isFinite(additionalBreakMinutes) ? additionalBreakMinutes : 1;
  const segmentMinutes = Number.isNaN(startMs)
    ? Math.max(1, fallbackMinutes)
    : Math.max(1, Math.ceil((now.getTime() - startMs) / 60000));
  const currentBreak = shiftBefore.break_minutes ?? 0;
  const newBreakTotal = Math.min(currentBreak + segmentMinutes, MAX_BREAK_MINUTES_PER_SHIFT);
  await updateShift(shiftRecordId, {
    break_minutes: newBreakTotal,
    status: "active",
    break_started_at: "",
    break_reminder_at: "",
  });
  const shift = await getShiftById(shiftRecordId);
  revalidatePath(ROUTES.chatter.shift);
  revalidatePath(ROUTES.va.shift);
  if (shift?.chatter_id) {
    const selfCopy = breakEndedSelf();
    const adminCopy = breakEndedAdmin(shift.chatter_name ?? "Staff", nowIso, segmentMinutes);
    try {
      await notify({
        user_id: shift.chatter_id,
        event_type: NOTIFICATION_EVENT.BREAK_ENDED,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: selfCopy.title,
        body: selfCopy.body,
        entity_type: NOTIFICATION_ENTITY.SHIFT,
        entity_id: shiftRecordId,
      });
    } catch (e) {
      console.error("[notify] endBreak notify failed", e);
    }
    try {
      await notifyAdmins({
        event_type: NOTIFICATION_EVENT.BREAK_ENDED,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: adminCopy.title,
        body: adminCopy.body,
        entity_type: NOTIFICATION_ENTITY.SHIFT,
        entity_id: shiftRecordId,
        actor_user_id: shift.chatter_id,
        actor_name: shift.chatter_name ?? undefined,
      });
    } catch (e) {
      console.error("[notify] endBreak notifyAdmins failed", e);
    }
  }
  return { success: true };
}

/**
 * After a chatter shift ends, process `shift_queue` rows waiting on this shift id:
 * - `add_models`: attach selected free models to `target_shift_id` (no FIFO mutual exclusion).
 * - `full_start`: FIFO — first successful `startShiftWithModels` wins; other waiting rows for this shift expire.
 */
async function processShiftQueueAfterShiftEnd(endedShiftId: string): Promise<void> {
  try {
    const shiftMeta = await getShiftById(endedShiftId);
    if (!shiftMeta || shiftMeta.staff_role !== "chatter") return;

    const queue = await listShiftQueueWaitingForShift(endedShiftId);
    if (queue.length === 0) return;

    let startedOneFullStart = false;
    const nowIso = new Date().toISOString();

    for (const entry of queue) {
      const modelIds = entry.selected_model_ids.filter(Boolean);
      if (modelIds.length === 0) {
        await updateShiftQueueRecord(entry.id, { status: "expired", cancelled_at: nowIso }).catch(() => {});
        continue;
      }

      const queueType = entry.queue_type ?? "full_start";
      const targetShiftId = entry.target_shift_id?.trim() ?? "";

      if (queueType === "add_models") {
        if (!targetShiftId) {
          await updateShiftQueueRecord(entry.id, { status: "expired", cancelled_at: nowIso }).catch(() => {});
          continue;
        }
        const targetShift = await getShiftById(targetShiftId);
        const targetLive =
          targetShift &&
          (targetShift.status === "active" || targetShift.status === "on_break") &&
          targetShift.staff_role === "chatter";
        if (!targetLive) {
          await updateShiftQueueRecord(entry.id, { status: "expired", cancelled_at: nowIso }).catch(() => {});
          continue;
        }
        if ((targetShift.chatter_id ?? "").trim() !== (entry.chatter_id ?? "").trim()) {
          await updateShiftQueueRecord(entry.id, { status: "expired", cancelled_at: nowIso }).catch(() => {});
          continue;
        }

        const rawNames = entry.selected_model_names;
        const desired = modelIds.map((id, i) => ({
          modelRecordId: id,
          modelName: (rawNames[i] ?? "").trim() || "Model",
        }));

        const alreadyOnTarget = await listShiftModels(targetShiftId);
        const onTargetIds = new Set(alreadyOnTarget.map((sm) => sm.model_id).filter(Boolean));

        const eligible: { modelRecordId: string; modelName: string }[] = [];
        for (const it of desired) {
          if (onTargetIds.has(it.modelRecordId)) continue;
          const model = await getModelById(it.modelRecordId);
          if (model?.current_status !== "free") continue;
          eligible.push({
            modelRecordId: it.modelRecordId,
            modelName: (it.modelName || model.model_name || "Model").trim() || "Model",
          });
        }

        if (eligible.length === 0) {
          await updateShiftQueueRecord(entry.id, { status: "expired", cancelled_at: nowIso }).catch(() => {});
          try {
            await notify({
              user_id: entry.chatter_id,
              event_type: NOTIFICATION_EVENT.SYSTEM_ALERT,
              priority: NOTIFICATION_PRIORITY.NORMAL,
              title: "⚠️ Shift Queue: No Models to Add",
              body: "⚠️ None of the queued models were free to attach. Try adding them manually from the shift page.",
              entity_type: NOTIFICATION_ENTITY.SHIFT,
              entity_id: endedShiftId,
              actor_user_id: entry.chatter_id,
              actor_name: entry.chatter_name,
            });
          } catch (_) {
            /* ignore */
          }
          continue;
        }

        const bulk = await bulkAddModelsToShift({
          shiftRecordId: targetShiftId,
          items: eligible,
          chatterRecordId: entry.chatter_id,
          chatterName: (entry.chatter_name || "Chatter").trim() || "Chatter",
          skipNotification: true,
        });

        if (bulk.success) {
          await updateShiftQueueRecord(entry.id, { status: "started", started_at: nowIso }).catch(() => {});
          const namesLabel = eligible.map((x) => x.modelName).filter(Boolean).join(", ") || `${bulk.added} model(s)`;
          try {
            await notify({
              user_id: entry.chatter_id,
              event_type: NOTIFICATION_EVENT.MODEL_TAKEN,
              priority: NOTIFICATION_PRIORITY.NORMAL,
              title: "🟢 Models added to your shift!",
              body: `🟢 ${namesLabel} ${bulk.added === 1 ? "has" : "have"} been added to your shift automatically.`,
              entity_type: NOTIFICATION_ENTITY.SHIFT,
              entity_id: targetShiftId,
              actor_user_id: entry.chatter_id,
              actor_name: entry.chatter_name,
              _triggerSource: "shiftQueueAddModels",
            });
          } catch (e) {
            console.error("[notify] shift queue add_models chatter failed", e);
          }
          try {
            await notifyAdmins({
              event_type: NOTIFICATION_EVENT.SHIFT_STARTED,
              priority: NOTIFICATION_PRIORITY.NORMAL,
              title: `🟢 Models auto-added: ${entry.chatter_name || "Chatter"}`,
              body: `🟢 ${namesLabel} were added to ${(entry.chatter_name || "a chatter").trim()}'s shift from queue.`,
              entity_type: NOTIFICATION_ENTITY.SHIFT,
              entity_id: targetShiftId,
              actor_user_id: entry.chatter_id,
              actor_name: entry.chatter_name,
            });
          } catch (e) {
            console.error("[notify] shift queue add_models admins failed", e);
          }
          revalidatePath(ROUTES.chatter.shift);
          revalidatePath(ROUTES.admin.liveShifts);
        } else {
          await updateShiftQueueRecord(entry.id, { status: "expired", cancelled_at: nowIso }).catch(() => {});
          try {
            await notify({
              user_id: entry.chatter_id,
              event_type: NOTIFICATION_EVENT.SYSTEM_ALERT,
              priority: NOTIFICATION_PRIORITY.NORMAL,
              title: "⚠️ Shift Queue: Could Not Add Models",
              body: `⚠️ ${bulk.error ?? "Models could not be attached. Try adding them manually."}`,
              entity_type: NOTIFICATION_ENTITY.SHIFT,
              entity_id: endedShiftId,
              actor_user_id: entry.chatter_id,
              actor_name: entry.chatter_name,
            });
          } catch (_) {
            /* ignore */
          }
        }
        continue;
      }

      if (startedOneFullStart) {
        await updateShiftQueueRecord(entry.id, { status: "expired", cancelled_at: nowIso }).catch(() => {});
        continue;
      }

      const modelNames = entry.selected_model_names.filter(Boolean);
      const result = await startShiftWithModels(
        entry.chatter_id,
        (entry.chatter_name || "Chatter").trim() || "Chatter",
        modelIds,
        { suppressNotifications: true }
      );

      if (result.success) {
        startedOneFullStart = true;
        await updateShiftQueueRecord(entry.id, { status: "started", started_at: nowIso }).catch(() => {});
        const namesLabel = modelNames.length ? modelNames.join(", ") : `${modelIds.length} model(s)`;
        try {
          await notify({
            user_id: entry.chatter_id,
            event_type: NOTIFICATION_EVENT.SHIFT_STARTED,
            priority: NOTIFICATION_PRIORITY.NORMAL,
            title: "🟢 Shift started!",
            body: `🟢 Your shift started at ${formatTimeAthens(nowIso)} with ${namesLabel}. You're live!`,
            entity_type: NOTIFICATION_ENTITY.SHIFT,
            entity_id: result.shiftId,
            actor_user_id: entry.chatter_id,
            actor_name: entry.chatter_name,
            _triggerSource: "shiftQueueAutoStart",
          });
        } catch (e) {
          console.error("[notify] shift queue auto-start chatter failed", e);
        }
        try {
          await notifyAdmins({
            event_type: NOTIFICATION_EVENT.SHIFT_STARTED,
            priority: NOTIFICATION_PRIORITY.NORMAL,
            title: `🟢 Auto-shift: ${entry.chatter_name || "Chatter"}`,
            body: `🟢 ${(entry.chatter_name || "A chatter").trim()}'s shift started automatically from queue at ${formatTimeAthens(nowIso)}. Models: ${namesLabel}`,
            entity_type: NOTIFICATION_ENTITY.SHIFT,
            entity_id: result.shiftId,
            actor_user_id: entry.chatter_id,
            actor_name: entry.chatter_name,
          });
        } catch (e) {
          console.error("[notify] shift queue auto-start admins failed", e);
        }
        revalidatePath(ROUTES.chatter.shift);
        revalidatePath(ROUTES.admin.liveShifts);
      } else {
        await updateShiftQueueRecord(entry.id, { status: "expired", cancelled_at: nowIso }).catch(() => {});
        try {
          await notify({
            user_id: entry.chatter_id,
            event_type: NOTIFICATION_EVENT.SYSTEM_ALERT,
            priority: NOTIFICATION_PRIORITY.NORMAL,
            title: "⚠️ Shift Queue: Could Not Start",
            body: `⚠️ ${result.error ?? "Auto-start failed. Start manually or join the queue again."}`,
            entity_type: NOTIFICATION_ENTITY.SHIFT,
            entity_id: endedShiftId,
            actor_user_id: entry.chatter_id,
            actor_name: entry.chatter_name,
          });
        } catch (_) {
          /* ignore */
        }
      }
    }
  } catch (e) {
    console.error("[processShiftQueueAfterShiftEnd]", e);
  }
}

export async function endShift(shiftRecordId: string) {
  const now = new Date().toISOString();
  const shiftModels = await listShiftModels(shiftRecordId);
  const pendingRelease = shiftModels.filter((sm) => !sm.left_at);
  const modelRowsToFree = pendingRelease.filter((sm) => sm.model_id);
  if (pendingRelease.length > 0) {
    await batchUpdateRecords(
      "shift_models",
      pendingRelease.map((sm) => ({ id: sm.id, fields: { left_at: now } }))
    );
  }
  if (modelRowsToFree.length > 0) {
    await batchUpdateRecords(
      "modelss",
      modelRowsToFree.map((sm) => ({
        id: sm.model_id,
        fields: {
          current_status: "free",
          current_chatter: [],
          current_chatter_name: "",
          current_shift_id: "",
          last_chatter: sm.chatter_id ? [sm.chatter_id] : [],
          last_chatter_name: sm.chatter_name ?? "",
          last_exit_at: now,
        },
      }))
    );
    for (const sm of modelRowsToFree) {
      await broadcastRealtimeToAll({ type: "model_status_changed", model_id: sm.model_id, status: "free" }).catch(() => {});
    }
  }
  await updateShift(shiftRecordId, { end_time: now, status: "completed" });
  const shift = await getShiftById(shiftRecordId);
  revalidatePath(ROUTES.chatter.shift);
  devLog("[shift_ended_debug]", {
    shiftChatterId: shift?.chatter_id,
    shiftChatterName: shift?.chatter_name,
    shiftRecordId,
  });
  const chatterIdFromModels = shiftModels.find((sm) => (sm.chatter_id ?? "").trim() !== "")?.chatter_id?.trim() ?? "";
  const chatterIdForNotify = (shift?.chatter_id ?? "").trim() || chatterIdFromModels;
  const chatterNameForNotify =
    shiftModels.find((sm) => (sm.chatter_id ?? "").trim() === chatterIdForNotify)?.chatter_name?.trim() ||
    shift?.chatter_name?.trim() ||
    "Staff";
  if (chatterIdForNotify) {
    await broadcastRealtimeToAll({ type: "shift_ended", chatter_id: chatterIdForNotify, shift_id: shiftRecordId }).catch(() => {});
    const modelNames = shiftModels.map((sm) => sm.model_name).filter(Boolean);
    const workedMinutes = shift?.worked_minutes ?? undefined;
    const selfCopy = shiftCompletedSelf(now, modelNames, workedMinutes);
    try {
      await notifyByRoleConfig(NOTIFICATION_EVENT.SHIFT_ENDED, {
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: selfCopy.title,
        body: selfCopy.body,
        entity_type: NOTIFICATION_ENTITY.SHIFT,
        entity_id: shiftRecordId,
        actor_user_id: chatterIdForNotify,
        actor_name: chatterNameForNotify,
        personal_user_id: chatterIdForNotify,
        context: { endTime: now, modelNames, workedMinutes },
      });
    } catch (e) {
      console.error("[notify] endShift failed", e);
    }
  }
  if (shift?.staff_role === "chatter" && chatterIdForNotify) {
    setTimeout(() => {
      awardShiftEndPoints(shift, shiftRecordId, chatterIdForNotify).catch((e) =>
        console.error("[points-engine] awardShiftEndPoints failed", e)
      );
    }, 100);
  }
  if (shift?.staff_role === "chatter" && chatterIdForNotify && shift) {
    let minutes = shift.worked_minutes != null ? Math.max(0, Math.floor(Number(shift.worked_minutes))) : null;
    if ((minutes == null || Number.isNaN(minutes)) && shift.start_time) {
      const st = new Date(shift.start_time).getTime();
      const en = new Date(now).getTime();
      if (!Number.isNaN(st) && !Number.isNaN(en) && en > st) {
        minutes = Math.round((en - st) / 60000);
      }
    }
    if (minutes == null || Number.isNaN(minutes)) minutes = 0;
    const hours = Math.round((minutes / 60) * 100) / 100;
    if (hours > 0) {
      setTimeout(() => {
        void import("@/services/challenges").then(({ updateChallengeProgress }) =>
          updateChallengeProgress(chatterIdForNotify, "shift_hours", hours).catch((e) =>
            console.error("[challenges] updateChallengeProgress shift_hours failed", e)
          )
        );
      }, 100);
    }
  }
  devLog("[endShift] completed", { shiftRecordId, modelsReleased: pendingRelease.length });
  await processShiftQueueAfterShiftEnd(shiftRecordId);
}

export type AdminForceEndShiftResult = { success: true } | { success: false; error: string };

/** Admin/manager ends an active shift: completes shift, frees models, deletes shift_models, notifies staff and admins. */
export async function adminForceEndShift(shiftId: string, reason?: string): Promise<AdminForceEndShiftResult> {
  try {
    const session = await getSessionFromCookies();
    if (!session || !(await hasPermission(session, PERMISSIONS.SHIFTS_MANAGE))) {
      return { success: false, error: "Unauthorized." };
    }
    const id = shiftId?.trim();
    if (!id) return { success: false, error: "Invalid shift." };

    const shiftBefore = await getShiftById(id);
    if (!shiftBefore) return { success: false, error: "Shift not found." };
    if (shiftBefore.status === "completed") {
      return { success: false, error: "Shift is already completed." };
    }

    const now = new Date().toISOString();
    const shiftModels = await listShiftModels(id);
    const pendingRelease = shiftModels.filter((sm) => !sm.left_at);
    const modelRowsToFree = pendingRelease.filter((sm) => sm.model_id);

    if (pendingRelease.length > 0) {
      await batchUpdateRecords(
        SHIFT_MODELS_TABLE,
        pendingRelease.map((sm) => ({ id: sm.id, fields: { left_at: now } }))
      );
    }
    if (modelRowsToFree.length > 0) {
      await batchUpdateRecords(
        MODELSS_TABLE,
        modelRowsToFree.map((sm) => ({
          id: sm.model_id,
          fields: {
            current_status: "free",
            current_chatter: [],
            current_chatter_name: "",
            current_shift_id: "",
            last_chatter: sm.chatter_id ? [sm.chatter_id] : [],
            last_chatter_name: sm.chatter_name ?? "",
            last_exit_at: now,
          },
        }))
      );
      for (const sm of modelRowsToFree) {
        await broadcastRealtimeToAll({ type: "model_status_changed", model_id: sm.model_id, status: "free" }).catch(() => {});
      }
    }

    await updateShift(id, { end_time: now, status: "completed" });

    for (const sm of shiftModels) {
      try {
        await deleteRecord(SHIFT_MODELS_TABLE, sm.id);
      } catch (e) {
        console.error("[adminForceEndShift] delete shift_model failed", sm.id, e);
      }
    }

    const chatterIdFromModels = shiftModels.find((sx) => (sx.chatter_id ?? "").trim() !== "")?.chatter_id?.trim() ?? "";
    const chatterIdForNotify =
      (shiftBefore.chatter_id ?? "").trim() || chatterIdFromModels;
    const chatterNameForNotify =
      shiftModels.find((sx) => (sx.chatter_id ?? "").trim() === chatterIdForNotify)?.chatter_name?.trim() ||
      shiftBefore.chatter_name?.trim() ||
      "Staff";
    const reasonLine = reason?.trim() ? ` ${reason.trim()}` : "";

    if (chatterIdForNotify) {
      await broadcastRealtimeToAll({ type: "shift_ended", chatter_id: chatterIdForNotify, shift_id: id }).catch(() => {});
      try {
        await notifyByRoleConfig(NOTIFICATION_EVENT.SHIFT_ENDED, {
          priority: NOTIFICATION_PRIORITY.NORMAL,
          title: "✅ Shift Ended by Admin",
          body: `✅ An administrator ended your shift at ${formatTimeAthens(now)}.${reasonLine ? ` Reason:${reasonLine}` : ""}`,
          entity_type: NOTIFICATION_ENTITY.SHIFT,
          entity_id: id,
          actor_user_id: session.airtableUserId ?? session.id,
          actor_name: chatterNameForNotify,
          personal_user_id: chatterIdForNotify,
          context: {
            endTime: now,
            chatterName: chatterNameForNotify,
            adminName: session.fullName ?? session.email ?? "Admin",
          },
        });
      } catch (e) {
        console.error("[notify] adminForceEndShift failed", e);
      }
    }

    try {
      await createActivityLog({
        actor_user_id: session.airtableUserId ?? session.id,
        actor_name: session.fullName ?? session.email ?? "Admin",
        action_type: "shift_ended",
        entity_type: "shift",
        entity_id: id,
        summary: `Admin force-ended shift for ${chatterNameForNotify}`,
        details: reason?.trim() || "",
      });
    } catch (e) {
      console.error("[activity] adminForceEndShift log failed", e);
    }

    revalidatePath(ROUTES.admin.liveShifts);
    revalidatePath(ROUTES.chatter.shift);
    revalidatePath(ROUTES.va.shift);
    if (shiftBefore.staff_role === "chatter") {
      await processShiftQueueAfterShiftEnd(id);
    }
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg };
  }
}

// ——— Virtual assistant mistake shift (VA can enter model even if chatter is in it; no model occupancy updates) ———

export type StartMistakeShiftResult =
  | { success: true; redirectTo?: string }
  | { success: false; error: string };

export async function startMistakeShiftWithModels(
  vaRecordId: string,
  vaName: string,
  modelRecordIds: string[]
): Promise<StartMistakeShiftResult> {
  try {
    const session = await getSessionFromCookies();
    if (!session) return { success: false, error: "User session missing. Please log in again." };
    if (!(await hasPermission(session, PERMISSIONS.MISTAKES_VIEW))) {
      return { success: false, error: "You do not have permission to run a mistake shift." };
    }
    if (!vaRecordId?.trim()) {
      return { success: false, error: "User session missing. Please log in again." };
    }
    if (!Array.isArray(modelRecordIds) || modelRecordIds.length === 0) {
      return { success: false, error: "Select at least one model to start a mistake shift." };
    }
    const existing = await getActiveShiftByStaff(vaRecordId, "virtual_assistant");
    if (existing) {
      return { success: false, error: "You already have an active mistake shift. Add models or end it first." };
    }
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const startTime = now.toISOString();
    const shiftId = `shift_va_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const created = await createShift({
      shift_id: shiftId,
      chatter: [vaRecordId],
      chatter_name: vaName,
      date,
      start_time: startTime,
      status: "active",
      break_minutes: 0,
      staff_role: "virtual_assistant",
      shift_type: "mistakes",
      task_label: "Mistake check",
    });
    const nowStr = now.toISOString();
    const vaModelNames: string[] = [];
    for (const modelRecordId of modelRecordIds) {
      const model = await getModelById(modelRecordId);
      if (!model) continue;
      vaModelNames.push(model.model_name);
      await createShiftModel({
        shift: [created.id],
        model: [modelRecordId],
        model_name: model.model_name,
        chatter: [vaRecordId],
        chatter_name: vaName,
        entered_at: nowStr,
        status: "active",
      });
    }
    const adminCopy = taskShiftStartedAdmin(vaName, startTime, vaModelNames);
    revalidatePath(ROUTES.va.shift);
    revalidatePath(ROUTES.va.home);
    revalidatePath(ROUTES.va.liveShifts);
    revalidatePath(ROUTES.va.models);
    try {
      await notifyAdmins({
        event_type: NOTIFICATION_EVENT.TASK_STARTED,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: adminCopy.title,
        body: adminCopy.body,
        entity_type: NOTIFICATION_ENTITY.TASK_SHIFT,
        entity_id: created.id,
        actor_user_id: vaRecordId,
        actor_name: vaName,
      });
    } catch (e) {
      console.error("[notify] startMistakeShiftWithModels notifyAdmins failed", e);
    }
    return { success: true, redirectTo: ROUTES.va.shift };
  } catch (err) {
    if (isRedirectError(err)) throw err;
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

export async function addModelToMistakeShift(params: {
  shiftRecordId: string;
  modelRecordId: string;
  modelName: string;
  vaRecordId: string;
  vaName: string;
}): Promise<AddModelToShiftResult> {
  try {
    const session = await getSessionFromCookies();
    if (!session || !(await hasPermission(session, PERMISSIONS.MISTAKES_VIEW))) {
      return { success: false, error: "You do not have permission to modify a mistake shift." };
    }
    const existing = await listShiftModels(params.shiftRecordId);
    if (existing.some((sm) => sm.model_id === params.modelRecordId)) {
      return { success: false, error: "This model is already in your shift." };
    }
    const now = new Date().toISOString();
    await createShiftModel({
      shift: [params.shiftRecordId],
      model: [params.modelRecordId],
      model_name: params.modelName,
      chatter: [params.vaRecordId],
      chatter_name: params.vaName,
      entered_at: now,
      status: "active",
    });
    revalidatePath(ROUTES.va.shift);
    revalidatePath(ROUTES.va.home);
    revalidatePath(ROUTES.va.liveShifts);
    revalidatePath(ROUTES.va.models);
    return { success: true };
  } catch (err) {
    if (isRedirectError(err)) throw err;
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

export async function removeModelFromMistakeShift(
  shiftModelRecordId: string,
  shiftRecordId: string
): Promise<RemoveModelFromShiftResult> {
  try {
    const session = await getSessionFromCookies();
    if (!session || !(await hasPermission(session, PERMISSIONS.MISTAKES_VIEW))) {
      return { success: false, error: "You do not have permission to modify a mistake shift." };
    }
    const now = new Date().toISOString();
    await updateShiftModel(shiftModelRecordId, { left_at: now });
    const remaining = await listShiftModels(shiftRecordId);
    const activeRemaining = remaining.filter((sm) => !sm.left_at);
    if (activeRemaining.length === 0) {
      await updateShift(shiftRecordId, { end_time: now, status: "completed" });
      const endedShift = await getShiftById(shiftRecordId);
      revalidatePath(ROUTES.va.shift);
      revalidatePath(ROUTES.va.home);
      revalidatePath(ROUTES.va.liveShifts);
      revalidatePath(ROUTES.va.models);
      if (endedShift?.chatter_id) {
        const adminCopy = taskShiftEndedAdmin(endedShift.chatter_name ?? "VA", now);
        try {
          await notifyAdmins({
            event_type: NOTIFICATION_EVENT.TASK_FINISHED,
            priority: NOTIFICATION_PRIORITY.NORMAL,
            title: adminCopy.title,
            body: adminCopy.body,
            entity_type: NOTIFICATION_ENTITY.TASK_SHIFT,
            entity_id: shiftRecordId,
            actor_user_id: endedShift.chatter_id,
            actor_name: endedShift.chatter_name ?? undefined,
          });
        } catch (e) {
          console.error("[notify] removeModelFromMistakeShift notifyAdmins failed", e);
        }
      }
      return { success: true, shiftEnded: true };
    }
    revalidatePath(ROUTES.va.shift);
    revalidatePath(ROUTES.va.home);
    revalidatePath(ROUTES.va.liveShifts);
    revalidatePath(ROUTES.va.models);
    return { success: true, shiftEnded: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

export async function endMistakeShift(shiftRecordId: string) {
  const session = await getSessionFromCookies();
  if (!session || !(await hasPermission(session, PERMISSIONS.MISTAKES_VIEW))) {
    throw new Error("Forbidden");
  }
  const now = new Date().toISOString();
  const shiftModels = await listShiftModels(shiftRecordId);
  for (const sm of shiftModels) {
    if (!sm.left_at) await updateShiftModel(sm.id, { left_at: now });
  }
  await updateShift(shiftRecordId, { end_time: now, status: "completed" });
  const shift = await getShiftById(shiftRecordId);
  revalidatePath(ROUTES.va.shift);
  revalidatePath(ROUTES.va.home);
  revalidatePath(ROUTES.va.liveShifts);
  revalidatePath(ROUTES.va.models);
  if (shift?.chatter_id) {
    const adminCopy = taskShiftEndedAdmin(shift.chatter_name ?? "VA", now);
    try {
      await notifyAdmins({
        event_type: NOTIFICATION_EVENT.TASK_FINISHED,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: adminCopy.title,
        body: adminCopy.body,
        entity_type: NOTIFICATION_ENTITY.TASK_SHIFT,
        entity_id: shiftRecordId,
        actor_user_id: shift.chatter_id,
        actor_name: shift.chatter_name ?? undefined,
      });
    } catch (e) {
      console.error("[notify] endMistakeShift notifyAdmins failed", e);
    }
  }
}
