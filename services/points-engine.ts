import {
  createRecord,
  listRecords,
  updateRecord,
  listAllRecords,
  getRecord,
  deleteRecord,
  type AirtableRecord,
} from "@/lib/airtable-server";
import { addDaysAthensYmd, getTodayYmdAthens } from "@/lib/airtable-datetime";
import { getTimesForShiftType } from "@/lib/weekly-program";
import { getPointsConfig, type PointsConfig } from "@/services/points-config";
import type { Shift, WeeklyProgramShiftType } from "@/types";
import { devLog } from "@/lib/dev-log";

const CHATTER_POINTS = "chatter_points";
const POINTS_TRANSACTIONS = "points_transactions";

let cachedPointsConfig: PointsConfig | null = null;
let pointsConfigCacheExpiry = 0;

/** Runtime + scripts: merged config with 60s in-process cache (invalidate via `invalidatePointsConfigCache`). */
export async function getCachedPointsConfig(): Promise<PointsConfig> {
  if (cachedPointsConfig && Date.now() < pointsConfigCacheExpiry) return cachedPointsConfig;
  cachedPointsConfig = await getPointsConfig();
  pointsConfigCacheExpiry = Date.now() + 60_000;
  return cachedPointsConfig;
}

/** Clears cached points config (call after admin saves rewards config). */
export function invalidatePointsConfigCache(): void {
  cachedPointsConfig = null;
  pointsConfigCacheExpiry = 0;
}

export function levelFloorsFromConfig(config: PointsConfig): Record<"Bronze" | "Silver" | "Gold" | "Diamond", number> {
  return {
    Bronze: Math.max(0, Math.floor(config.LEVEL_BRONZE_MIN)),
    Silver: Math.max(0, Math.floor(config.LEVEL_SILVER_MIN)),
    Gold: Math.max(0, Math.floor(config.LEVEL_GOLD_MIN)),
    Diamond: Math.max(0, Math.floor(config.LEVEL_DIAMOND_MIN)),
  };
}

/**
 * Tier from total points using configured thresholds (sync when config is already loaded).
 * Level follows points and can decrease when points drop.
 */
export function calculateLevelFromConfig(
  totalPoints: number,
  config: PointsConfig
): "Bronze" | "Silver" | "Gold" | "Diamond" {
  const t = Math.max(0, Math.floor(Number(totalPoints)));
  if (t >= config.LEVEL_DIAMOND_MIN) return "Diamond";
  if (t >= config.LEVEL_GOLD_MIN) return "Gold";
  if (t >= config.LEVEL_SILVER_MIN) return "Silver";
  return "Bronze";
}

export async function calculateLevel(totalPoints: number): Promise<"Bronze" | "Silver" | "Gold" | "Diamond"> {
  const cfg = await getCachedPointsConfig();
  return calculateLevelFromConfig(totalPoints, cfg);
}

type ChatterPointsFields = {
  user_id?: string;
  total_points?: number;
  level?: string;
  streak_days?: number;
  last_active?: string;
  spins_available?: number;
};

type PointsTxFields = {
  user_id?: string;
  points?: number;
  reason?: string;
  category?: string;
  reference_id?: string;
  created_at?: string;
};

function escapeFormulaString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * @deprecated Level is derived from points only (`calculateLevelFromConfig`). Kept for a few
 * debug/audit imports; `storedLevel` is ignored.
 */
export function finalLevelNoDowngrade(
  _storedLevel: string,
  totalPoints: number,
  config: PointsConfig
): "Bronze" | "Silver" | "Gold" | "Diamond" {
  return calculateLevelFromConfig(totalPoints, config);
}

function levelRank(level: string): number {
  const order = ["Bronze", "Silver", "Gold", "Diamond"] as const;
  const i = order.indexOf(level as (typeof order)[number]);
  return i >= 0 ? i : 0;
}

