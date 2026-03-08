"use server";

import { listAllRecords as listAllFromAirtable } from "@/lib/airtable-server";
import { formulaLinkedContains } from "@/lib/airtable-linked";
import { listAllShifts } from "@/services/shifts";
import { listAllWeeklyProgram } from "@/services/weekly-program";
import { listAllWeeklyProgramVa } from "@/services/weekly-program-va";

const esc = (s: string) => s.replace(/"/g, '""');

export type DeleteCheckResult = {
  canDelete: boolean;
  reasons: string[];
  /** Human-readable summary for modal (e.g. "4 shifts, 2 weekly program records") */
  summary: string;
};

/**
 * Check if a user (by Airtable record id) can be safely deleted.
 * Returns blocking reasons from: shifts, weekly_program, weekly_program_va,
 * weekly_availability_requests, notifications, notification_preferences,
 * push_subscriptions, whales, custom_requests.
 * We block if any operational links exist. We allow cleanup of notifications/preferences/push_subscriptions in the delete action.
 */
export async function getDeleteBlockReasonsForUser(userRecordId: string): Promise<DeleteCheckResult> {
  const reasons: string[] = [];
  if (!userRecordId?.trim()) return { canDelete: false, reasons: ["Invalid user"], summary: "Invalid user." };

  const chatterFormula = formulaLinkedContains("chatter", userRecordId);
  const userFormula = `{user_id} = "${esc(userRecordId)}"`;

  try {
    const [shifts, progChatter, progVaChatter, availReqs, notifs, prefs, pushSubs, whales, customs] = await Promise.all([
      listAllShifts(chatterFormula).catch(() => []),
      listAllWeeklyProgram(chatterFormula).catch(() => []),
      listAllWeeklyProgramVa(chatterFormula).catch(() => []),
      listAllFromAirtable<{ id: string }>("weekly_availability_requests", { filterByFormula: chatterFormula }).catch(() => []),
      listAllFromAirtable<{ id: string }>("notifications", { filterByFormula: userFormula }).catch(() => []),
      listAllFromAirtable<{ id: string }>("notification_preferences", { filterByFormula: userFormula }).catch(() => []),
      listAllFromAirtable<{ id: string }>("push_subscriptions", { filterByFormula: userFormula }).catch(() => []),
      listAllFromAirtable<{ id: string }>("whales", { filterByFormula: formulaLinkedContains("assigned_chatter", userRecordId) }).catch(() => []),
      listAllFromAirtable<{ id: string }>("custom_requests", { filterByFormula: chatterFormula }).catch(() => []),
    ]);

    if (shifts.length > 0) reasons.push(`${shifts.length} shift(s)`);
    if (progChatter.length > 0) reasons.push(`${progChatter.length} weekly program record(s)`);
    if (progVaChatter.length > 0) reasons.push(`${progVaChatter.length} VA weekly program record(s)`);
    if (availReqs.length > 0) reasons.push(`${availReqs.length} weekly availability request(s)`);
    if (notifs.length > 0) reasons.push(`${notifs.length} notification(s)`);
    if (prefs.length > 0) reasons.push(`${prefs.length} notification preference(s)`);
    if (pushSubs.length > 0) reasons.push(`${pushSubs.length} push subscription(s)`);
    if (whales.length > 0) reasons.push(`${whales.length} whale(s)`);
    if (customs.length > 0) reasons.push(`${customs.length} custom request(s)`);
  } catch (e) {
    console.error("[getDeleteBlockReasonsForUser]", e);
    return { canDelete: false, reasons: ["Could not check references"], summary: "A check failed. Try again." };
  }

  const canDelete = reasons.length === 0;
  const summary = canDelete
    ? "This user has no linked records and can be deleted."
    : `Cannot delete: this user is linked to ${reasons.join(", ")}. Remove or reassign these first.`;
  return { canDelete, reasons, summary };
}

/**
 * Check if a model (by Airtable record id) can be safely deleted.
 * Returns blocking reasons from: weekly_program (models), weekly_program_va (models),
 * shift_models, whales, custom_requests.
 */
export async function getDeleteBlockReasonsForModel(modelRecordId: string): Promise<DeleteCheckResult> {
  const reasons: string[] = [];
  if (!modelRecordId?.trim()) return { canDelete: false, reasons: ["Invalid model"], summary: "Invalid model." };

  const modelFormula = formulaLinkedContains("models", modelRecordId);
  const assignedModelFormula = formulaLinkedContains("assigned_model", modelRecordId);
  const customModelFormula = formulaLinkedContains("model", modelRecordId);

  try {
    const [progAll, progVaAll, shiftModelsAll, whales, customs] = await Promise.all([
      listAllWeeklyProgram(modelFormula).catch(() => []),
      listAllWeeklyProgramVa(modelFormula).catch(() => []),
      listAllFromAirtable<Record<string, unknown>>("shift_models", {}).then((recs) =>
        recs.filter((r) => {
          const f = r.fields as Record<string, unknown>;
          const raw = f?.model ?? f?.Model;
          const ids = Array.isArray(raw) ? raw : raw ? [raw] : [];
          return ids.includes(modelRecordId);
        })
      ).catch(() => []),
      listAllFromAirtable<{ id: string }>("whales", { filterByFormula: assignedModelFormula }).catch(() => []),
      listAllFromAirtable<{ id: string }>("custom_requests", { filterByFormula: customModelFormula }).catch(() => []),
    ]);

    if (progAll.length > 0) reasons.push(`${progAll.length} weekly program record(s)`);
    if (progVaAll.length > 0) reasons.push(`${progVaAll.length} VA weekly program record(s)`);
    if (shiftModelsAll.length > 0) reasons.push(`${shiftModelsAll.length} shift assignment(s)`);
    if (whales.length > 0) reasons.push(`${whales.length} whale(s)`);
    if (customs.length > 0) reasons.push(`${customs.length} custom request(s)`);
  } catch (e) {
    console.error("[getDeleteBlockReasonsForModel]", e);
    return { canDelete: false, reasons: ["Could not check references"], summary: "A check failed. Try again." };
  }

  const canDelete = reasons.length === 0;
  const summary = canDelete
    ? "This model has no linked records and can be deleted."
    : `Cannot delete: this model is linked to ${reasons.join(", ")}. Remove or reassign these first.`;
  return { canDelete, reasons, summary };
}
