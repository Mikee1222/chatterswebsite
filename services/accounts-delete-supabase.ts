/**
 * Supabase backend for services/accounts-delete.ts
 */
import { getSupabaseServiceClient } from "@/lib/supabase-server";
import { sbUuidsForAirtableIds } from "@/lib/supabase-data";
import { devLog } from "@/lib/dev-log";
import type { DeleteCheckResult } from "./accounts-delete";

async function resolveUserUuid(userRecordId: string): Promise<string | null> {
  if (userRecordId.startsWith("rec")) {
    const uuids = await sbUuidsForAirtableIds("users", [userRecordId]);
    return uuids[0] ?? null;
  }
  return userRecordId;
}

async function resolveModelUuid(modelRecordId: string): Promise<string | null> {
  if (modelRecordId.startsWith("rec")) {
    const uuids = await sbUuidsForAirtableIds("modelss", [modelRecordId]);
    return uuids[0] ?? null;
  }
  return modelRecordId;
}

async function deleteBy(sb: ReturnType<typeof getSupabaseServiceClient>, table: string, col: string, value: string | string[]): Promise<void> {
  try {
    if (Array.isArray(value)) {
      await sb.from(table).delete().contains(col, value);
    } else {
      await sb.from(table).delete().eq(col, value);
    }
  } catch (err) {
    console.error("[delete-user][sb]", { table, col, error: err instanceof Error ? err.message : String(err) });
  }
}

async function updateSet(sb: ReturnType<typeof getSupabaseServiceClient>, table: string, col: string, uuids: string[], patch: Record<string, unknown>): Promise<void> {
  try {
    await sb.from(table).update(patch).contains(col, uuids);
  } catch (err) {
    console.error("[delete-user][sb]", { table, col, error: err instanceof Error ? err.message : String(err) });
  }
}

export async function deleteUserLinkedRecordsBeforeUserDelete(userRecordId: string): Promise<void> {
  const userId = userRecordId?.trim();
  if (!userId) return;
  const sb = getSupabaseServiceClient();
  const uuid = await resolveUserUuid(userId);
  if (!uuid) {
    devLog("[delete-user][sb]", { userId, step: "no uuid resolved" });
    return;
  }

  await deleteBy(sb, "notifications", "user_id", userId);
  await deleteBy(sb, "notification_preferences", "user_id", userId);
  await deleteBy(sb, "push_subscriptions", "user_id", userId);
  await deleteBy(sb, "weekly_availability_requests", "chatter", [uuid]);
  await deleteBy(sb, "weekly_program", "chatter", [uuid]);
  await deleteBy(sb, "weekly_program_va", "chatter", [uuid]);

  try {
    const { data: shifts } = await sb.from("shifts").select("id").contains("chatter", [uuid]);
    const shiftUuids = ((shifts ?? []) as Array<{ id: string }>).map((s) => s.id);
    if (shiftUuids.length) {
      for (const sid of shiftUuids) {
        await sb.from("shift_models").delete().eq("shift_id", sid);
      }
      await sb.from("shifts").delete().in("id", shiftUuids);
    }
  } catch (err) {
    console.error("[delete-user][sb]", { step: "shifts/shift_models", error: err instanceof Error ? err.message : String(err) });
  }

  await updateSet(sb, "whales", "assigned_chatter", [uuid], { assigned_chatter: [] });
  await updateSet(sb, "custom_requests", "requested_by_chatter", [uuid], { requested_by_chatter: [], updated_at: new Date().toISOString() });
}

export async function getDeleteBlockReasonsForUser(userRecordId: string): Promise<DeleteCheckResult> {
  if (!userRecordId?.trim()) return { canDelete: false, reasons: ["Invalid user"], summary: "Invalid user." };
  return {
    canDelete: true,
    reasons: [],
    summary:
      "Linked records (notifications, preferences, push subscriptions, availability, weekly programs, shifts, whale/custom links, etc.) will be removed or unlinked automatically, then the user will be deleted.",
  };
}

export async function getDeleteBlockReasonsForModel(modelRecordId: string): Promise<DeleteCheckResult> {
  const reasons: string[] = [];
  if (!modelRecordId?.trim()) return { canDelete: false, reasons: ["Invalid model"], summary: "Invalid model." };
  const sb = getSupabaseServiceClient();
  const uuid = await resolveModelUuid(modelRecordId);
  if (!uuid) return { canDelete: false, reasons: ["Model not found"], summary: "Model not found." };

  try {
    const [prog, progVa, shiftModels, whales, customs] = await Promise.all([
      sb.from("weekly_program").select("id", { count: "exact", head: true }).contains("models", [uuid]),
      sb.from("weekly_program_va").select("id", { count: "exact", head: true }).contains("models", [uuid]),
      sb.from("shift_models").select("id", { count: "exact", head: true }).contains("model", [uuid]),
      sb.from("whales").select("id", { count: "exact", head: true }).contains("assigned_model", [uuid]),
      sb.from("custom_requests").select("id", { count: "exact", head: true }).contains("assigned_model", [uuid]),
    ]);
    if ((prog.count ?? 0) > 0) reasons.push(`${prog.count} weekly program record(s)`);
    if ((progVa.count ?? 0) > 0) reasons.push(`${progVa.count} VA weekly program record(s)`);
    if ((shiftModels.count ?? 0) > 0) reasons.push(`${shiftModels.count} shift assignment(s)`);
    if ((whales.count ?? 0) > 0) reasons.push(`${whales.count} whale(s)`);
    if ((customs.count ?? 0) > 0) reasons.push(`${customs.count} custom request(s)`);
  } catch (e) {
    console.error("[getDeleteBlockReasonsForModel][sb]", e);
    return { canDelete: false, reasons: ["Could not check references"], summary: "A check failed. Try again." };
  }

  const canDelete = reasons.length === 0;
  const summary = canDelete
    ? "This model has no linked records and can be deleted."
    : `Cannot delete: this model is linked to ${reasons.join(", ")}. Remove or reassign these first.`;
  return { canDelete, reasons, summary };
}
