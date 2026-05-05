"use server";

import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { invalidatePointsConfigCache } from "@/services/points-engine";
import { DEFAULT_CONFIG, savePointsConfig, type PointsConfig } from "@/services/points-config";

function mergeConfig(input: Partial<PointsConfig>): PointsConfig {
  const out: Record<keyof PointsConfig, number> = { ...(DEFAULT_CONFIG as unknown as Record<keyof PointsConfig, number>) };
  for (const k of Object.keys(DEFAULT_CONFIG) as (keyof PointsConfig)[]) {
    const v = input[k];
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  }
  out.LEVEL_BRONZE_MIN = 0;
  return out as PointsConfig;
}

export async function saveRewardsConfigAction(
  config: Partial<PointsConfig>
): Promise<{ success: true } | { success: false; error: string }> {
  const user = await getSessionFromCookies();
  if (!user || user.role !== "admin") {
    return { success: false, error: "Unauthorized" };
  }
  await savePointsConfig(mergeConfig(config));
  invalidatePointsConfigCache();
  revalidatePath(ROUTES.admin.rewardsConfig);
  revalidatePath(ROUTES.chatter.rewards);
  revalidatePath(ROUTES.admin.rewards);
  return { success: true };
}
