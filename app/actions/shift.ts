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
import { batchCreateRecords, batchUpdateRecords, listRecords } from "@/lib/airtable-server";
import { ROUTES } from "@/lib/routes";
import { notify, notifyAdmins } from "@/services/notification-service";
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
  shiftStartedAdmin,
  shiftCompletedSelf,
  shiftCompletedAdmin,
  breakStartedSelf,
  breakStartedAdmin,
  breakEndedSelf,
  breakEndedAdmin,
  taskShiftStartedAdmin,
  taskShiftEndedAdmin,
} from "@/lib/notification-copy";

export type StartShiftResult = { success: true; shiftId: string } | { success: false; error: string };

/** Create shift only after model selection. One active shift per chatter. Returns structured result; client handles navigation. */
export async function startShiftWithModels(
  chatterRecordId: string,
  chatterName: string,
  modelRecordIds: string[]
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
      console.log("[startShiftWithModels] already has active shift", { shiftId: existing.id });
      return { success: false, error: "You already have an active shift. Use the dashboard to add models or end it." };
    }

    let chatterUserFetched: Awaited<ReturnType<typeof getUserByAirtableId>> = null;
    try {
      chatterUserFetched = await getUserByAirtableId(chatterRecordId);
    } catch (fetchErr) {
      console.log(
        "[startShiftWithModels] chatter user fetch threw",
        JSON.stringify({
          chatterRecordId,
          error: fetchErr instanceof Error ? fetchErr.message : String(fetchErr),
        })
      );
    }
    console.log(
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
    console.log("[startShiftWithModels] creating shift with", {
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
    console.log("[startShiftWithModels] created shift", {
      shiftId: created.id,
      start_time: startTime,
      modelsAttached: modelNames.length,
    });
    const selfCopy = shiftStartedSelf(startTime, modelNames);
    const adminCopy = shiftStartedAdmin(chatterName, startTime, modelNames);

    await broadcastRealtimeToAll({ type: "shift_started", chatter_id: chatterRecordId, shift_id: created.id }).catch(() => {});
    revalidatePath(ROUTES.chatter.shift);

    try {
      await notify({
        user_id: chatterRecordId,
        event_type: NOTIFICATION_EVENT.SHIFT_STARTED,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: selfCopy.title,
        body: selfCopy.body,
        entity_type: NOTIFICATION_ENTITY.SHIFT,
        entity_id: created.id,
      });
    } catch (e) {
      console.error("[notify] shift_started chatter failed", e);
    }
    try {
      console.log("[shift_started_debug]", {
        chatterRecordId,
        chatterName,
        modelNames,
        event: NOTIFICATION_EVENT.SHIFT_STARTED,
      });
      const notifyAdminsReturn = await notifyAdmins({
        event_type: NOTIFICATION_EVENT.SHIFT_STARTED,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: adminCopy.title,
        body: adminCopy.body,
        entity_type: NOTIFICATION_ENTITY.SHIFT,
        entity_id: created.id,
        actor_user_id: chatterRecordId,
        actor_name: chatterName,
      });
      console.log(
        "[startShiftWithModels] notifyAdmins finished",
        JSON.stringify({
          returnValue: notifyAdminsReturn === undefined ? "undefined (notifyAdmins returns void)" : notifyAdminsReturn,
        })
      );
    } catch (e) {
      console.error("[notify] shift_started admin failed", e);
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
    const alreadyAttached = existing.some((sm) => sm.model_id === params.modelRecordId);
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
    await createShiftModel({
      shift: [params.shiftRecordId],
      model: [params.modelRecordId],
      model_name: params.modelName,
      chatter: [params.chatterRecordId],
      chatter_name: params.chatterName,
      entered_at: now,
      status: "active",
    });
    await updateModel(params.modelRecordId, {
      current_status: "occupied",
      current_chatter: [params.chatterRecordId],
      current_chatter_name: params.chatterName,
      current_shift_id: params.shiftRecordId,
      entered_at: now,
    });
    console.log("[addModelToShift] attached model", { modelRecordId: params.modelRecordId, modelName: params.modelName });
    revalidatePath(ROUTES.chatter.shift);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[addModelToShift] error", err);
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
    console.log("[removeModel] called", { shiftId: shiftRecordId, modelRecordId });
    if (!shiftRecordId?.trim() || !modelRecordId?.trim()) {
      return { success: false, error: "Missing shift or model." };
    }

    const models = await listShiftModels(shiftRecordId);
    const attachment = models.find((m) => m.model_id === modelRecordId && !m.left_at);
    if (!attachment) {
      console.log("[removeModel] no active shift_model row", { shiftRecordId, modelRecordId });
      return { success: false, error: "This model is not on this shift anymore." };
    }

    const shiftModelRecordId = attachment.id;
    const now = new Date().toISOString();
    const model = await getModelById(modelRecordId);
    await updateShiftModel(shiftModelRecordId, { left_at: now });
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
      console.log("[removeModelFromShift] last model removed, shift auto-ended", { shiftId: shiftRecordId });
      revalidatePath(ROUTES.chatter.shift);
      if (endedShift?.chatter_id) {
        const adminCopy = shiftCompletedAdmin(endedShift.chatter_name ?? "Staff", now, endedModelNames, endedShift.worked_minutes ?? undefined);
        try {
          await notifyAdmins({
            event_type: NOTIFICATION_EVENT.SHIFT_ENDED,
            priority: NOTIFICATION_PRIORITY.NORMAL,
            title: adminCopy.title,
            body: adminCopy.body,
            entity_type: NOTIFICATION_ENTITY.SHIFT,
            entity_id: shiftRecordId,
            actor_user_id: endedShift.chatter_id,
            actor_name: endedShift.chatter_name ?? undefined,
          });
        } catch (e) {
          console.error("[notify] removeModelFromShift shift_ended notifyAdmins failed", e);
        }
      }
      return { success: true, shiftEnded: true };
    }
    revalidatePath(ROUTES.chatter.shift);
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
  console.log("[break-reminder] set", {
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

export async function endBreak(shiftRecordId: string, additionalBreakMinutes: number) {
  const shiftBefore = await getShiftById(shiftRecordId);
  const now = new Date();
  const nowIso = now.toISOString();
  let segmentMinutes = additionalBreakMinutes;
  if (shiftBefore?.break_started_at) {
    const startMs = new Date(shiftBefore.break_started_at).getTime();
    if (!Number.isNaN(startMs)) {
      segmentMinutes = Math.max(1, Math.ceil((now.getTime() - startMs) / 60000));
    }
  }
  const currentBreak = shiftBefore?.break_minutes ?? 0;
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
  console.log("[shift_ended_debug]", {
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
    const adminCopy = shiftCompletedAdmin(chatterNameForNotify, now, modelNames, workedMinutes);
    try {
      await notify({
        user_id: chatterIdForNotify,
        event_type: NOTIFICATION_EVENT.SHIFT_ENDED,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: selfCopy.title,
        body: selfCopy.body,
        entity_type: NOTIFICATION_ENTITY.SHIFT,
        entity_id: shiftRecordId,
      });
    } catch (e) {
      console.error("[notify] endShift notify failed", e);
    }
    try {
      await notifyAdmins({
        event_type: NOTIFICATION_EVENT.SHIFT_ENDED,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: adminCopy.title,
        body: adminCopy.body,
        entity_type: NOTIFICATION_ENTITY.SHIFT,
        entity_id: shiftRecordId,
        actor_user_id: chatterIdForNotify,
        actor_name: chatterNameForNotify,
      });
    } catch (e) {
      console.error("[notify] endShift notifyAdmins failed", e);
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
  console.log("[endShift] completed", { shiftRecordId, modelsReleased: pendingRelease.length });
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
