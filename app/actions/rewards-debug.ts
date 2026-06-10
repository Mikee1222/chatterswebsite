"use server";

import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { listRecords } from "@/lib/airtable-server";
import { getPointsConfig } from "@/services/points-config";
import { awardPoints, clearLeaderboardCacheAdminDebug, finalLevelNoDowngrade } from "@/services/points-engine";
import { applyPointsAuditFixAll, runPointsAudit, type PointsAuditIssue } from "@/services/points-debug-audit";
import { REWARDS_TEST_EVENT_TYPES, type RewardsTestEventType } from "@/lib/rewards-debug-constants";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";

const CHATTER_POINTS = "chatter_points";

function escapeFormulaString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export type SimulateTestPointsResult =
  | {
      success: true;
      pointsAwarded: number;
      previousTotal: number;
      newTotal: number;
      previousLevel: string;
      newLevel: string;
      levelChanged: boolean;
    }
  | { success: false; error: string };

function resolveTestAward(
  eventType: RewardsTestEventType,
  config: Awaited<ReturnType<typeof getPointsConfig>>
): { points: number; category: string } {
  if (eventType === "shift_end") return { points: config.SHIFT_PER_HOUR, category: "shift" };
  if (eventType === "whale_added") return { points: config.WHALE_ADDED, category: "whale" };
  if (eventType === "transaction") return { points: config.WHALE_TRANSACTION, category: "whale" };
  if (eventType === "custom_completed") return { points: config.CUSTOM_COMPLETED, category: "custom" };
  return { points: config.AVAILABILITY_SUBMITTED, category: "streak" };
}

export async function simulateTestPointsAction(
  userId: string,
  eventType: string
): Promise<SimulateTestPointsResult> {
  const user = await getSessionFromCookies();
  if (!user || !(await hasPermission(user, PERMISSIONS.NOTIFICATIONS_DIAGNOSTIC))) {
    return { success: false, error: "Admin only." };
  }
  const uid = userId.trim();
  if (!uid) return { success: false, error: "Select a chatter." };
  if (!(REWARDS_TEST_EVENT_TYPES as readonly string[]).includes(eventType)) {
    return { success: false, error: "Invalid event type." };
  }
  const ev = eventType as RewardsTestEventType;

  const { records: beforeRows } = await listRecords<{ total_points?: number; level?: string }>(CHATTER_POINTS, {
    filterByFormula: `{user_id} = "${escapeFormulaString(uid)}"`,
    pageSize: 1,
    _caller: "rewards-debug.simulate.before",
  });
  const before = beforeRows[0];
  const previousTotal = before
    ? Math.max(0, Math.floor(Number(before.fields?.total_points ?? 0)))
    : 0;
  const previousLevelRaw =
    typeof before?.fields?.level === "string" && String(before.fields.level).trim()
      ? String(before.fields.level).trim()
      : "Bronze";

  const config = await getPointsConfig();
  const { points, category } = resolveTestAward(ev, config);
  const ref = `admin_test_sim:${ev}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;

  const newTotal = await awardPoints(uid, points, "[TEST]", category, ref);

  const pointsCfg = await getPointsConfig();

  const { records: afterRows } = await listRecords<{ level?: string }>(CHATTER_POINTS, {
    filterByFormula: `{user_id} = "${escapeFormulaString(uid)}"`,
    pageSize: 1,
    _caller: "rewards-debug.simulate.after",
  });
  const afterLevelRaw =
    typeof afterRows[0]?.fields?.level === "string" && String(afterRows[0].fields.level).trim()
      ? String(afterRows[0].fields.level).trim()
      : finalLevelNoDowngrade(previousLevelRaw, newTotal, pointsCfg);

  const newLevel = afterLevelRaw;
  const levelChanged = newLevel !== previousLevelRaw;

  revalidatePath(ROUTES.admin.rewardsConfig);
  revalidatePath(ROUTES.admin.rewards);
  revalidatePath(ROUTES.chatter.rewards);

  return {
    success: true,
    pointsAwarded: points,
    previousTotal,
    newTotal,
    previousLevel: previousLevelRaw,
    newLevel,
    levelChanged,
  };
}

export async function runPointsAuditAction(): Promise<
  { success: true; issues: PointsAuditIssue[] } | { success: false; error: string; issues: PointsAuditIssue[] }
> {
  const user = await getSessionFromCookies();
  if (!user || !(await hasPermission(user, PERMISSIONS.NOTIFICATIONS_DIAGNOSTIC))) {
    return { success: false, error: "Admin only.", issues: [] };
  }
  try {
    const issues = await runPointsAudit();
    return { success: true, issues };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Audit failed.";
    return { success: false, error: msg, issues: [] };
  }
}

export async function fixPointsAuditAction(): Promise<
  | { success: true; deletedLedgerRows: number; updatedChatterRows: number; errors: string[] }
  | { success: false; error: string }
> {
  const user = await getSessionFromCookies();
  if (!user || !(await hasPermission(user, PERMISSIONS.NOTIFICATIONS_DIAGNOSTIC))) {
    return { success: false, error: "Admin only." };
  }
  try {
    const result = await applyPointsAuditFixAll();
    clearLeaderboardCacheAdminDebug();
    revalidatePath(ROUTES.admin.rewardsConfig);
    revalidatePath(ROUTES.admin.rewards);
    revalidatePath(ROUTES.chatter.rewards);
    return { success: true, ...result };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fix failed.";
    return { success: false, error: msg };
  }
}

export async function clearLeaderboardCacheDebugAction(): Promise<{ success: true } | { success: false; error: string }> {
  const user = await getSessionFromCookies();
  if (!user || !(await hasPermission(user, PERMISSIONS.NOTIFICATIONS_DIAGNOSTIC))) {
    return { success: false, error: "Admin only." };
  }
  clearLeaderboardCacheAdminDebug();
  revalidatePath(ROUTES.chatter.rewards);
  return { success: true };
}
