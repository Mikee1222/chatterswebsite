/**
 * Award Rewards points from real Infloww sales (incremental, re-sync safe).
 * Supabase-primary — Infloww stats live only in `infloww_daily_stats`.
 */

import { inflowwReportTodayYmd } from "@/lib/infloww-api";
import { isSupabaseBackend } from "@/lib/data-backend";
import { getSupabaseServiceClient } from "@/lib/supabase-server";
import {
  listUsersWithInflowwEmployeeId,
  queryInflowwDailyStats,
  type LinkedInflowwUser,
} from "@/services/infloww-daily-stats";
import { getCachedPointsConfig } from "@/services/points-engine";
import { awardPoints } from "@/services/points-engine";

const STATE_TABLE = "infloww_sales_points_state";
/** Earliest date we consider for lifetime sales basis (Infloww lookback). */
const SALES_HISTORY_START = "2020-01-01";

export type InflowwSalesPointsResult = {
  usersConsidered: number;
  usersAwarded: number;
  totalPointsAwarded: number;
  errors: Array<{ userId: string; message: string }>;
};

async function getAwardedSales(publicUserId: string): Promise<number> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from(STATE_TABLE)
    .select("awarded_sales")
    .eq("user_id", publicUserId)
    .maybeSingle();
  if (error) throw new Error(`getAwardedSales: ${error.message}`);
  const v = Number(data?.awarded_sales ?? 0);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

async function hasCursorRow(publicUserId: string): Promise<boolean> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from(STATE_TABLE)
    .select("user_id")
    .eq("user_id", publicUserId)
    .maybeSingle();
  if (error) throw new Error(`hasCursorRow: ${error.message}`);
  return Boolean(data?.user_id);
}

async function setAwardedSales(
  publicUserId: string,
  userUuid: string,
  awardedSales: number
): Promise<void> {
  const sb = getSupabaseServiceClient();
  const { error } = await sb.from(STATE_TABLE).upsert(
    {
      user_id: publicUserId,
      user_uuid: userUuid,
      awarded_sales: awardedSales,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) throw new Error(`setAwardedSales: ${error.message}`);
}

/** Lifetime sum of `sales` for a linked user (all performers). */
async function totalLifetimeSales(userUuid: string): Promise<number> {
  const today = inflowwReportTodayYmd();
  const rows = await queryInflowwDailyStats({
    userUuids: [userUuid],
    startYmd: SALES_HISTORY_START,
    endYmd: today,
  });
  let sum = 0;
  for (const r of rows) sum += r.sales;
  return sum;
}

/**
 * True if a ledger row already exists for this sales-bucket reference
 * (any time — stronger than awardPoints' 5-minute window).
 */
async function hasExistingSalesAward(publicUserId: string, referenceId: string): Promise<boolean> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("points_transactions")
    .select("id")
    .eq("user_id", publicUserId)
    .eq("category", "infloww")
    .eq("reference_id", referenceId)
    .limit(1);
  if (error) throw new Error(`hasExistingSalesAward: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

/**
 * Award points for new Infloww sales since the last cursor for one linked user.
 * Skips users without a positive infloww_employee_id (caller should filter).
 */
export async function awardInflowwSalesPointsForUser(
  user: LinkedInflowwUser
): Promise<{ points: number; salesDelta: number }> {
  if (!user.infloww_employee_id || user.infloww_employee_id <= 0) {
    return { points: 0, salesDelta: 0 };
  }

  const config = await getCachedPointsConfig();
  const rate = Math.max(0, Math.floor(Number(config.INFLOWW_SALES_PER_100 ?? 0)));
  if (rate <= 0) return { points: 0, salesDelta: 0 };

  const totalSales = await totalLifetimeSales(user.uuid);
  const previouslyAwarded = await getAwardedSales(user.publicId);

  // Only whole $100 buckets earn points; remainder waits for the next sync.
  const eligibleSales = Math.floor(Math.max(0, totalSales) / 100) * 100;

  // First sighting: baseline cursor to current sales so we don't dump lifetime
  // history as a one-time windfall. Future syncs award only new deltas.
  if (previouslyAwarded <= 0 && !(await hasCursorRow(user.publicId))) {
    await setAwardedSales(user.publicId, user.uuid, eligibleSales);
    return { points: 0, salesDelta: 0 };
  }

  const priorEligible = Math.floor(Math.max(0, previouslyAwarded) / 100) * 100;
  const salesDelta = eligibleSales - priorEligible;

  if (salesDelta < 100) {
    // Keep cursor from drifting below what's already eligible (e.g. after backfill).
    if (eligibleSales > previouslyAwarded) {
      await setAwardedSales(user.publicId, user.uuid, eligibleSales);
    }
    return { points: 0, salesDelta: 0 };
  }

  const buckets = Math.floor(salesDelta / 100);
  const points = buckets * rate;
  const referenceId = `infloww_sales_upto_${eligibleSales}`;

  if (await hasExistingSalesAward(user.publicId, referenceId)) {
    await setAwardedSales(user.publicId, user.uuid, eligibleSales);
    return { points: 0, salesDelta: 0 };
  }

  await awardPoints(
    user.publicId,
    points,
    `Infloww sales (+$${salesDelta.toLocaleString("en-US", { maximumFractionDigits: 0 })})`,
    "infloww",
    referenceId
  );
  await setAwardedSales(user.publicId, user.uuid, eligibleSales);
  return { points, salesDelta };
}

/**
 * After Infloww sync completes: award incremental sales points for linked users.
 * Safe to call on every cron/manual sync — cursor prevents double-count.
 */
export async function awardInflowwSalesPointsAfterSync(params?: {
  /** Limit to these public / uuid user ids (same filter as sync). */
  publicUserIds?: string[];
}): Promise<InflowwSalesPointsResult> {
  const result: InflowwSalesPointsResult = {
    usersConsidered: 0,
    usersAwarded: 0,
    totalPointsAwarded: 0,
    errors: [],
  };

  if (!isSupabaseBackend()) return result;

  try {
    let users = await listUsersWithInflowwEmployeeId();
    if (params?.publicUserIds?.length) {
      const want = new Set(params.publicUserIds.map((x) => x.trim()).filter(Boolean));
      users = users.filter((u) => want.has(u.publicId) || want.has(u.uuid));
    }
    result.usersConsidered = users.length;

    for (const user of users) {
      try {
        const { points } = await awardInflowwSalesPointsForUser(user);
        if (points > 0) {
          result.usersAwarded += 1;
          result.totalPointsAwarded += points;
        }
      } catch (e) {
        result.errors.push({
          userId: user.publicId,
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }
  } catch (e) {
    result.errors.push({
      userId: "*",
      message: e instanceof Error ? e.message : String(e),
    });
  }

  return result;
}
