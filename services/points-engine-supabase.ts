/**
 * Supabase backend for services/points-engine.ts (award path + reads).
 * Does NOT import from points-engine (avoids circular deps).
 */
import {
  publicId,
  sbDeleteByPublicId,
  sbInsert,
  sbSelectAll,
  sbSelectByPublicId,
  sbSelectEq,
  sbUpdateByPublicId,
  type SbRow,
} from "@/lib/supabase-data";
import { addDaysAthensYmd, getTodayYmdAthens } from "@/lib/airtable-datetime";
import { getTimesForShiftType } from "@/lib/weekly-program";
import { getPointsConfig, type PointsConfig } from "@/services/points-config";
import { getSystemSetting, setSystemSetting } from "@/services/system-settings";
import { listAllUsers } from "@/services/users";
import type { Shift, WeeklyProgramShiftType } from "@/types";
import { devLog } from "@/lib/dev-log";
import type {
  AdminPointsLedgerRow,
  ChatterPointsSummaryRow,
  LeaderboardRow,
  PointsTransactionActivity,
} from "./points-engine";

const CHATTER_POINTS = "chatter_points";
const POINTS_TRANSACTIONS = "points_transactions";

type ChatterPointsRow = SbRow & {
  user_id?: string | null;
  total_points?: number | null;
  level?: string | null;
  streak_days?: number | null;
  last_active?: string | null;
  spins_available?: number | null;
};

type PointsTxRow = SbRow & {
  user_id?: string | null;
  points?: number | null;
  reason?: string | null;
  category?: string | null;
  reference_id?: string | null;
  created_at?: string | null;
};

let cachedConfig: PointsConfig | null = null;
let configExpiry = 0;

async function getCachedConfig(): Promise<PointsConfig> {
  if (cachedConfig && Date.now() < configExpiry) return cachedConfig;
  cachedConfig = await getPointsConfig();
  configExpiry = Date.now() + 60_000;
  return cachedConfig;
}

function calculateLevelFromConfig(
  totalPoints: number,
  config: PointsConfig
): "Bronze" | "Silver" | "Gold" | "Diamond" {
  const t = Math.max(0, Math.floor(Number(totalPoints)));
  if (t >= config.LEVEL_DIAMOND_MIN) return "Diamond";
  if (t >= config.LEVEL_GOLD_MIN) return "Gold";
  if (t >= config.LEVEL_SILVER_MIN) return "Silver";
  return "Bronze";
}

async function findChatterPointsRow(userId: string): Promise<ChatterPointsRow | null> {
  const uid = userId.trim();
  if (!uid) return null;
  const rows = await sbSelectEq<ChatterPointsRow>(CHATTER_POINTS, "user_id", uid);
  if (!rows.length) return null;
  rows.sort((a, b) => Number(b.total_points ?? 0) - Number(a.total_points ?? 0));
  return rows[0];
}

async function notifyAfterPointsAwarded(params: {
  userId: string;
  points: number;
  reason: string;
  referenceId?: string;
  prevTotal: number;
  nextTotal: number;
  prevSpins: number;
  nextSpins: number;
  prevLevelStored: string;
  finalLevel: "Bronze" | "Silver" | "Gold" | "Diamond";
}): Promise<void> {
  const { userId, points, reason, referenceId, prevSpins, nextSpins, prevLevelStored, finalLevel } = params;
  if (!userId?.trim()) return;
  const entityId = referenceId?.trim() || userId;
  try {
    const [{ notifyByRoleConfig }, { NOTIFICATION_EVENT }] = await Promise.all([
      import("@/services/notification-service"),
      import("@/lib/notification-types"),
    ]);
    const order = ["Bronze", "Silver", "Gold", "Diamond"] as const;
    if (points > 0) {
      await notifyByRoleConfig(NOTIFICATION_EVENT.POINTS_AWARDED, {
        recipient_mode: "personal_only",
        personal_user_id: userId,
        title: "⭐ Points earned!",
        body: `+${points} pts — ${reason}`,
        entity_type: "points_transaction",
        entity_id: entityId,
      });
    }
    if (order.indexOf(finalLevel) > order.indexOf(prevLevelStored as (typeof order)[number])) {
      await notifyByRoleConfig(NOTIFICATION_EVENT.LEVEL_UP, {
        recipient_mode: "personal_only",
        personal_user_id: userId,
        title: "🚀 Level Up!",
        body: `🚀 You reached ${finalLevel}! Keep it up.`,
        entity_type: "chatter_points",
        entity_id: userId,
      });
    }
    if (nextSpins > prevSpins) {
      await notifyByRoleConfig(NOTIFICATION_EVENT.SPIN_AVAILABLE, {
        recipient_mode: "personal_only",
        personal_user_id: userId,
        title: "🎰 Free Spin Available!",
        body: "🎰 You earned a spin! Head to Rewards to claim your prize.",
        entity_type: "chatter_points",
        entity_id: userId,
      });
    }
  } catch (err) {
    console.error("[points-engine-supabase] notifyAfterPointsAwarded failed", err);
  }
}