/** In-app + push for rewards (non-blocking on failure). */
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
  const { userId, points, reason, referenceId, prevTotal, nextTotal, prevSpins, nextSpins, prevLevelStored, finalLevel } =
    params;
  if (!userId?.trim()) return;
  const entityId = referenceId?.trim() || userId;
  try {
    const [{ notify }, { NOTIFICATION_EVENT }] = await Promise.all([
      import("@/services/notification-service"),
      import("@/lib/notification-types"),
    ]);

    if (points > 0) {
      await notify({
        user_id: userId,
        event_type: NOTIFICATION_EVENT.POINTS_AWARDED,
        title: "⭐ Points earned!",
        body: `+${points} pts — ${reason}`,
        entity_type: "points_transaction",
        entity_id: entityId,
        _triggerSource: "awardPoints",
      });
    }

    if (levelRank(finalLevel) > levelRank(prevLevelStored)) {
      await notify({
        user_id: userId,
        event_type: NOTIFICATION_EVENT.LEVEL_UP,
        title: "🎉 Level up!",
        body: `You reached ${finalLevel}! Keep it up.`,
        entity_type: "chatter_points",
        entity_id: userId,
        _triggerSource: "awardPoints",
      });
    }

    if (nextSpins > prevSpins) {
      await notify({
        user_id: userId,
        event_type: NOTIFICATION_EVENT.SPIN_AVAILABLE,
        title: "🎰 Free spin available!",
        body: "You earned a spin! Go claim your prize.",
        entity_type: "chatter_points",
        entity_id: userId,
        _triggerSource: "awardPoints",
      });
    }
  } catch (e) {
    console.error("[points-engine] notifyAfterPointsAwarded failed", e);
  }
}

function normalizeChatterPointsUserIdField(raw: unknown): string {
  if (raw == null) return "";
  if (typeof raw === "string") return raw.trim();
  if (typeof raw === "number") return String(raw);
  if (Array.isArray(raw)) {
    const first = raw[0];
    if (first != null && typeof first === "object" && "id" in (first as object)) {
      return String((first as { id: string }).id).trim();
    }
    return String(first ?? "").trim();
  }
  if (typeof raw === "object" && "id" in (raw as object)) {
    return String((raw as { id: string }).id).trim();
  }
  return String(raw).trim();
}

function chatterPointsUserIdMatches(fields: ChatterPointsFields | undefined, userId: string): boolean {
  if (!fields || !userId.trim()) return false;
  return normalizeChatterPointsUserIdField(fields.user_id as unknown) === userId.trim();
}

async function findChatterPointsRecord(
  userId: string
): Promise<{ id: string; fields: ChatterPointsFields } | null> {
  const uid = userId.trim();
  if (!uid) return null;
  /**
   * Always scan `chatter_points` (small table): formula equality can miss linked `user_id`,
   * and `listRecords` may return an arbitrary row when duplicates exist — prefer the row with
   * the highest `total_points` so updates/reads stay consistent.
   */
  const all = await listAllRecords<ChatterPointsFields>(CHATTER_POINTS, {
    _caller: "points-engine.findChatterPointsRecord.scan",
  });
  const matches = all.filter((row) => chatterPointsUserIdMatches(row.fields as ChatterPointsFields, uid));
  if (matches.length === 0) return null;
  matches.sort(
    (a, b) =>
      Math.max(0, Math.floor(Number((b.fields as ChatterPointsFields)?.total_points ?? 0))) -
      Math.max(0, Math.floor(Number((a.fields as ChatterPointsFields)?.total_points ?? 0)))
  );
  const hit = matches[0];
  return { id: hit.id, fields: (hit.fields as ChatterPointsFields) ?? {} };
}

/**
 * Creates ledger row, updates chatter totals/level/spins, sets last_active (Athens calendar).
 * @returns New total_points after this award.
 */
