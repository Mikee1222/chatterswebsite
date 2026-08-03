"use server";

import { listAllRecords, deleteRecord, updateRecord, getRecord } from "@/lib/airtable-server";
import { formulaLinkedContains, formulaTextEquals, linkedRecordIds } from "@/lib/airtable-linked";
import { isSupabaseBackend } from "@/lib/data-backend";
import { getSessionFromCookies } from "@/lib/auth";
import { getModelById } from "@/services/modelss";
import { deleteUserLinkedRecordsBeforeUserDelete } from "@/services/accounts-delete";

const SPIN_WHEEL_SPINS = "spin_wheel_spins";

async function deleteOrUnlinkField(
  table: string,
  recordId: string,
  unlinkPayload: Record<string, unknown>
): Promise<void> {
  try {
    await deleteRecord(table, recordId);
  } catch {
    try {
      await updateRecord(table, recordId, unlinkPayload);
    } catch {
      /* ignore */
    }
  }
}

async function cascadeLinkedContains(
  table: string,
  field: string,
  targetRecordId: string,
  caller: string
): Promise<void> {
  if (!targetRecordId.trim()) return;
  try {
    const records = await listAllRecords(table, {
      filterByFormula: formulaLinkedContains(field, targetRecordId),
      _caller: caller,
    });
    for (const r of records) {
      await deleteOrUnlinkField(table, r.id, { [field]: [] });
    }
  } catch {
    /* missing field / invalid formula */
  }
}

async function cascadeTextField(
  table: string,
  field: string,
  value: string,
  caller: string
): Promise<void> {
  if (!value.trim()) return;
  try {
    const records = await listAllRecords(table, {
      filterByFormula: formulaTextEquals(field, value),
      _caller: caller,
    });
    for (const r of records) {
      await deleteOrUnlinkField(table, r.id, { [field]: "" });
    }
  } catch {
    /* ignore */
  }
}

async function cascadeTextFieldAny(
  table: string,
  field: string,
  values: string[],
  caller: string
): Promise<void> {
  const parts = values.map((v) => v.trim()).filter(Boolean);
  if (parts.length === 0) return;
  const formula =
    parts.length === 1 ? formulaTextEquals(field, parts[0]) : `OR(${parts.map((v) => formulaTextEquals(field, v)).join(",")})`;
  try {
    const records = await listAllRecords(table, { filterByFormula: formula, _caller: caller });
    for (const r of records) {
      await deleteOrUnlinkField(table, r.id, { [field]: "" });
    }
  } catch {
    /* ignore */
  }
}

async function removeModelFromWeeklyPrograms(modelssRecordId: string): Promise<void> {
  for (const table of ["weekly_program", "weekly_program_va"] as const) {
    try {
      const records = await listAllRecords(table, {
        filterByFormula: formulaLinkedContains("models", modelssRecordId),
        _caller: `forceDeleteModel.${table}.models`,
      });
      for (const r of records) {
        const f = (r.fields ?? {}) as Record<string, unknown>;
        const ids = linkedRecordIds(f.models).filter((x) => x !== modelssRecordId);
        if (ids.length === 0) {
          await deleteRecord(table, r.id).catch(() => {});
        } else {
          await updateRecord(table, r.id, { models: ids } as Record<string, unknown>).catch(() => {});
        }
      }
    } catch {
      /* ignore */
    }
  }
}

