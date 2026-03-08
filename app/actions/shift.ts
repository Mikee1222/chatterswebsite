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
import { updateModel, getModelById } from "@/services/modelss";
import { ROUTES } from "@/lib/routes";
import { notify } from "@/services/notification-service";

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
    for (const modelRecordId of modelRecordIds) {
      const model = await getModelById(modelRecordId);
      if (!model || model.current_status !== "free") continue;
      await createShiftModel({
        shift: [created.id],
        model: [modelRecordId],
        model_name: model.model_name,
        chatter: [chatterRecordId],
        chatter_name: chatterName,
        entered_at: nowStr,
        status: "active",
      });
      await updateModel(modelRecordId, {
        current_status: "occupied",
        current_chatter: [chatterRecordId],
        current_chatter_name: chatterName,
        current_shift_id: created.id,
        entered_at: nowStr,
      });
    }
    console.log("[startShiftWithModels] created shift", {
      shiftId: created.id,
      start_time: startTime,
      modelsAttached: modelRecordIds.length,
    });
    await notify({
      user_id: chatterRecordId,
      event_type: "shift_started",
      priority: "normal",
      title: "Shift started",
      body: "Your shift has started.",
      entity_type: "shift",
      entity_id: created.id,
    }).catch(() => {});
    revalidatePath(ROUTES.chatter.shift);
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
 * Remove a model from the current shift. If this leaves the shift with zero active models,
 * the shift is automatically ended (end_time set, status = completed). Never leave an empty
 * active shift running.
 */
export async function removeModelFromShift(
  shiftModelRecordId: string,
  modelRecordId: string,
  shiftRecordId?: string
): Promise<RemoveModelFromShiftResult> {
  try {
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
    const shiftId = shiftRecordId ?? model?.current_shift_id;
    if (shiftId) {
      const remaining = await listShiftModels(shiftId);
      const activeRemaining = remaining.filter((sm) => !sm.left_at);
      if (activeRemaining.length === 0) {
        await updateShift(shiftId, { end_time: now, status: "completed" });
        console.log("[removeModelFromShift] last model removed, shift auto-ended", { shiftId });
        revalidatePath(ROUTES.chatter.shift);
        return { success: true, shiftEnded: true };
      }
    }
    revalidatePath(ROUTES.chatter.shift);
    return { success: true, shiftEnded: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[removeModelFromShift] error", err);
    return { success: false, error: message };
  }
}

export async function startBreak(shiftRecordId: string) {
  await updateShift(shiftRecordId, {
    status: "on_break",
    break_started_at: new Date().toISOString(),
  });
  const shift = await getShiftById(shiftRecordId);
  if (shift?.chatter_id) {
    await notify({
      user_id: shift.chatter_id,
      event_type: "break_started",
      priority: "normal",
      title: "Break started",
      body: "Your shift break has started.",
      entity_type: "shift",
      entity_id: shiftRecordId,
    }).catch(() => {});
  }
  revalidatePath(ROUTES.chatter.shift);
  revalidatePath(ROUTES.va.shift);
}

export async function endBreak(shiftRecordId: string, additionalBreakMinutes: number) {
  const shift = await getShiftById(shiftRecordId);
  const currentBreak = shift?.break_minutes ?? 0;
  await updateShift(shiftRecordId, {
    break_minutes: Math.min(currentBreak + additionalBreakMinutes, 45),
    status: "active",
    break_started_at: "",
  });
  if (shift?.chatter_id) {
    await notify({
      user_id: shift.chatter_id,
      event_type: "break_ended",
      priority: "normal",
      title: "Break ended",
      body: "Your shift break has ended.",
      entity_type: "shift",
      entity_id: shiftRecordId,
    }).catch(() => {});
  }
  revalidatePath(ROUTES.chatter.shift);
  revalidatePath(ROUTES.va.shift);
}

export async function endShift(shiftRecordId: string) {
  const now = new Date().toISOString();
  const shiftModels = await listShiftModels(shiftRecordId);
  for (const sm of shiftModels) {
    if (!sm.left_at) {
      await updateShiftModel(sm.id, { left_at: now });
      const model = await getModelById(sm.model_id);
      if (model) {
        await updateModel(model.id, {
          current_status: "free",
          current_chatter: [],
          current_chatter_name: "",
          current_shift_id: "",
          last_chatter: model.current_chatter_id ? [model.current_chatter_id] : [],
          last_chatter_name: model.current_chatter_name,
          last_exit_at: now,
        });
      }
    }
  }
  await updateShift(shiftRecordId, { end_time: now, status: "completed" });
  const shift = await getShiftById(shiftRecordId);
  if (shift?.chatter_id) {
    await notify({
      user_id: shift.chatter_id,
      event_type: "shift_ended",
      priority: "normal",
      title: "Shift ended",
      body: "Your shift has ended.",
      entity_type: "shift",
      entity_id: shiftRecordId,
    }).catch(() => {});
  }
  console.log("[endShift] completed", { shiftRecordId, modelsReleased: shiftModels.filter((sm) => !sm.left_at).length });
  revalidatePath(ROUTES.chatter.shift);
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
    for (const modelRecordId of modelRecordIds) {
      const model = await getModelById(modelRecordId);
      if (!model) continue;
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
    revalidatePath(ROUTES.va.shift);
    revalidatePath(ROUTES.va.home);
    revalidatePath(ROUTES.va.liveShifts);
    revalidatePath(ROUTES.va.models);
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
      revalidatePath(ROUTES.va.shift);
      revalidatePath(ROUTES.va.home);
      revalidatePath(ROUTES.va.liveShifts);
      revalidatePath(ROUTES.va.models);
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
  revalidatePath(ROUTES.va.shift);
  revalidatePath(ROUTES.va.home);
  revalidatePath(ROUTES.va.liveShifts);
  revalidatePath(ROUTES.va.models);
}
