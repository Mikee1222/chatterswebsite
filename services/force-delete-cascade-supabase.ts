/**
 * Supabase backend for services/force-delete-cascade.ts
 */
import { getSupabaseServiceClient } from "@/lib/supabase-server";
import { sbUuidsForAirtableIds } from "@/lib/supabase-data";
import { getSessionFromCookies } from "@/lib/auth";
import { getModelById } from "@/services/modelss";
import { deleteUserLinkedRecordsBeforeUserDelete } from "@/services/accounts-delete";

const SPIN_WHEEL_SPINS = "spin_wheel_spins";

async function resolveUuid(table: string, publicId: string): Promise<string | null> {
  if (!publicId) return null;
  if (!publicId.startsWith("rec")) return publicId;
  const uuids = await sbUuidsForAirtableIds(table, [publicId]);
  return uuids[0] ?? null;
}

async function deleteOrUnlinkArrayLink(
  sb: ReturnType<typeof getSupabaseServiceClient>,
  table: string,
  field: string,
  targetUuid: string
): Promise<void> {
  try {
    const { data } = await sb.from(table).select("*").contains(field, [targetUuid]);
    const rows = ((data ?? []) as unknown as Array<{ id: string } & Record<string, unknown>>);
    for (const row of rows) {
      const raw = row[field];
      const arr = Array.isArray(raw) ? (raw as string[]).filter((x) => x !== targetUuid) : [];
      if (arr.length === 0) {
        await sb.from(table).delete().eq("id", row.id);
      } else {
        await sb.from(table).update({ [field]: arr }).eq("id", row.id);
      }
    }
  } catch {
    /* ignore */
  }
}

async function deleteOrClearTextField(
  sb: ReturnType<typeof getSupabaseServiceClient>,
  table: string,
  field: string,
  values: string[]
): Promise<void> {
  const parts = values.map((v) => v.trim()).filter(Boolean);
  if (!parts.length) return;
  try {
    for (const v of parts) {
      const { data } = await sb.from(table).select("id").eq(field, v);
      for (const r of ((data ?? []) as Array<{ id: string }>)) {
        try {
          await sb.from(table).delete().eq("id", r.id);
        } catch {
          await sb.from(table).update({ [field]: "" }).eq("id", r.id);
        }
      }
    }
  } catch {
    /* ignore */
  }
}

async function removeModelFromWeeklyPrograms(sb: ReturnType<typeof getSupabaseServiceClient>, modelUuid: string): Promise<void> {
  for (const table of ["weekly_program", "weekly_program_va"] as const) {
    await deleteOrUnlinkArrayLink(sb, table, "models", modelUuid);
  }
}

async function cascadeVaTasksStripUser(sb: ReturnType<typeof getSupabaseServiceClient>, userUuid: string): Promise<void> {
  try {
    const { data } = await sb.from("va_tasks").select("*").or(`assigned_to.cs.{${userUuid}},assigned_by.cs.{${userUuid}}`);
    const rows = ((data ?? []) as unknown as Array<{ id: string; assigned_to?: string[] | null; assigned_by?: string[] | null }>);
    for (const row of rows) {
      const to = (row.assigned_to ?? []).filter((x) => x !== userUuid);
      const by = (row.assigned_by ?? []).filter((x) => x !== userUuid);
      await sb.from("va_tasks").update({ assigned_to: to, assigned_by: by }).eq("id", row.id);
    }
  } catch {
    /* ignore */
  }
}

async function assertCanDeleteLastAdmin(sb: ReturnType<typeof getSupabaseServiceClient>, userUuid: string): Promise<void> {
  try {
    const { data } = await sb.from("users").select("id").ilike("role", "admin").eq("can_login", true);
    const rows = (data ?? []) as Array<{ id: string }>;
    if (rows.length <= 1 && rows[0]?.id === userUuid) {
      throw new Error("Cannot delete the last admin account");
    }
  } catch (e) {
    if (e instanceof Error && e.message === "Cannot delete the last admin account") throw e;
  }
}

