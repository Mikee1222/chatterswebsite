"use server";

import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { deleteProgressForChallenge } from "@/services/challenges";
import type { ChallengeMetric } from "@/lib/challenges";
import { createRecord, deleteRecord, updateRecord } from "@/lib/airtable-server";

const TABLE = "challenges";

export type ChallengeData = {
  title: string;
  description: string;
  target_metric: ChallengeMetric;
  target_value: number;
  reward_points: number;
  start_date: string;
  end_date: string;
  active: boolean;
  /** Empty = all chatters; otherwise Airtable user record IDs. */
  assigned_user_ids: string[];
};

function requireAdminSession() {
  return getSessionFromCookies().then((u) => {
    if (!u || u.role !== "admin") return null;
    return u;
  });
}

function assignedUsersCsv(ids: string[] | undefined): string {
  const list = (ids ?? []).map((id) => id.trim()).filter(Boolean);
  return list.join(",");
}

function normalizeCreatePayload(data: ChallengeData): Record<string, unknown> {
  return {
    title: data.title.trim(),
    description: data.description.trim(),
    target_metric: data.target_metric,
    target_value: Math.max(1, Math.floor(Number(data.target_value))),
    reward_points: Math.max(0, Math.floor(Number(data.reward_points))),
    start_date: data.start_date.trim().slice(0, 10),
    end_date: data.end_date.trim().slice(0, 10),
    active: Boolean(data.active),
    assigned_users: assignedUsersCsv(data.assigned_user_ids),
  };
}

export async function createChallengeAction(
  data: ChallengeData
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const session = await requireAdminSession();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!data.title.trim()) return { success: false, error: "Title is required." };

  try {
    const created = await createRecord(TABLE, {
      ...normalizeCreatePayload(data),
      created_by: session.airtableUserId ?? session.id,
    });
    revalidatePath(ROUTES.admin.challenges);
    revalidatePath(ROUTES.chatter.challenges);
    return { success: true, id: created.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg };
  }
}

export async function updateChallengeAction(
  id: string,
  data: Partial<ChallengeData>
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await requireAdminSession();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!id.trim()) return { success: false, error: "Missing id." };

  try {
    const patch: Record<string, unknown> = {};
    if (data.title !== undefined) patch.title = data.title.trim();
    if (data.description !== undefined) patch.description = data.description.trim();
    if (data.target_metric !== undefined) patch.target_metric = data.target_metric;
    if (data.target_value !== undefined) patch.target_value = Math.max(1, Math.floor(Number(data.target_value)));
    if (data.reward_points !== undefined) patch.reward_points = Math.max(0, Math.floor(Number(data.reward_points)));
    if (data.start_date !== undefined) patch.start_date = data.start_date.trim().slice(0, 10);
    if (data.end_date !== undefined) patch.end_date = data.end_date.trim().slice(0, 10);
    if (data.active !== undefined) patch.active = Boolean(data.active);
    if (data.assigned_user_ids !== undefined) patch.assigned_users = assignedUsersCsv(data.assigned_user_ids);

    if (Object.keys(patch).length === 0) {
      return { success: false, error: "Nothing to update." };
    }
    await updateRecord(TABLE, id, patch);
    revalidatePath(ROUTES.admin.challenges);
    revalidatePath(ROUTES.chatter.challenges);
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg };
  }
}

export async function deleteChallengeAction(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await requireAdminSession();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!id.trim()) return { success: false, error: "Missing id." };

  try {
    await deleteProgressForChallenge(id);
    await deleteRecord(TABLE, id);
    revalidatePath(ROUTES.admin.challenges);
    revalidatePath(ROUTES.chatter.challenges);
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg };
  }
}
