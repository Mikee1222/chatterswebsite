"use server";

import { listAllRecords as listAllFromAirtable, deleteRecord, updateRecord } from "@/lib/airtable-server";
import { formulaLinkedContains } from "@/lib/airtable-linked";
import { listAllShifts, listShiftModelsForShifts } from "@/services/shifts";
import { listAllWeeklyProgram } from "@/services/weekly-program";
import { listAllWeeklyProgramVa } from "@/services/weekly-program-va";
import { devLog } from "@/lib/dev-log";

const esc = (s: string) => s.replace(/"/g, '""');

async function deleteRecordsWithLogging(userId: string, step: string, table: string, recordIds: string[]): Promise<void> {
  for (const recordId of recordIds) {
    try {
      await deleteRecord(table, recordId);
    } catch (err) {
      console.error("[delete-user]", {
        userId,
        step,
        table,
        recordId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

/**
 * Deletes or unlinks all Airtable rows tied to this user (Airtable users record id) before removing the user.
 * Each category is best-effort: failures are logged and the rest continues.
 */
export async function deleteUserLinkedRecordsBeforeUserDelete(userRecordId: string): Promise<void> {
  const userId = userRecordId?.trim();
  if (!userId) return;

  const userFormula = `{user_id} = "${esc(userId)}"`;
  const chatterFormula = formulaLinkedContains("chatter", userId);
  const customRequestChatterFormula = formulaLinkedContains("requested_by_chatter", userId);
  const whaleFormula = formulaLinkedContains("assigned_chatter", userId);

  try {
    devLog("[delete-user]", { userId, step: "deleting notifications" });
    const notifRecs = await listAllFromAirtable<{ id: string }>("notifications", { filterByFormula: userFormula });
    await deleteRecordsWithLogging(userId, "notifications", "notifications", notifRecs.map((r) => r.id));
  } catch (err) {
    console.error("[delete-user]", {
      userId,
      step: "deleting notifications",
      error: err instanceof Error ? err.message : String(err),
    });
  }

  try {
    devLog("[delete-user]", { userId, step: "deleting notification preferences" });
    const prefRecs = await listAllFromAirtable<{ id: string }>("notification_preferences", { filterByFormula: userFormula });
    await deleteRecordsWithLogging(userId, "notification_preferences", "notification_preferences", prefRecs.map((r) => r.id));
  } catch (err) {
    console.error("[delete-user]", {
      userId,
      step: "deleting notification preferences",
      error: err instanceof Error ? err.message : String(err),
    });
  }

  try {
    devLog("[delete-user]", { userId, step: "deleting push subscriptions" });
    const pushRecs = await listAllFromAirtable<{ id: string }>("push_subscriptions", { filterByFormula: userFormula });
    await deleteRecordsWithLogging(userId, "push_subscriptions", "push_subscriptions", pushRecs.map((r) => r.id));
  } catch (err) {
    console.error("[delete-user]", {
      userId,
      step: "deleting push subscriptions",
      error: err instanceof Error ? err.message : String(err),
    });
  }

  try {
    devLog("[delete-user]", { userId, step: "deleting weekly availability requests" });
    const availRecs = await listAllFromAirtable<{ id: string }>("weekly_availability_requests", { filterByFormula: chatterFormula });
    await deleteRecordsWithLogging(userId, "weekly_availability_requests", "weekly_availability_requests", availRecs.map((r) => r.id));
  } catch (err) {
    console.error("[delete-user]", {
      userId,
      step: "deleting weekly availability requests",
      error: err instanceof Error ? err.message : String(err),
    });
  }

  try {
    devLog("[delete-user]", { userId, step: "deleting weekly program rows" });
    const progChatter = await listAllWeeklyProgram(chatterFormula);
    await deleteRecordsWithLogging(userId, "weekly_program", "weekly_program", progChatter.map((r) => r.id));
  } catch (err) {
    console.error("[delete-user]", {
      userId,
      step: "deleting weekly program rows",
      error: err instanceof Error ? err.message : String(err),
    });
  }

  try {
    devLog("[delete-user]", { userId, step: "deleting VA weekly program rows" });
    const progVa = await listAllWeeklyProgramVa(chatterFormula);
    await deleteRecordsWithLogging(userId, "weekly_program_va", "weekly_program_va", progVa.map((r) => r.id));
  } catch (err) {
    console.error("[delete-user]", {
      userId,
      step: "deleting VA weekly program rows",
      error: err instanceof Error ? err.message : String(err),
    });
  }

  try {
    devLog("[delete-user]", { userId, step: "deleting shift_models for user shifts" });
    const shifts = await listAllShifts(chatterFormula, "accounts-delete.listShiftsForUser");
    const shiftIds = shifts.map((s) => s.id);
    const shiftModels = await listShiftModelsForShifts(shiftIds);
    await deleteRecordsWithLogging(userId, "shift_models", "shift_models", shiftModels.map((m) => m.id));
    devLog("[delete-user]", { userId, step: "deleting shifts" });
    await deleteRecordsWithLogging(userId, "shifts", "shifts", shiftIds);
  } catch (err) {
    console.error("[delete-user]", {
      userId,
      step: "deleting shifts / shift_models",
      error: err instanceof Error ? err.message : String(err),
    });
  }

  try {
    devLog("[delete-user]", { userId, step: "unlinking whales (assigned_chatter)" });
    const whales = await listAllFromAirtable<{ id: string }>("whales", { filterByFormula: whaleFormula });
    for (const r of whales) {
      try {
        await updateRecord("whales", r.id, { assigned_chatter: [] } as Record<string, unknown>);
      } catch (err) {
        console.error("[delete-user]", {
          userId,
          step: "unlinking whales",
          recordId: r.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } catch (err) {
    console.error("[delete-user]", {
      userId,
      step: "unlinking whales",
      error: err instanceof Error ? err.message : String(err),
    });
  }

  try {
    devLog("[delete-user]", { userId, step: "unlinking custom requests (requested_by_chatter)" });
    const customs = await listAllFromAirtable<{ id: string }>("custom_requests", { filterByFormula: customRequestChatterFormula });
    for (const r of customs) {
      try {
        await updateRecord("custom_requests", r.id, {
          requested_by_chatter: [] as unknown as string[],
          updated_at: new Date().toISOString(),
        } as Record<string, unknown>);
      } catch (err) {
        console.error("[delete-user]", {
          userId,
          step: "unlinking custom_requests",
          recordId: r.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } catch (err) {
    console.error("[delete-user]", {
      userId,
      step: "unlinking custom_requests",
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export type DeleteCheckResult = {
  canDelete: boolean;
  reasons: string[];
  /** Human-readable summary for modal (e.g. "4 shifts, 2 weekly program records") */
  summary: string;
};

/**
 * Pre-delete check for the accounts UI. Linked operational rows are removed automatically
 * by {@link deleteUserLinkedRecordsBeforeUserDelete}; this always allows delete for a valid id.
 */
export async function getDeleteBlockReasonsForUser(userRecordId: string): Promise<DeleteCheckResult> {
  if (!userRecordId?.trim()) return { canDelete: false, reasons: ["Invalid user"], summary: "Invalid user." };
  return {
    canDelete: true,
    reasons: [],
    summary:
      "Linked records (notifications, preferences, push subscriptions, availability, weekly programs, shifts, whale/custom links, etc.) will be removed or unlinked automatically, then the user will be deleted.",
  };
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
      listAllFromAirtable<{ id: string }>("custom_requests", { filterByFormula: assignedModelFormula }).catch(() => []),
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