export async function awardPoints(
  userId: string,
  points: number,
  reason: string,
  category: string,
  referenceId?: string
): Promise<number> {
  const config = await getCachedConfig();
  const createdAt = new Date().toISOString();
  const todayAthens = getTodayYmdAthens();
  const spinThreshold = Math.max(1, Math.floor(config.POINTS_PER_SPIN));
  const uid = userId.trim();

  const ref = referenceId?.trim() ?? "";
  if (ref) {
    const cutoff = Date.now() - 5 * 60 * 1000;
    const recent = await sbSelectEq<PointsTxRow>(POINTS_TRANSACTIONS, "user_id", uid);
    const dup = recent.find(
      (r) =>
        String(r.reference_id ?? "") === ref &&
        String(r.category ?? "") === category &&
        new Date(String(r.created_at ?? 0)).getTime() > cutoff
    );
    if (dup) {
      const row = await findChatterPointsRow(uid);
      return row ? Math.max(0, Math.floor(Number(row.total_points ?? 0))) : 0;
    }
  }

  await sbInsert<PointsTxRow>(POINTS_TRANSACTIONS, {
    user_id: uid,
    points,
    reason,
    category,
    reference_id: referenceId ?? "",
    created_at: createdAt,
  });

  let row = await findChatterPointsRow(uid);
  if (!row) {
    const newTotal = Math.max(0, Math.floor(points));
    const finalLevel = calculateLevelFromConfig(newTotal, config);
    const spinBump = Math.max(0, Math.floor(newTotal / spinThreshold));
    await sbInsert<ChatterPointsRow>(CHATTER_POINTS, {
      user_id: uid,
      total_points: newTotal,
      level: finalLevel,
      streak_days: 0,
      last_active: todayAthens,
      spins_available: spinBump,
    });
    await notifyAfterPointsAwarded({
      userId: uid,
      points,
      reason,
      referenceId,
      prevTotal: 0,
      nextTotal: newTotal,
      prevSpins: 0,
      nextSpins: spinBump,
      prevLevelStored: "Bronze",
      finalLevel,
    });
    return newTotal;
  }

  const prev = Math.max(0, Math.floor(Number(row.total_points ?? 0)));
  const newTotal = Math.max(0, prev + Math.floor(points));
  const storedLevel = typeof row.level === "string" && row.level.trim() ? String(row.level).trim() : "Bronze";
  const finalLevel = calculateLevelFromConfig(newTotal, config);
  const prevSpins = Math.max(0, Math.floor(Number(row.spins_available ?? 0)));
  const spinBump = Math.max(0, Math.floor(newTotal / spinThreshold) - Math.floor(prev / spinThreshold));

  await sbUpdateByPublicId(CHATTER_POINTS, publicId(row), {
    total_points: newTotal,
    level: finalLevel,
    spins_available: prevSpins + spinBump,
    last_active: todayAthens,
  });

  await notifyAfterPointsAwarded({
    userId: uid,
    points,
    reason,
    referenceId,
    prevTotal: prev,
    nextTotal: newTotal,
    prevSpins,
    nextSpins: prevSpins + spinBump,
    prevLevelStored: storedLevel,
    finalLevel,
  });
  return newTotal;
}

