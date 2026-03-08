"use server";

import { getSessionFromCookies } from "@/lib/auth";
import { getActiveShifts, createShiftModel, updateShiftModel, listShiftModels } from "@/services/shifts";
import { getModelById, updateModel } from "@/services/modelss";
import { createActivityLog } from "@/services/activity-logs";
import { notify } from "@/services/notification-service";
import { firstLinkedId } from "@/lib/airtable-linked";

/** Enter a model (chatter only, during active shift). modelRecordId = Airtable record id of the model (modelss). */
export async function enterModel(modelRecordId: string) {
  const user = await getSessionFromCookies();
  if (!user) return { error: "Not authenticated" };
  if (user.role !== "chatter" && user.role !== "admin") return { error: "Only chatters can enter modelss" };

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

  await notify({
    user_id: chatterRecordId,
    event_type: "model_taken",
    priority: "normal",
    title: "Entered model",
    body: `You entered ${modelRecord.model_name}`,
    entity_type: "model",
    entity_id: modelRecordId,
  }).catch(() => {});

  return { success: true };
}

/** Leave a model (chatter only). shiftModelRecordId = Airtable record id of the shift_models row. */
export async function leaveModel(shiftModelRecordId: string) {
  const user = await getSessionFromCookies();
  if (!user) return { error: "Not authenticated" };

  const { getRecord } = await import("@/lib/airtable-server");
  type SMFields = {
    shift?: string | string[];
    chatter?: string | string[];
    model?: string | string[];
    model_name?: string;
    left_at?: string;
    entered_at?: string;
  };
  const smRec = await getRecord<SMFields>("shift_models", shiftModelRecordId);
  if (smRec.fields.left_at) return { error: "Session already ended" };

  const now = new Date().toISOString();
  const enteredAt = smRec.fields.entered_at ? new Date(smRec.fields.entered_at).getTime() : Date.now();
  const sessionMinutes = Math.round((Date.now() - enteredAt) / 60000);

  await updateShiftModel(shiftModelRecordId, {
    left_at: now,
    status: "left",
    session_minutes: sessionMinutes,
  });

  const modelRecordId = firstLinkedId(smRec.fields.model) ?? null;
  const shiftRecordId = firstLinkedId(smRec.fields.shift);
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
    summary: `${user.fullName ?? user.email} left ${smRec.fields.model_name ?? "model"}`,
  });

  await notify({
    user_id: chatterRecordId,
    event_type: "model_became_free",
    priority: "low",
    title: "Left model",
    body: `You left ${smRec.fields.model_name ?? "model"}`,
    entity_type: "model",
    entity_id: modelRecordId ?? "",
  }).catch(() => {});

  return { success: true };
}
