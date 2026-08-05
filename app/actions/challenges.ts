"use server";

import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import {
  createChallenge,
  deleteChallenge,
  updateChallenge,
} from "@/services/challenges";
import {
  isChallengeMetric,
  normalizeChallengeTargetValue,
  type ChallengeMetric,
} from "@/lib/challenges";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";

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

async function requireChallengesManage() {
  const u = await getSessionFromCookies();
  if (!u || !(await hasPermission(u, PERMISSIONS.CHALLENGES_MANAGE))) return null;
  return u;
}

function assignedUsersCsv(ids: string[] | undefined): string {
  const list = (ids ?? []).map((id) => id.trim()).filter(Boolean);
  return list.join(",");
}

function normalizeMetric(raw: string): ChallengeMetric | null {
  const m = raw.trim();
  return isChallengeMetric(m) ? m : null;
}

function normalizeCreatePayload(data: ChallengeData): Record<string, unknown> {
  const metric = normalizeMetric(data.target_metric);
  if (!metric) throw new Error("Invalid challenge metric.");

  return {
    title: data.title.trim(),
    description: data.description.trim(),
    target_metric: metric,
    target_value: normalizeChallengeTargetValue(metric, Number(data.target_value)),
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
  const session = await requireChallengesManage();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!data.title.trim()) return { success: false, error: "Title is required." };

  try {
    const created = await createChallenge({
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
  const session = await requireChallengesManage();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!id.trim()) return { success: false, error: "Missing id." };

  try {
    const patch: Record<string, unknown> = {};
    if (data.title !== undefined) patch.title = data.title.trim();
    if (data.description !== undefined) patch.description = data.description.trim();
    if (data.target_metric !== undefined) {
      const metric = normalizeMetric(data.target_metric);
      if (!metric) return { success: false, error: "Invalid challenge metric." };
      patch.target_metric = metric;
    }
    if (data.target_value !== undefined) {
      const metric =
        data.target_metric != null
          ? normalizeMetric(data.target_metric)
          : null;
      if (metric) {
        patch.target_value = normalizeChallengeTargetValue(metric, Number(data.target_value));
      } else {
        patch.target_value = Math.max(0.01, Number(data.target_value));
      }
    }
    if (data.reward_points !== undefined) {
      patch.reward_points = Math.max(0, Math.floor(Number(data.reward_points)));
    }
    if (data.start_date !== undefined) patch.start_date = data.start_date.trim().slice(0, 10);
    if (data.end_date !== undefined) patch.end_date = data.end_date.trim().slice(0, 10);
    if (data.active !== undefined) patch.active = Boolean(data.active);
    if (data.assigned_user_ids !== undefined) {
      patch.assigned_users = assignedUsersCsv(data.assigned_user_ids);
    }

    if (Object.keys(patch).length === 0) {
      return { success: false, error: "Nothing to update." };
    }
    await updateChallenge(id, patch);
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
  const session = await requireChallengesManage();
  if (!session) return { success: false, error: "Unauthorized" };
  if (!id.trim()) return { success: false, error: "Missing id." };

  try {
    await deleteChallenge(id);
    revalidatePath(ROUTES.admin.challenges);
    revalidatePath(ROUTES.chatter.challenges);
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg };
  }
}