export async function deletePointsTransaction(transactionId: string): Promise<void> {
  const tid = transactionId.trim();
  if (!tid) throw new Error("Missing transaction id");
  const rec = await sbSelectByPublicId<PointsTxRow>(POINTS_TRANSACTIONS, tid);
  if (!rec) throw new Error("Transaction not found");
  const userId = String(rec.user_id ?? "").trim();
  const txPoints = Number.isFinite(Number(rec.points)) ? Math.trunc(Number(rec.points)) : 0;
  if (!userId) throw new Error("Transaction missing user");

  const config = await getCachedConfig();
  const spinThreshold = Math.max(1, Math.floor(config.POINTS_PER_SPIN));
  const row = await findChatterPointsRow(userId);
  if (!row) {
    await sbDeleteByPublicId(POINTS_TRANSACTIONS, tid);
    return;
  }
  const prev = Math.max(0, Math.floor(Number(row.total_points ?? 0)));
  const newTotal = Math.max(0, prev - txPoints);
  const finalLevel = calculateLevelFromConfig(newTotal, config);
  const prevSpins = Math.max(0, Math.floor(Number(row.spins_available ?? 0)));
  const spinReversal = txPoints > 0 && txPoints >= spinThreshold ? 1 : 0;
  await sbUpdateByPublicId(CHATTER_POINTS, publicId(row), {
    total_points: newTotal,
    level: finalLevel,
    spins_available: Math.max(0, prevSpins - spinReversal),
  });
  await sbDeleteByPublicId(POINTS_TRANSACTIONS, tid);
}

export async function consumeOneSpin(
  userId: string
): Promise<{ ok: true; remaining: number } | { ok: false; error: string }> {
  if (!userId.trim()) return { ok: false, error: "Missing user." };
  const row = await findChatterPointsRow(userId);
  if (!row) return { ok: false, error: "No points profile." };
  const spins = Math.max(0, Math.floor(Number(row.spins_available ?? 0)));
  if (spins < 1) return { ok: false, error: "No spins available." };
  const next = spins - 1;
  await sbUpdateByPublicId(CHATTER_POINTS, publicId(row), { spins_available: next });
  return { ok: true, remaining: next };
}

export async function refundOneSpin(userId: string): Promise<void> {
  if (!userId.trim()) return;
  const row = await findChatterPointsRow(userId);
  if (!row) return;
  const spins = Math.max(0, Math.floor(Number(row.spins_available ?? 0)));
  await sbUpdateByPublicId(CHATTER_POINTS, publicId(row), { spins_available: spins + 1 });
}

export async function getChatterPoints(userId: string): Promise<{
  total_points: number;
  level: string;
  streak_days: number;
  spins_available: number;
}> {
  let row = await findChatterPointsRow(userId);
  if (!row) {
    row = await sbInsert<ChatterPointsRow>(CHATTER_POINTS, {
      user_id: userId,
      total_points: 0,
      level: "Bronze",
      streak_days: 0,
      spins_available: 0,
    });
  }
  return {
    total_points: Math.max(0, Math.floor(Number(row.total_points ?? 0))),
    level: typeof row.level === "string" && row.level ? row.level : "Bronze",
    streak_days: Math.max(0, Math.floor(Number(row.streak_days ?? 0))),
    spins_available: Math.max(0, Math.floor(Number(row.spins_available ?? 0))),
  };
}

export async function awardShiftEndPoints(
  shift: Shift,
  shiftRecordId: string,
  chatterUserId: string
): Promise<void> {
  if (!chatterUserId.trim()) return;
  const config = await getCachedConfig();
  const MAX_SHIFT_MINUTES = 16 * 60;
  let minutes: number | null = null;
  if (shift.worked_minutes != null && !Number.isNaN(Number(shift.worked_minutes))) {
    minutes = Math.max(0, Math.floor(Number(shift.worked_minutes)));
  }
  if ((minutes == null || minutes === 0) && shift.start_time) {
    const st = new Date(shift.start_time).getTime();
    const endMs = shift.end_time ? new Date(shift.end_time).getTime() : Date.now();
    if (!Number.isNaN(st) && !Number.isNaN(endMs) && endMs > st) {
      minutes = Math.round((endMs - st) / 60000);
    }
  }
  if (minutes == null || Number.isNaN(minutes)) minutes = 0;
  minutes = Math.min(Math.max(0, minutes), MAX_SHIFT_MINUTES);
  const sched = (shift.scheduled_shift ?? "").trim() as WeeklyProgramShiftType | "";
  const hourPts = Math.max(0, Math.floor((minutes / 60) * config.SHIFT_PER_HOUR));
  if (hourPts !== 0) {
    await awardPoints(chatterUserId, hourPts, `Shift worked (~${minutes} min)`, "shift", shiftRecordId);
  }
  if ((shift.break_minutes ?? 0) === 0) {
    await awardPoints(chatterUserId, config.SHIFT_NO_BREAK_BONUS, "No break taken", "shift", shiftRecordId);
  }
  if (sched === "Night") {
    await awardPoints(chatterUserId, config.SHIFT_NIGHT_BONUS, "Night shift", "shift", shiftRecordId);
  }
  if (shift.date && shift.start_time && (sched === "Morning" || sched === "Night")) {
    try {
      const { start_time: schedStartIso } = getTimesForShiftType(sched, shift.date);
      const actualMs = new Date(shift.start_time).getTime();
      const schedMs = new Date(schedStartIso).getTime();
      if (!Number.isNaN(actualMs) && !Number.isNaN(schedMs)) {
        const deltaMin = (actualMs - schedMs) / 60000;
        if (deltaMin >= -5 && deltaMin <= 5) {
          await awardPoints(chatterUserId, config.SHIFT_ON_TIME, "Started on time", "shift", shiftRecordId);
        }
        if (deltaMin > 10) {
          await awardPoints(
            chatterUserId,
            config.SHIFT_LATE_PENALTY,
            "Started more than 10 min late",
            "penalty",
            shiftRecordId
          );
        }
      }
    } catch {
      /* ignore */
    }
  }
}