export async function forceDeleteModel(modelId: string): Promise<void> {
  const id = modelId.trim();
  if (!id) throw new Error("Missing model id");
  const sb = getSupabaseServiceClient();
  const uuid = await resolveUuid("modelss", id);
  if (!uuid) throw new Error(`Model ${id} not found`);

  await removeModelFromWeeklyPrograms(sb, uuid);

  const modelRow = await getModelById(id).catch(() => null);
  const stableModelId = modelRow?.model_id?.trim() ?? "";

  const linkedPasses: Array<{ table: string; field: string }> = [
    { table: "shift_models", field: "model" },
    { table: "weekly_availability_requests_models", field: "model" },
    { table: "custom_requests", field: "assigned_model" },
    { table: "model_tasks", field: "model" },
    { table: "model_live_streams", field: "model" },
    { table: "model_periods", field: "model" },
    { table: "model_schedule", field: "model" },
    { table: "model_time_off_requests", field: "model" },
    { table: "va_content_assignments", field: "model" },
    { table: "whale_transactions", field: "model" },
    { table: "whales", field: "assigned_model" },
  ];

  for (const p of linkedPasses) {
    await deleteOrUnlinkArrayLink(sb, p.table, p.field, uuid);
  }

  if (stableModelId) {
    for (const [table, field] of [
      ["model_tasks", "model_id"],
      ["model_live_streams", "model_id"],
      ["model_periods", "model_id"],
      ["model_schedule", "model_id"],
      ["model_time_off_requests", "model_id"],
      ["model_content_requests", "model_id"],
      ["model_expense_requests", "model_id"],
      ["model_personal_events", "model_id"],
      ["weekly_availability_requests_models", "model_id"],
      ["rebills", "model_id"],
      ["tips", "model_id"],
    ] as const) {
      await deleteOrClearTextField(sb, table, field, [stableModelId]);
    }
  }

  try {
    const { data } = await sb.from("users").select("*").contains("linked_model", [uuid]);
    const users = ((data ?? []) as unknown as Array<{ id: string; linked_model?: string[] | null }>);
    for (const u of users) {
      const rest = (u.linked_model ?? []).filter((x) => x !== uuid);
      await sb.from("users").update({ linked_model: rest }).eq("id", u.id);
    }
  } catch {
    /* ignore */
  }

  await sb.from("modelss").delete().eq("id", uuid);
}

export async function forceDeleteUser(userRecordId: string): Promise<void> {
  const id = userRecordId.trim();
  if (!id) throw new Error("Missing user id");

  const session = await getSessionFromCookies();
  if (session?.airtableUserId === id || session?.id === id) {
    throw new Error("Cannot delete your own account");
  }

  const sb = getSupabaseServiceClient();
  const uuid = await resolveUuid("users", id);
  if (!uuid) throw new Error(`User ${id} not found`);

  await assertCanDeleteLastAdmin(sb, uuid);

  let stableUserId = "";
  try {
    const { data } = await sb.from("users").select("user_id").eq("id", uuid).maybeSingle();
    stableUserId = String((data as { user_id?: string } | null)?.user_id ?? "").trim();
  } catch { /* ignore */ }

  const idVariants = [id, stableUserId].filter((x, i, a) => Boolean(x) && a.indexOf(x) === i);

  for (const [table, field] of [
    ["weekly_availability_requests_va", "chatter"],
    ["whale_transactions", "chatter"],
    ["va_content_assignments", "va"],
    ["monthly_targets", "team_member"],
  ] as const) {
    await deleteOrUnlinkArrayLink(sb, table, field, uuid);
  }

  await cascadeVaTasksStripUser(sb, uuid);

  for (const [table, field] of [
    ["rebills", "chatter_id"],
    ["tips", "chatter_id"],
    ["feedback", "user_id"],
    ["activity_logs", "actor_user_id"],
    [SPIN_WHEEL_SPINS, "user_id"],
    ["chatter_points", "user_id"],
    ["points_transactions", "user_id"],
  ] as const) {
    await deleteOrClearTextField(sb, table, field, idVariants);
  }

  await deleteUserLinkedRecordsBeforeUserDelete(id);

  await deleteOrUnlinkArrayLink(sb, "shift_models", "chatter", uuid);

  await sb.from("users").delete().eq("id", uuid);
}
