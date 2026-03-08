"use server";

import { revalidatePath } from "next/cache";
import { ROUTES } from "@/lib/routes";
import { upsertMonthlyTarget } from "@/services/monthly-targets";

export type UpsertMonthlyTargetResult = { success: true } | { success: false; error: string };

export async function upsertMonthlyTargetAction(
  teamMemberRecordId: string,
  teamMemberName: string,
  monthKey: string,
  targetAmountUsd: number,
  options: { notes?: string; is_active?: boolean } = {}
): Promise<UpsertMonthlyTargetResult> {
  if (!teamMemberRecordId?.trim() || !monthKey?.trim()) {
    return { success: false, error: "Team member and month are required" };
  }
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    return { success: false, error: "Month must be YYYY-MM" };
  }
  if (typeof targetAmountUsd !== "number" || targetAmountUsd < 0) {
    return { success: false, error: "Target amount must be a non-negative number" };
  }
  try {
    await upsertMonthlyTarget(teamMemberRecordId, teamMemberName, monthKey, targetAmountUsd, options);
    revalidatePath(ROUTES.admin.home);
    revalidatePath(ROUTES.chatter.home);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