async function cascadeVaTasksStripUser(userRecordId: string): Promise<void> {
  if (!userRecordId.trim()) return;
  try {
    const formula = `OR(${formulaLinkedContains("assigned_to", userRecordId)}, ${formulaLinkedContains("assigned_by", userRecordId)})`;
    const records = await listAllRecords("va_tasks", {
      filterByFormula: formula,
      _caller: "forceDeleteUser.va_tasks",
    });
    for (const r of records) {
      const f = (r.fields ?? {}) as Record<string, unknown>;
      const to = linkedRecordIds(f.assigned_to).filter((x) => x !== userRecordId);
      const by = linkedRecordIds(f.assigned_by).filter((x) => x !== userRecordId);
      try {
        await updateRecord("va_tasks", r.id, { assigned_to: to, assigned_by: by } as Record<string, unknown>);
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
}

async function assertCanDeleteLastAdmin(userRecordId: string): Promise<void> {
  const formulas = [
    `AND(LOWER({role}) = "admin", {can_login} = TRUE())`,
    `AND({role} = "admin", {can_login} = TRUE())`,
  ];
  for (const filterByFormula of formulas) {
    try {
      const admins = await listAllRecords("users", {
        filterByFormula,
        _caller: "forceDeleteUser.listAdmins",
      });
      if (admins.length <= 1 && admins[0]?.id === userRecordId) {
        throw new Error("Cannot delete the last admin account");
      }
      return;
    } catch (e) {
      if (e instanceof Error && e.message === "Cannot delete the last admin account") throw e;
    }
  }
}

/**
 * Admin-only: delete a modelss row after removing or unlinking dependent Airtable records (best-effort).
 */
export async function forceDeleteModel(modelId: string): Promise<void> {
  if (isSupabaseBackend()) return (await import("./force-delete-cascade-supabase")).forceDeleteModel(modelId);
  const id = modelId.trim();
  if (!id) throw new Error("Missing model id");

  await removeModelFromWeeklyPrograms(id);

  const modelRow = await getModelById(id).catch(() => null);
  const stableModelId = modelRow?.model_id?.trim() ?? "";

  const linkedPasses: Array<{ table: string; field: string; caller: string }> = [
    { table: "shift_models", field: "model", caller: "forceDeleteModel.shift_models.model" },
    { table: "weekly_availability_requests_models", field: "model", caller: "forceDeleteModel.warm.model" },
    { table: "weekly_availability_requests_models", field: "model_id", caller: "forceDeleteModel.warm.model_id" },
    { table: "custom_requests", field: "assigned_model", caller: "forceDeleteModel.custom_requests" },
    { table: "model_tasks", field: "model", caller: "forceDeleteModel.model_tasks.model" },
    { table: "model_tasks", field: "model_id", caller: "forceDeleteModel.model_tasks.model_id" },
    { table: "model_live_streams", field: "model", caller: "forceDeleteModel.mls.model" },
    { table: "model_live_streams", field: "model_id", caller: "forceDeleteModel.mls.model_id" },
    { table: "model_periods", field: "model", caller: "forceDeleteModel.mperiods.model" },
    { table: "model_periods", field: "model_id", caller: "forceDeleteModel.mperiods.model_id" },
    { table: "model_schedule", field: "model", caller: "forceDeleteModel.msched.model" },
    { table: "model_schedule", field: "model_id", caller: "forceDeleteModel.msched.model_id" },
    { table: "model_time_off_requests", field: "model", caller: "forceDeleteModel.mtor.model" },
    { table: "model_time_off_requests", field: "model_id", caller: "forceDeleteModel.mtor.model_id" },
    { table: "va_content_assignments", field: "model", caller: "forceDeleteModel.vaca.model" },
    { table: "va_content_assignments", field: "assigned_model", caller: "forceDeleteModel.vaca.assigned_model" },
    { table: "model_content_requests", field: "model_id", caller: "forceDeleteModel.mcr" },
    { table: "model_expense_requests", field: "model_id", caller: "forceDeleteModel.mer" },
    { table: "model_personal_events", field: "model_id", caller: "forceDeleteModel.mpe" },
    { table: "whale_transactions", field: "model", caller: "forceDeleteModel.wt.model" },
    { table: "whales", field: "assigned_model", caller: "forceDeleteModel.whales" },
  ];

  for (const p of linkedPasses) {
    await cascadeLinkedContains(p.table, p.field, id, p.caller);
  }

  if (stableModelId) {
    await cascadeTextField("va_content_assignments", "model_id", stableModelId, "forceDeleteModel.vaca.text_model_id");
    await cascadeTextField("rebills", "model_id", stableModelId, "forceDeleteModel.rebills");
    await cascadeTextField("tips", "model_id", stableModelId, "forceDeleteModel.tips");
  }

  try {
    const users = await listAllRecords("users", {
      filterByFormula: formulaLinkedContains("linked_model", id),
      _caller: "forceDeleteModel.unlinkUsers",
    });
    for (const u of users) {
      await updateRecord("users", u.id, { linked_model: [] } as Record<string, unknown>).catch(() => {});
    }
  } catch {
    /* ignore */
  }

  await deleteRecord("modelss", id);
}

/**
 * Admin caller must enforce role; this function applies cascade + user row delete and safety guards.
 */
export async function forceDeleteUser(userRecordId: string): Promise<void> {
  if (isSupabaseBackend()) return (await import("./force-delete-cascade-supabase")).forceDeleteUser(userRecordId);
  const id = userRecordId.trim();
  if (!id) throw new Error("Missing user id");

  const session = await getSessionFromCookies();
  if (session?.airtableUserId === id || session?.id === id) {
    throw new Error("Cannot delete your own account");
  }

  await assertCanDeleteLastAdmin(id);

  let stableUserId = "";
  try {
    const rec = await getRecord<{ user_id?: string }>("users", id);
    stableUserId = String(rec.fields?.user_id ?? "").trim();
  } catch {
    /* ignore */
  }

  const idVariants = [id, stableUserId].filter((x, i, a) => Boolean(x) && a.indexOf(x) === i);

  await cascadeLinkedContains("weekly_availability_requests_va", "chatter", id, "forceDeleteUser.warva");
  await cascadeLinkedContains("whale_transactions", "chatter", id, "forceDeleteUser.wt.chatter");
  await cascadeLinkedContains("va_content_assignments", "va", id, "forceDeleteUser.vaca.va");
  await cascadeLinkedContains("monthly_targets", "team_member", id, "forceDeleteUser.monthly_targets");

  await cascadeVaTasksStripUser(id);

  await cascadeTextFieldAny("rebills", "chatter_id", idVariants, "forceDeleteUser.rebills");
  await cascadeTextFieldAny("tips", "chatter_id", idVariants, "forceDeleteUser.tips");
  await cascadeTextFieldAny("feedback", "user_id", idVariants, "forceDeleteUser.feedback");
  await cascadeTextFieldAny("activity_logs", "actor_user_id", idVariants, "forceDeleteUser.activity_logs");
  await cascadeTextFieldAny(SPIN_WHEEL_SPINS, "user_id", idVariants, "forceDeleteUser.spins");
  await cascadeTextFieldAny("chatter_points", "user_id", idVariants, "forceDeleteUser.chatter_points");
  await cascadeTextFieldAny("points_transactions", "user_id", idVariants, "forceDeleteUser.points_tx");

  await deleteUserLinkedRecordsBeforeUserDelete(id);

  await cascadeLinkedContains("shift_models", "chatter", id, "forceDeleteUser.shift_models.chatter");

  await deleteRecord("users", id);
}