const RELATIONSHIP_RANK: Record<string, number> = {
  New: 0, Interested: 1, Angry: 1, "In Love": 3, Simp: 4,
};

export async function maybeAwardWhaleUpdatePoints(
  before: { relationship_status: string; status: string; notes: string },
  after: { relationship_status: string; status: string; notes: string },
  whaleRecordId: string,
  assignedChatterId: string
): Promise<void> {
  if (!assignedChatterId.trim()) return;
  const config = await getCachedConfig();
  const oldR = before.relationship_status;
  const newR = after.relationship_status;
  if (oldR !== newR) {
    const o = RELATIONSHIP_RANK[oldR] ?? 0;
    const n = RELATIONSHIP_RANK[newR] ?? 0;
    if (n > o) {
      if (newR === "Simp" || newR === "In Love") {
        await awardPoints(assignedChatterId, config.WHALE_SIMP_OR_LOVE, `Whale relationship → ${newR}`, "whale", whaleRecordId);
      } else {
        await awardPoints(
          assignedChatterId,
          config.WHALE_STATUS_UPGRADE,
          `Whale relationship upgraded (${oldR} → ${newR})`,
          "whale",
          whaleRecordId
        );
      }
      try {
        const { updateChallengeProgress } = await import("@/services/challenges");
        await updateChallengeProgress(assignedChatterId, "whale_status_upgrades", 1);
      } catch (e) {
        console.error("[challenges] updateChallengeProgress whale_status_upgrades failed", e);
      }
    }
  }
  if ((before.status || "").trim() === "Inactive" && (after.status || "").trim() === "Active") {
    await awardPoints(assignedChatterId, config.WHALE_RETURNED, "Whale returned (active)", "whale", whaleRecordId);
  }
  const oldNotes = (before.notes || "").trim();
  const newNotes = (after.notes || "").trim();
  if (newNotes.length >= oldNotes.length + 60) {
    await awardPoints(assignedChatterId, config.WHALE_NOTE_ADDED, "Whale notes expanded", "whale", whaleRecordId);
  }
}

