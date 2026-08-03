"use server";

import { getSessionFromCookies } from "@/lib/auth";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  getActiveShifts,
  createShiftModel,
  updateShiftModel,
  listShiftModels,
  getShiftModelById,
} from "@/services/shifts";
import { getModelById, updateModel } from "@/services/modelss";
import { createActivityLog } from "@/services/activity-logs";
import { broadcastRealtimeToAll } from "@/lib/realtime-broadcast";

/** Enter a model (chatter only, during active shift). modelRecordId = modelss row id (UUID or Airtable rec…). */
export async function enterModel(modelRecordId: string) {
  const user = await getSessionFromCookies();
  if (!user) return { error: "Not authenticated" };
  if (getEffectiveStaffRole(user) !== "chatter" && !(await hasPermission(user, PERMISSIONS.SHIFTS_MANAGE)))
    return { error: "Only chatters can enter modelss" };

  const chatterRecordId = user.airtableUserId ?? "";
  const chatterName = user.fullName ?? user.email ?? "";

  const active = await getActiveShifts("chatter");
  const myShift = active.find((s) => s.chatter_id === chatterRecordId);
  if (!myShift) return { error: "Start a shift first" };

  const modelRecord = await getModelById(modelRecordId);
  if (!modelRecord) return { error: "Model not found" };
  if (modelRecord.current_status === "occupied") return { error: "Model is already occupied" };

  const now = new Date().toISOString();
  await createShiftModel({
    shift: [myShift.id],
    chatter: [chatterRecordId],
    chatter_name: chatterName,
    model: [modelRecordId],
    model_name: modelRecord.model_name,
    entered_at: now,
    status: "active",
  });

  const newCount = (myShift.models_count ?? 0) + 1;
  await updateModel(modelRecordId, {
    current_status: "occupied",
    current_chatter: [chatterRecordId],
    current_chatter_name: chatterName,
    current_shift_id: myShift.id,
    entered_at: now,
  });
  await broadcastRealtimeToAll({ type: "model_status_changed", model_id: modelRecordId, status: "occupied" }).catch(() => {});

  const { updateShift } = await import("@/services/shifts");
  await updateShift(myShift.id, { models_count: newCount });

  await createActivityLog({
    actor_user_id: user.id,
    actor_name: chatterName,
    action_type: "model_entered",
    entity_type: "model",
    entity_id: modelRecordId,
    summary: `${chatterName} entered ${modelRecord.model_name}`,
  });

  return { success: true };
}

/** Leave a model (chatter only). shiftModelRecordId = shift_models row id (UUID or Airtable rec…). */
export async function leaveModel(shiftModelRecordId: string) {
  const user = await getSessionFromCookies();
  if (!user) return { error: "Not authenticated" };

  const sm = await getShiftModelById(shiftModelRecordId);
  if (!sm) return { error: "Shift model session not found" };
  if (sm.left_at) return { error: "Session already ended" };

  const now = new Date().toISOString();
  const enteredAt = sm.entered_at ? new Date(sm.entered_at).getTime() : Date.now();
  const sessionMinutes = Math.round((Date.now() - enteredAt) / 60000);

  await updateShiftModel(shiftModelRecordId, {
    left_at: now,
    status: "left",
    session_minutes: sessionMinutes,
  });

  const modelRecordId = sm.model_id?.trim() || null;
  const shiftRecordId = sm.shift_id?.trim() || null;
  const chatterRecordId = user.airtableUserId ?? "";

  if (modelRecordId) {
    await updateModel(modelRecordId, {
      current_status: "free",
      last_chatter: chatterRecordId ? [chatterRecordId] : [],
      last_chatter_name: user.fullName ?? user.email ?? "",
      last_exit_at: now,
      current_chatter: [],
      current_chatter_name: "",
      current_shift_id: "",
    });
    await broadcastRealtimeToAll({ type: "model_status_changed", model_id: modelRecordId, status: "free" }).catch(() => {});
  }

  if (shiftRecordId) {
    const activeInShift = await listShiftModels(shiftRecordId).then((list) => list.filter((s) => !s.left_at));
    const { updateShift } = await import("@/services/shifts");
    await updateShift(shiftRecordId, { models_count: activeInShift.length });
  }

  await createActivityLog({
    actor_user_id: user.id,
    actor_name: user.fullName ?? user.email,
    action_type: "model_left",
    entity_type: "model",
    entity_id: modelRecordId ?? "",
    summary: `${user.fullName ?? user.email} left ${sm.model_name || "model"}`,
  });

  return { success: true };
}
