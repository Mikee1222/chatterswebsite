"use server";

import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission, hasAnyPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import type { AuthUser } from "@/lib/auth-config";
import { spawnRecreatesFromWinner, updateWinnerLibraryEntry, submitPipelineWinner } from "@/services/winner-recreates";

type Result = { success: boolean; error?: string; message?: string };
function actor(u: AuthUser) {
  return { user_id: u.airtableUserId ?? u.id, user_name: u.fullName ?? u.email };
}

async function requireWinnerManage(): Promise<AuthUser | { error: string }> {
  const user = await getSessionFromCookies();
  if (!user) return { error: "Unauthorized." };
  if (!(await hasAnyPermission(user, [PERMISSIONS.WINNER_VIDEOS_MANAGE, PERMISSIONS.CONTENT_PIPELINE_MANAGE]))) {
    return { error: "Forbidden." };
  }
  return user;
}

/** Manos: pull N recreates from a winner into the current bunch (Creative). Rest stay in library. */
export async function generateWinnerRecreatesAction(winnerId: string, count?: number): Promise<Result> {
  const user = await requireWinnerManage();
  if ("error" in user) return { success: false, error: user.error };
  try {
    const { count: n, tier } = await spawnRecreatesFromWinner(winnerId, actor(user), count);
    revalidatePath(ROUTES.pipeline);
    revalidatePath(ROUTES.admin.winnerLibrary);
    return { success: true, message: `${n} recreates (${tier}) → Creative` };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

/** Manos writes/updates the "elements to change" + tier + recreate count for a winner. */
export async function saveWinnerElementsAction(
  id: string,
  patch: { tier?: "winner" | "super_winner"; recreate_count?: number; elements?: string }
): Promise<Result> {
  const user = await requireWinnerManage();
  if ("error" in user) return { success: false, error: user.error };
  try {
    await updateWinnerLibraryEntry(id, patch);
    revalidatePath(ROUTES.admin.winnerLibrary);
    return { success: true, message: "Αποθηκεύτηκε" };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

/** Evi submits a winner/super-winner from her daily form → appears in the Winner Library. */
export async function submitWinnerFromDailyAction(input: {
  video_link: string;
  creator_model_id: string;
  creator_name: string;
  elements: string;
  tier: "winner" | "super_winner";
}): Promise<Result> {
  const user = await getSessionFromCookies();
  if (!user) return { success: false, error: "Unauthorized." };
  const ok =
    (await hasPermission(user, PERMISSIONS.DAILY_REVIEW_SUBMIT)) ||
    (await hasPermission(user, PERMISSIONS.CONTENT_PIPELINE_QA));
  if (!ok) return { success: false, error: "Forbidden." };
  if (!input.video_link.trim()) return { success: false, error: "Χρειάζεται link του video." };
  try {
    const a = actor(user);
    await submitPipelineWinner({ ...input, submitted_by_id: a.user_id, submitted_by_name: a.user_name });
    revalidatePath(ROUTES.dailyReview);
    revalidatePath(ROUTES.admin.pipeline);
    return { success: true, message: `Submitted ${input.tier === "super_winner" ? "super-winner" : "winner"} 🏆` };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed." };
  }
}