export async function awardPoints(
  userId: string,
  points: number,
  reason: string,
  category: string,
  referenceId?: string
): Promise<number> {
  const config = await getCachedPointsConfig();
  const createdAt = new Date().toISOString();
  const todayAthens = getTodayYmdAthens();
  const spinThreshold = Math.max(1, Math.floor(config.POINTS_PER_SPIN));

  const ref = referenceId?.trim() ?? "";
  if (ref) {
    const cutoffIso = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { records: recentDup } = await listRecords<PointsTxFields>(POINTS_TRANSACTIONS, {
      filterByFormula: `AND({user_id} = "${escapeFormulaString(userId)}", {reference_id} = "${escapeFormulaString(ref)}", {category} = "${escapeFormulaString(category)}", IS_AFTER({created_at}, "${escapeFormulaString(cutoffIso)}"))`,
      pageSize: 1,
      _caller: "points-engine.awardPoints.dedupe",
    });
    if (recentDup.length > 0) {
      const row = await findChatterPointsRecord(userId);
      return row ? Math.max(0, Math.floor(Number(row.fields.total_points ?? 0))) : 0;
    }
  }

  await createRecord<PointsTxFields>(POINTS_TRANSACTIONS, {
    user_id: userId,
    points,
    reason,
    category,
    reference_id: referenceId ?? "",
    created_at: createdAt,
  });

  let row = await findChatterPointsRecord(userId);
  if (!row) {
    const newTotal = Math.max(0, Math.floor(points));
    const finalLevel = calculateLevelFromConfig(newTotal, config);
    const spinBump = Math.max(0, Math.floor(newTotal / spinThreshold));
    const created = await createRecord<ChatterPointsFields>(CHATTER_POINTS, {
      user_id: userId,
      total_points: newTotal,
      level: finalLevel,
      streak_days: 0,
      last_active: todayAthens,
      spins_available: spinBump,
    });
    const nextTotal = Math.max(0, Math.floor(Number((created.fields as ChatterPointsFields).total_points ?? newTotal)));
    const nextSpins = spinBump;
  await notifyAfterPointsAwarded({
    userId,
    points,
    reason,
    referenceId,
    prevTotal: 0,
    nextTotal,
    prevSpins: 0,
    nextSpins,
    prevLevelStored: "Bronze",
    finalLevel,
    });
    invalidateLeaderboardCache();
    return nextTotal;
  }

  const prev = Math.max(0, Math.floor(Number(row.fields.total_points ?? 0)));
  const newTotal = Math.max(0, prev + Math.floor(points));
  const storedLevel =
    typeof row.fields.level === "string" && row.fields.level.trim() ? String(row.fields.level).trim() : "Bronze";
  const finalLevel = calculateLevelFromConfig(newTotal, config);
  const prevSpins = Math.max(0, Math.floor(Number(row.fields.spins_available ?? 0)));
  const prevSpinCredits = Math.floor(prev / spinThreshold);
  const nextSpinCredits = Math.floor(newTotal / spinThreshold);
  const spinBump = Math.max(0, nextSpinCredits - prevSpinCredits);

  await updateRecord<ChatterPointsFields>(CHATTER_POINTS, row.id, {
    total_points: newTotal,
    level: finalLevel,
    spins_available: prevSpins + spinBump,
    last_active: todayAthens,
  });

  await notifyAfterPointsAwarded({
    userId,
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

  invalidateLeaderboardCache();
  return newTotal;
}

/**
 * Removes a ledger row and adjusts the chatter’s balance, level, and spins (reversing how `awardPoints` applied this row).
 * Rolls back the balance update if the Airtable delete fails.
 */
export async function deletePointsTransaction(transactionId: string): Promise<void> {
  const tid = transactionId.trim();
  if (!tid) throw new Error("Missing transaction id");

  const rec = await getRecord<PointsTxFields>(POINTS_TRANSACTIONS, tid);
  const f = rec.fields ?? {};
  const userId = String(f.user_id ?? "").trim();
  const txPoints = Number.isFinite(Number(f.points)) ? Math.trunc(Number(f.points)) : 0;
  if (!userId) throw new Error("Transaction missing user");

  const config = await getCachedPointsConfig();
  const spinThreshold = Math.max(1, Math.floor(config.POINTS_PER_SPIN));

  const row = await findChatterPointsRecord(userId);
  if (!row) {
    await deleteRecord(POINTS_TRANSACTIONS, tid);
    invalidateLeaderboardCache();
    return;
  }

  const prev = Math.max(0, Math.floor(Number(row.fields.total_points ?? 0)));
  const newTotal = Math.max(0, prev - txPoints);
  const finalLevel = calculateLevelFromConfig(newTotal, config);
  const prevSpins = Math.max(0, Math.floor(Number(row.fields.spins_available ?? 0)));
  const spinReversal = txPoints > 0 && txPoints >= spinThreshold ? 1 : 0;
  const nextSpins = Math.max(0, prevSpins - spinReversal);

  await updateRecord<ChatterPointsFields>(CHATTER_POINTS, row.id, {
    total_points: newTotal,
    level: finalLevel,
    spins_available: nextSpins,
  });

  try {
    await deleteRecord(POINTS_TRANSACTIONS, tid);
  } catch (e) {
    const prevLevel = calculateLevelFromConfig(prev, config);
    await updateRecord<ChatterPointsFields>(CHATTER_POINTS, row.id, {
      total_points: prev,
      level: prevLevel,
      spins_available: prevSpins,
    });
    throw e;
  }

  invalidateLeaderboardCache();
}

/** Decrement `spins_available` by one when the chatter uses a spin. */
export async function consumeOneSpin(userId: string): Promise<{ ok: true; remaining: number } | { ok: false; error: string }> {
  if (!userId.trim()) return { ok: false, error: "Missing user." };
  const row = await findChatterPointsRecord(userId);
  if (!row) return { ok: false, error: "No points profile." };
  const spins = Math.max(0, Math.floor(Number(row.fields.spins_available ?? 0)));
  if (spins < 1) return { ok: false, error: "No spins available." };
  const next = spins - 1;
  await updateRecord<ChatterPointsFields>(CHATTER_POINTS, row.id, { spins_available: next });
  return { ok: true, remaining: next };
}

/** Undo one spin deduction (e.g. if recording the spin failed). */
export async function refundOneSpin(userId: string): Promise<void> {
  if (!userId.trim()) return;
  const row = await findChatterPointsRecord(userId);
  if (!row) return;
  const spins = Math.max(0, Math.floor(Number(row.fields.spins_available ?? 0)));
  await updateRecord<ChatterPointsFields>(CHATTER_POINTS, row.id, { spins_available: spins + 1 });
}

export async function getChatterPoints(userId: string): Promise<{
  total_points: number;
  level: string;
  streak_days: number;
  spins_available: number;
}> {
  let row = await findChatterPointsRecord(userId);
  if (!row) {
    const created = await createRecord<ChatterPointsFields>(CHATTER_POINTS, {
      user_id: userId,
      total_points: 0,
      level: "Bronze",
      streak_days: 0,
      spins_available: 0,
    });
    row = { id: created.id, fields: created.fields as ChatterPointsFields };
  }
  const f = row.fields;
  return {
    total_points: Math.max(0, Math.floor(Number(f.total_points ?? 0))),
    level: typeof f.level === "string" && f.level ? f.level : "Bronze",
    streak_days: Math.max(0, Math.floor(Number(f.streak_days ?? 0))),
    spins_available: Math.max(0, Math.floor(Number(f.spins_available ?? 0))),
  };
}

/** Award points for a completed chatter shift (hours + bonuses/penalties). */
export async function awardShiftEndPoints(shift: Shift, shiftRecordId: string, chatterUserId: string): Promise<void> {
  if (!chatterUserId.trim()) return;

  const config = await getCachedPointsConfig();

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

  const hours = minutes / 60;
  const hourPts = Math.max(0, Math.floor(hours * config.SHIFT_PER_HOUR));
  if (hourPts !== 0) {
    await awardPoints(
      chatterUserId,
      hourPts,
      `Shift worked (~${minutes} min)`,
      "shift",
      shiftRecordId
    );
  }

  if ((shift.break_minutes ?? 0) === 0) {
    await awardPoints(
      chatterUserId,
      config.SHIFT_NO_BREAK_BONUS,
      "No break taken",
      "shift",
      shiftRecordId
    );
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
      /* custom / invalid shift_type for getTimesForShiftType */
    }
  }
}

const RELATIONSHIP_RANK: Record<string, number> = {
  New: 0,
  Interested: 1,
  Angry: 1,
  "In Love": 3,
  Simp: 4,
};

function relationshipRank(status: string): number {
  return RELATIONSHIP_RANK[status] ?? 0;
}

/** Call after whale update when relationship or status changed (server-side). */
export async function maybeAwardWhaleUpdatePoints(
  before: { relationship_status: string; status: string; notes: string },
  after: { relationship_status: string; status: string; notes: string },
  whaleRecordId: string,
  assignedChatterId: string
): Promise<void> {
  if (!assignedChatterId.trim()) return;

  const config = await getCachedPointsConfig();

  const oldR = before.relationship_status;
  const newR = after.relationship_status;
  if (oldR !== newR) {
    const o = relationshipRank(oldR);
    const n = relationshipRank(newR);
    if (n > o) {
      if (newR === "Simp" || newR === "In Love") {
        await awardPoints(
          assignedChatterId,
          config.WHALE_SIMP_OR_LOVE,
          `Whale relationship → ${newR}`,
          "whale",
          whaleRecordId
        );
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

  const oldS = (before.status || "").trim();
  const newS = (after.status || "").trim();
  if (oldS === "Inactive" && newS === "Active") {
    await awardPoints(assignedChatterId, config.WHALE_RETURNED, "Whale returned (active)", "whale", whaleRecordId);
  }

  const oldNotes = (before.notes || "").trim();
  const newNotes = (after.notes || "").trim();
  if (newNotes.length >= oldNotes.length + 60) {
    await awardPoints(assignedChatterId, config.WHALE_NOTE_ADDED, "Whale notes expanded", "whale", whaleRecordId);
  }
}

/** ISO lower bound for ledger rows (weekly / monthly), Athens-derived window. */
function cutoffIsoForPeriod(period: "weekly" | "monthly" | "alltime"): string | null {
  if (period === "alltime") return null;
  const today = getTodayYmdAthens();
  const days = period === "weekly" ? 7 : 30;
  const startYmd = addDaysAthensYmd(today, -days);
  return `${startYmd}T00:00:00.000Z`;
}

const LEADERBOARD_CACHE_TTL_MS = 5 * 60 * 1000;
let leaderboardCache: { period: string; rows: LeaderboardRow[]; expiresAt: number } | null = null;

function invalidateLeaderboardCache(): void {
  leaderboardCache = null;
}

/** Clears in-memory leaderboard cache for one period (e.g. weekly after admin action). */
export function invalidateLeaderboardPeriodCache(period: "weekly" | "monthly" | "alltime"): void {
  if (leaderboardCache?.period === period) leaderboardCache = null;
}

/** Admin / debug only: clears all in-memory leaderboard caches (every period). */
export function clearLeaderboardCacheAdminDebug(): void {
  leaderboardCache = null;
}

async function listPointsTransactionsForLeaderboard(
  period: "weekly" | "monthly" | "alltime"
): Promise<AirtableRecord<PointsTxFields>[]> {
  const cutoffIso = cutoffIsoForPeriod(period);
  const filter =
    cutoffIso != null
      ? `IS_AFTER({created_at}, "${escapeFormulaString(cutoffIso)}")`
      : undefined;
  const out: AirtableRecord<PointsTxFields>[] = [];
  let offset: string | undefined;
  const pageSize = 100;
  while (true) {
    const page = await listRecords<PointsTxFields>(POINTS_TRANSACTIONS, {
      filterByFormula: filter,
      pageSize,
      offset,
      _caller: "points-engine.getLeaderboard.page",
    });
    out.push(...(page.records as AirtableRecord<PointsTxFields>[]));
    if (!page.offset || page.records.length === 0) break;
    offset = page.offset;
  }
  return out;
}

/** Exclude obvious test / staging chatters from public leaderboard. */
function shouldExcludeChatterFromLeaderboard(f: {
  full_name?: string;
  email?: string;
  status?: string;
}): boolean {
  const status = String(f.status ?? "")
    .toLowerCase()
    .trim();
  if (status === "test" || status === "testing") return true;
  const name = String(f.full_name ?? "").toLowerCase();
  if (/\btest\s+account\b|\[test\]|\(test\)/.test(name)) return true;
  const email = String(f.email ?? "").toLowerCase();
  if (email.includes("@example.") || email.includes("+test")) return true;
  return false;
}

export type LeaderboardRow = {
  userId: string;
  userName: string;
  /** Lifetime balance from `chatter_points.total_points` — primary sort & display. */
  totalPoints: number;
  /** Sum of `points_transactions.points` in the selected period (secondary in UI). */
  periodPoints: number;
  level: string;
  /** Populated when the viewer id is known; otherwise false (client may overwrite). */
  isCurrentUser: boolean;
};

export type PointsTransactionActivity = {
  id: string;
  points: number;
  reason: string;
  category: string;
  created_at: string;
};

/** Last N ledger rows for a user (newest first). */
export async function getRecentPointsTransactions(
  userId: string,
  limit = 10
): Promise<PointsTransactionActivity[]> {
  if (!userId.trim()) return [];
  const { records } = await listRecords<PointsTxFields>(POINTS_TRANSACTIONS, {
    filterByFormula: `{user_id} = "${escapeFormulaString(userId)}"`,
    sort: [{ field: "created_at", direction: "desc" }],
    pageSize: limit,
    _caller: "points-engine.getRecentPointsTransactions",
  });
  return records.map((r) => {
    const f = r.fields ?? {};
    return {
      id: r.id,
      points: Number.isFinite(Number(f.points)) ? Number(f.points) : 0,
      reason: String(f.reason ?? "").trim() || "—",
      category: String(f.category ?? "").trim(),
      created_at: String(f.created_at ?? "").trim(),
    };
  });
}

/** Newest ledger rows across all chatters (admin). */
export async function getGlobalRecentPointsLedger(limit = 50): Promise<AdminPointsLedgerRow[]> {
  const cap = Math.min(100, Math.max(1, Math.floor(limit)));
  const { records } = await listRecords<PointsTxFields>(POINTS_TRANSACTIONS, {
    sort: [{ field: "created_at", direction: "desc" }],
    pageSize: cap,
    _caller: "points-engine.getGlobalRecentPointsLedger",
  });
  const userRecs = await listAllRecords<{ full_name?: string; role?: string }>("users", {
    _caller: "points-engine.getGlobalRecentPointsLedger.users",
  });
  const nameById = new Map<string, string>();
  for (const u of userRecs) {
    if (String(u.fields?.role ?? "").toLowerCase() !== "chatter") continue;
    nameById.set(u.id, String(u.fields?.full_name ?? "").trim() || u.id);
  }
  return records.map((r) => {
    const f = r.fields ?? {};
    const uid = String(f.user_id ?? "").trim();
    return {
      id: r.id,
      userId: uid,
      chatterName: nameById.get(uid) ?? uid,
      points: Number.isFinite(Number(f.points)) ? Number(f.points) : 0,
      reason: String(f.reason ?? "").trim() || "—",
      category: String(f.category ?? "").trim(),
      created_at: String(f.created_at ?? "").trim(),
    };
  });
}

const LEVEL_ORDER = ["Bronze", "Silver", "Gold", "Diamond"] as const;

/** Progress toward the next tier (0–100). At Diamond, pct is 100 and nextLabel is null. */
export function getLevelProgress(
  totalPoints: number,
  level: string,
  config: PointsConfig
): {
  pct: number;
  nextLabel: string | null;
  pointsToNext: number;
  currentFloor: number;
  nextThreshold: number | null;
} {
  const floors = levelFloorsFromConfig(config);
  const t = Math.max(0, Math.floor(totalPoints));
  const normalized = (LEVEL_ORDER as readonly string[]).includes(level) ? level : "Bronze";
  const idx = LEVEL_ORDER.indexOf(normalized as (typeof LEVEL_ORDER)[number]);
  const safeIdx = idx >= 0 ? idx : 0;
  if (safeIdx >= LEVEL_ORDER.length - 1) {
    return {
      pct: 100,
      nextLabel: null,
      pointsToNext: 0,
      currentFloor: floors.Diamond,
      nextThreshold: null,
    };
  }
  const currentFloor = floors[LEVEL_ORDER[safeIdx]];
  const nextThreshold = floors[LEVEL_ORDER[safeIdx + 1]];
  const span = nextThreshold - currentFloor;
  const pct = span <= 0 ? 100 : Math.min(100, Math.max(0, ((t - currentFloor) / span) * 100));
  const pointsToNext = Math.max(0, nextThreshold - t);
  return {
    pct,
    nextLabel: LEVEL_ORDER[safeIdx + 1],
    pointsToNext,
    currentFloor,
    nextThreshold,
  };
}

export type ChatterPointsSummaryRow = {
  userId: string;
  userName: string;
  total_points: number;
  level: string;
  streak_days: number;
  spins_available: number;
  /** Athens calendar YYYY-MM-DD or empty when unknown. */
  last_active: string;
};

export type AdminPointsLedgerRow = {
  id: string;
  userId: string;
  chatterName: string;
  points: number;
  reason: string;
  category: string;
  created_at: string;
};

/** All `chatter_points` rows with chatter display names (admin leaderboard table). */
export async function getAllChatterPointsSummaries(): Promise<ChatterPointsSummaryRow[]> {
  const [cpRows, users, cfg] = await Promise.all([
    listAllRecords<ChatterPointsFields>(CHATTER_POINTS, { _caller: "points-engine.getAllChatterPointsSummaries" }),
    listAllRecords<{ full_name?: string; role?: string }>("users", {}),
    getCachedPointsConfig(),
  ]);
  const nameById = new Map<string, string>();
  for (const u of users) {
    const role = String(u.fields?.role ?? "").toLowerCase();
    if (role !== "chatter") continue;
    nameById.set(u.id, String(u.fields?.full_name ?? "").trim() || u.id);
  }
  const out: ChatterPointsSummaryRow[] = [];
  for (const r of cpRows) {
    const uid = String(r.fields?.user_id ?? "").trim();
    if (!uid) continue;
    const total = Math.max(0, Math.floor(Number(r.fields?.total_points ?? 0)));
    const lastActive = String(r.fields?.last_active ?? "").trim().slice(0, 10);
    out.push({
      userId: uid,
      userName: nameById.get(uid) ?? uid,
      total_points: total,
      level: calculateLevelFromConfig(total, cfg),
      streak_days: Math.max(0, Math.floor(Number(r.fields?.streak_days ?? 0))),
      spins_available: Math.max(0, Math.floor(Number(r.fields?.spins_available ?? 0))),
      last_active: lastActive || "—",
    });
  }
  out.sort((a, b) => b.total_points - a.total_points);
  return out;
}

export async function getLeaderboard(
  period: "weekly" | "monthly" | "alltime"
): Promise<LeaderboardRow[]> {
  const now = Date.now();
  if (leaderboardCache && leaderboardCache.period === period && now < leaderboardCache.expiresAt) {
    return leaderboardCache.rows.map((r) => ({ ...r }));
  }

  const [cpRows, txRecords, userRecs, cfg] = await Promise.all([
    listAllRecords<ChatterPointsFields>(CHATTER_POINTS, { _caller: "points-engine.getLeaderboard.chatter_points" }),
    listPointsTransactionsForLeaderboard(period),
    listAllRecords<{ full_name?: string; email?: string; role?: string; status?: string }>("users", {
      _caller: "points-engine.getLeaderboard.users",
    }),
    getCachedPointsConfig(),
  ]);

  const allowedChatterIds = new Set<string>();
  const nameById = new Map<string, string>();
  for (const u of userRecs) {
    const role = String(u.fields?.role ?? "").toLowerCase();
    if (role !== "chatter") continue;
    if (shouldExcludeChatterFromLeaderboard(u.fields ?? {})) continue;
    allowedChatterIds.add(u.id);
    nameById.set(u.id, String(u.fields?.full_name ?? "").trim() || u.id);
  }

  const periodSumByUser = new Map<string, number>();
  for (const r of txRecords) {
    const uid = normalizeChatterPointsUserIdField(r.fields?.user_id as unknown);
    if (!uid || !allowedChatterIds.has(uid)) continue;
    const p = Number(r.fields?.points ?? 0);
    periodSumByUser.set(uid, (periodSumByUser.get(uid) ?? 0) + (Number.isFinite(p) ? p : 0));
  }

  const rows: LeaderboardRow[] = [];
  for (const r of cpRows) {
    const uid = normalizeChatterPointsUserIdField((r.fields as ChatterPointsFields | undefined)?.user_id as unknown);
    if (!uid || !allowedChatterIds.has(uid)) continue;
    const totalPoints = Math.max(0, Math.floor(Number((r.fields as ChatterPointsFields)?.total_points ?? 0)));
    const periodPoints = periodSumByUser.get(uid) ?? 0;
    rows.push({
      userId: uid,
      userName: nameById.get(uid) ?? uid,
      totalPoints,
      periodPoints,
      level: calculateLevelFromConfig(totalPoints, cfg),
      isCurrentUser: false,
    });
  }

  rows.sort((a, b) => b.totalPoints - a.totalPoints);
  leaderboardCache = { period, rows: rows.map((r) => ({ ...r })), expiresAt: Date.now() + LEADERBOARD_CACHE_TTL_MS };
  return rows.map((r) => ({ ...r }));
}

/**
 * Daily streak maintenance (Athens calendar). Increment if last_active was yesterday; else reset.
 * Awards streak milestones at 5 and 30 days.
 */
export async function updateStreak(userId: string): Promise<void> {
  const row = await findChatterPointsRecord(userId);
  if (!row) return;

  const config = await getCachedPointsConfig();

  /** Streak calendar uses Athens business dates (see `getTodayYmdAthens` / `getNowInAthens` in lib/airtable-datetime). */
  const today = getTodayYmdAthens();
  const yesterday = addDaysAthensYmd(today, -1);
  const last = String(row.fields.last_active ?? "").trim().slice(0, 10);

  let streak = Math.max(0, Math.floor(Number(row.fields.streak_days ?? 0)));
  if (last === yesterday) {
    streak += 1;
  } else {
    streak = 0;
  }

  await updateRecord<ChatterPointsFields>(CHATTER_POINTS, row.id, { streak_days: streak });

  if (last === yesterday) {
    if (streak === 5) {
      await awardPoints(userId, config.STREAK_5_DAYS, "5-day streak", "streak", `streak_5_${today}`);
    } else if (streak === 30) {
      await awardPoints(userId, config.STREAK_30_DAYS, "30-day streak", "streak", `streak_30_${today}`);
    }
  }
}

export async function runUpdateStreaksForActiveChatters(): Promise<{ processed: number; errors: number }> {
  const userRecs = await listAllRecords<{ role?: string; status?: string }>("users", {});
  let processed = 0;
  let errors = 0;
  for (const r of userRecs) {
    const role = String(r.fields?.role ?? "").toLowerCase();
    if (role !== "chatter") continue;
    const st = String(r.fields?.status ?? "").toLowerCase();
    if (st && st !== "active") continue;
    try {
      await updateStreak(r.id);
      processed += 1;
    } catch (e) {
      errors += 1;
      console.error("[points-engine] updateStreak failed", r.id, e);
    }
  }
  return { processed, errors };
}

/** One-time-style migration: align `chatter_points.level` with `total_points` and current thresholds. */
export async function fixAllChatterLevels(): Promise<{ examined: number; updated: number }> {
  const cfg = await getCachedPointsConfig();
  const rows = await listAllRecords<ChatterPointsFields>(CHATTER_POINTS, {
    _caller: "points-engine.fixAllChatterLevels",
  });
  let updated = 0;
  for (const r of rows) {
    const total = Math.max(0, Math.floor(Number(r.fields?.total_points ?? 0)));
    const want = calculateLevelFromConfig(total, cfg);
    const haveRaw =
      typeof r.fields?.level === "string" && r.fields.level.trim() ? String(r.fields.level).trim() : "Bronze";
    if (haveRaw === want) continue;
    await updateRecord<ChatterPointsFields>(CHATTER_POINTS, r.id, { level: want });
    updated += 1;
    devLog("[points-engine] fixAllChatterLevels updated", {
      recordId: r.id,
      user_id: r.fields?.user_id,
      total_points: total,
      from: haveRaw,
      to: want,
    });
  }
  if (updated > 0) invalidateLeaderboardCache();
  devLog("[points-engine] fixAllChatterLevels finished", { examined: rows.length, updated });
  return { examined: rows.length, updated };
}

const LEVEL_FROM_POINTS_MIGRATION_SETTING_KEY = "chatter_points_level_from_total_v1";

type SystemSettingFields = {
  setting_key?: string;
  setting_value?: string;
  description?: string;
};

async function getLevelFromPointsMigrationMarker(): Promise<string | null> {
  const k = escapeFormulaString(LEVEL_FROM_POINTS_MIGRATION_SETTING_KEY);
  const { records } = await listRecords<SystemSettingFields>("system_settings", {
    filterByFormula: `{setting_key} = "${k}"`,
    pageSize: 1,
    _caller: "points-engine.getLevelFromPointsMigrationMarker",
  });
  const v = records[0]?.fields?.setting_value;
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

async function setLevelFromPointsMigrationMarker(value: string): Promise<void> {
  const k = escapeFormulaString(LEVEL_FROM_POINTS_MIGRATION_SETTING_KEY);
  const { records } = await listRecords<SystemSettingFields>("system_settings", {
    filterByFormula: `{setting_key} = "${k}"`,
    pageSize: 1,
    _caller: "points-engine.setLevelFromPointsMigrationMarker",
  });
  if (records[0]?.id) {
    await updateRecord<SystemSettingFields>("system_settings", records[0].id, { setting_value: value });
    return;
  }
  await createRecord<SystemSettingFields>("system_settings", {
    setting_key: LEVEL_FROM_POINTS_MIGRATION_SETTING_KEY,
    setting_value: value,
    description: "Set when chatter_points.level was reconciled from total_points (level can decrease).",
  });
}

/** Boot hook: one row in system_settings prevents re-running across isolates / cold starts. Skipped during `next build`. */
export async function runLevelFromPointsMigrationIfNeeded(): Promise<void> {
  if (process.env.npm_lifecycle_event === "build") return;
  const marker = await getLevelFromPointsMigrationMarker();
  if (marker === "done") return;
  const summary = await fixAllChatterLevels();
  await setLevelFromPointsMigrationMarker("done");
  devLog("[points-engine] level-from-points migration completed and marked done", summary);
}

const LEVEL_DROP_MIGRATION_BOOT_KEY = "__chatterPointsLevelFromPointsBoot2026";

/** Migration touches Airtable — must never run when this module is loaded in the browser bundle. */
if (typeof globalThis !== "undefined" && typeof window === "undefined") {
  const g = globalThis as unknown as Record<string, boolean | undefined>;
  if (!g[LEVEL_DROP_MIGRATION_BOOT_KEY]) {
    g[LEVEL_DROP_MIGRATION_BOOT_KEY] = true;
    void runLevelFromPointsMigrationIfNeeded().catch((err) =>
      console.error("[points-engine] runLevelFromPointsMigrationIfNeeded failed", err)
    );
  }
}