export async function getRecentPointsTransactions(
  userId: string,
  limit = 10
): Promise<PointsTransactionActivity[]> {
  if (!userId.trim()) return [];
  const rows = await sbSelectEq<PointsTxRow>(POINTS_TRANSACTIONS, "user_id", userId.trim());
  return rows
    .map((r) => ({
      id: publicId(r),
      points: Number.isFinite(Number(r.points)) ? Number(r.points) : 0,
      reason: String(r.reason ?? "").trim() || "—",
      category: String(r.category ?? "").trim(),
      created_at: String(r.created_at ?? "").trim(),
    }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
}

export async function getGlobalRecentPointsLedger(limit = 50): Promise<AdminPointsLedgerRow[]> {
  const cap = Math.min(100, Math.max(1, Math.floor(limit)));
  const [txs, users] = await Promise.all([sbSelectAll<PointsTxRow>(POINTS_TRANSACTIONS), listAllUsers()]);
  const nameById = new Map(
    users.filter((u) => u.role === "chatter").map((u) => [u.id, u.full_name?.trim() || u.id])
  );
  return txs
    .map((r) => {
      const uid = String(r.user_id ?? "").trim();
      return {
        id: publicId(r),
        userId: uid,
        chatterName: nameById.get(uid) ?? uid,
        points: Number.isFinite(Number(r.points)) ? Number(r.points) : 0,
        reason: String(r.reason ?? "").trim() || "—",
        category: String(r.category ?? "").trim(),
        created_at: String(r.created_at ?? "").trim(),
      };
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, cap);
}

export async function getAllChatterPointsSummaries(): Promise<ChatterPointsSummaryRow[]> {
  const [rows, users] = await Promise.all([sbSelectAll<ChatterPointsRow>(CHATTER_POINTS), listAllUsers()]);
  const nameById = new Map(users.map((u) => [u.id, u.full_name?.trim() || u.email || u.id]));
  return rows.map((r) => ({
    userId: String(r.user_id ?? ""),
    userName: nameById.get(String(r.user_id ?? "")) ?? String(r.user_id ?? ""),
    total_points: Number(r.total_points ?? 0),
    level: String(r.level ?? "Bronze"),
    streak_days: Number(r.streak_days ?? 0),
    spins_available: Math.max(0, Math.floor(Number(r.spins_available ?? 0))),
    last_active: String(r.last_active ?? ""),
  }));
}

export async function getLeaderboard(
  period: "weekly" | "monthly" | "alltime" = "alltime"
): Promise<LeaderboardRow[]> {
  void period;
  const [rows, users] = await Promise.all([sbSelectAll<ChatterPointsRow>(CHATTER_POINTS), listAllUsers()]);
  const chatters = users.filter((u) => u.role === "chatter");
  const nameById = new Map(chatters.map((u) => [u.id, u.full_name?.trim() || u.email || u.id]));
  const chatterIds = new Set(chatters.map((u) => u.id));
  return rows
    .filter((r) => chatterIds.has(String(r.user_id ?? "")))
    .map((r) => {
      const uid = String(r.user_id ?? "");
      return {
        userId: uid,
        userName: nameById.get(uid) ?? uid,
        totalPoints: Number(r.total_points ?? 0),
        periodPoints: Number(r.total_points ?? 0),
        level: String(r.level ?? "Bronze"),
        isCurrentUser: false,
      };
    })
    .sort((a, b) => b.totalPoints - a.totalPoints);
}

export async function updateStreak(userId: string): Promise<void> {
  const row = await findChatterPointsRow(userId.trim());
  if (!row) return;
  const today = getTodayYmdAthens();
  const last = String(row.last_active ?? "").slice(0, 10);
  let streak = Math.max(0, Math.floor(Number(row.streak_days ?? 0)));
  if (last === today) return;
  if (last === addDaysAthensYmd(today, -1)) streak += 1;
  else streak = 1;
  await sbUpdateByPublicId(CHATTER_POINTS, publicId(row), { streak_days: streak, last_active: today });
}

export async function runUpdateStreaksForActiveChatters(): Promise<{ processed: number; errors: number }> {
  const users = await listAllUsers();
  const chatters = users.filter((u) => u.role === "chatter");
  let processed = 0;
  let errors = 0;
  for (const u of chatters) {
    try {
      await updateStreak(u.id);
      processed++;
    } catch {
      errors++;
    }
  }
  return { processed, errors };
}

export async function fixAllChatterLevels(): Promise<{ examined: number; updated: number }> {
  const cfg = await getCachedConfig();
  const rows = await sbSelectAll<ChatterPointsRow>(CHATTER_POINTS);
  let updated = 0;
  for (const r of rows) {
    const want = calculateLevelFromConfig(Number(r.total_points ?? 0), cfg);
    if (String(r.level ?? "") !== want) {
      await sbUpdateByPublicId(CHATTER_POINTS, publicId(r), { level: want });
      updated++;
    }
  }
  return { examined: rows.length, updated };
}

export async function runLevelFromPointsMigrationIfNeeded(): Promise<void> {
  const flag = await getSystemSetting("level_from_points_migrated");
  if (flag === "1") return;
  await fixAllChatterLevels();
  await setSystemSetting("level_from_points_migrated", "1", "One-time level-from-points migration");
}
