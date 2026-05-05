"use server";

import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import {
  awardPoints,
  deletePointsTransaction,
  getLeaderboard,
  invalidateLeaderboardPeriodCache,
  runLevelFromPointsMigrationIfNeeded,
  type LeaderboardRow,
} from "@/services/points-engine";

export async function getLeaderboardForPeriodAction(
  period: "weekly" | "monthly" | "alltime"
): Promise<{ success: true; rows: LeaderboardRow[] } | { success: false; error: string; rows: LeaderboardRow[] }> {
  const user = await getSessionFromCookies();
  if (!user || user.role !== "chatter") {
    return { success: false, error: "Unauthorized", rows: [] };
  }
  const rows = await getLeaderboard(period);
  return { success: true, rows };
}

export async function deletePointsLedgerEntryAction(
  transactionId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const user = await getSessionFromCookies();
  if (!user || (user.role !== "admin" && user.role !== "manager")) {
    return { success: false, error: "Unauthorized" };
  }
  const id = transactionId.trim();
  if (!id) {
    return { success: false, error: "Missing transaction id." };
  }
  try {
    await deletePointsTransaction(id);
    revalidatePath(ROUTES.admin.rewards);
    revalidatePath(ROUTES.chatter.rewards);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message || "Delete failed." };
  }
}

export async function awardManualPointsAction(
  userId: string,
  points: number,
  reason: string
): Promise<{ success: true } | { success: false; error: string }> {
  const user = await getSessionFromCookies();
  if (!user || (user.role !== "admin" && user.role !== "manager")) {
    return { success: false, error: "Unauthorized" };
  }
  const uid = userId.trim();
  const pts = Math.trunc(Number(points));
  const r = reason.trim();
  if (!uid) return { success: false, error: "Select a chatter." };
  if (!Number.isFinite(pts) || pts === 0) return { success: false, error: "Enter a non-zero number of points." };
  if (!r) return { success: false, error: "Enter a reason." };

  await awardPoints(uid, pts, r, "manual", `manual_${Date.now()}`);
  revalidatePath(ROUTES.admin.rewards);
  revalidatePath(ROUTES.chatter.rewards);
  return { success: true };
}

export async function resetWeeklyLeaderboardCacheAction(
  confirmPhrase: string
): Promise<{ success: true } | { success: false; error: string }> {
  const user = await getSessionFromCookies();
  if (!user || user.role !== "admin") {
    return { success: false, error: "Admin only." };
  }
  if (confirmPhrase.trim() !== "RESET") {
    return { success: false, error: 'Type RESET exactly to confirm.' };
  }
  invalidateLeaderboardPeriodCache("weekly");
  revalidatePath(ROUTES.chatter.rewards);
  return { success: true };
}

export async function checkLevelMigration() {
  "use server";
  if (typeof window === "undefined") {
    await runLevelFromPointsMigrationIfNeeded();
  }
}
