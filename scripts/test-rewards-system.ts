#!/usr/bin/env npx tsx
/**
 * End-to-end rewards tests against real Airtable (uses AIRTABLE_TOKEN + AIRTABLE_BASE_ID from .env).
 *
 *   npx tsx scripts/test-rewards-system.ts
 *   REWARDS_E2E_SKIP_POINTS_CONFIG_WRITE=1 npx tsx scripts/test-rewards-system.ts
 *   npx tsx scripts/test-rewards-system.ts --cleanup
 *
 * `TEST_USER_ID` is a stable marker (logs + user notes). Ledger rows use the Airtable `users` record id
 * for `chatter_points.user_id` / `points_transactions.user_id`, matching production chatters.
 */
import "dotenv/config";

import { addDaysAthensYmd, getTodayYmdAthens } from "@/lib/airtable-datetime";
import {
  createRecord,
  deleteRecord,
  listAllRecords,
  listRecords,
  updateRecord,
  type AirtableRecord,
} from "@/lib/airtable-server";
import {
  awardPoints,
  clearLeaderboardCacheAdminDebug,
  consumeOneSpin,
  getCachedPointsConfig,
  getChatterPoints,
  getLeaderboard,
  invalidatePointsConfigCache,
  refundOneSpin,
  updateStreak,
} from "@/services/points-engine";

const LEVEL_ORDER = ["Bronze", "Silver", "Gold", "Diamond"] as const;
function levelRank(level: string): number {
  const i = (LEVEL_ORDER as readonly string[]).indexOf(level);
  return i >= 0 ? i : 0;
}
import { getPointsConfig, savePointsConfig, type PointsConfig } from "@/services/points-config";
import { getChallengeProgress, updateChallengeProgress } from "@/services/challenges";
import {
  computeSpinRotationDelta,
  getActiveSpinPrizes,
  pickWeightedPrizeIndex,
} from "@/services/spin-wheel";
import { createUser, getUserByEmail } from "@/services/users";

/** Marker string (requested); stored in seeded user `notes`, not as `users.id`. */
const TEST_USER_ID = "TEST_REWARDS_USER";
const TEST_USER_NAME = "Rewards Test Bot";
const TEST_USER_EMAIL = "rewards-e2e-test-rewards-user@internal.test";

const CHATTER_POINTS = "chatter_points";
const POINTS_TRANSACTIONS = "points_transactions";
const CHALLENGES = "challenges";
const CHALLENGE_PROGRESS = "challenge_progress";
const SPIN_WHEEL_SPINS = "spin_wheel_spins";
const USERS = "users";

const CLEANUP_ONLY = process.argv.includes("--cleanup");

/** Resolved `users` record id — all points APIs use this. */
let ledgerUserId = "";

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

type TxFields = {
  user_id?: string;
  points?: number;
  reason?: string;
  category?: string;
  reference_id?: string;
  created_at?: string;
};

type CpFields = {
  user_id?: string;
  total_points?: number;
  level?: string;
  streak_days?: number;
  last_active?: string;
  spins_available?: number;
};

type ChallengeFields = {
  title?: string;
  description?: string;
  target_metric?: string;
  target_value?: number;
  reward_points?: number;
  start_date?: string;
  end_date?: string;
  active?: boolean;
};

const created: { challengeIds: string[]; spinIds: string[] } = { challengeIds: [], spinIds: [] };

async function deletePages(table: string, filterByFormula: string): Promise<number> {
  let n = 0;
  let offset: string | undefined;
  for (;;) {
    const page = await listRecords<{ id: string }>(table, {
      filterByFormula,
      pageSize: 100,
      offset,
      _caller: "test-rewards-system.cleanup",
    });
    for (const r of page.records) {
      await deleteRecord(table, r.id);
      n += 1;
    }
    if (!page.offset) break;
    offset = page.offset;
  }
  return n;
}

async function deleteTestTransactions(): Promise<void> {
  if (!ledgerUserId) return;
  await deletePages(POINTS_TRANSACTIONS, `{user_id} = "${esc(ledgerUserId)}"`);
}

function normalizeCpUserIdRaw(raw: unknown): string {
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
  if (typeof raw === "object" && "id" in (raw as object)) return String((raw as { id: string }).id).trim();
  return String(raw).trim();
}

/** Match `user_id` whether Airtable stores single-line text or a link (array of record ids). */
function cpRowMatchesLedgerUser(fields: CpFields | undefined): boolean {
  if (!ledgerUserId || !fields) return false;
  return normalizeCpUserIdRaw(fields.user_id as unknown) === ledgerUserId;
}

/** Remove every chatter_points row for this ledger user (avoids duplicate profiles from formula mismatch). */
async function wipeAllChatterPointsForLedgerUser(): Promise<void> {
  if (!ledgerUserId) return;
  const rows = await listAllRecords<CpFields>(CHATTER_POINTS, { _caller: "test-rewards-system.wipeCp" });
  for (const r of rows) {
    if (!cpRowMatchesLedgerUser(r.fields as CpFields)) continue;
    try {
      await deleteRecord(CHATTER_POINTS, r.id);
    } catch {
      /* ignore */
    }
  }
}

async function findChatterPointsRow(): Promise<{ id: string; fields: CpFields } | null> {
  if (!ledgerUserId) return null;
  const { records } = await listRecords<CpFields>(CHATTER_POINTS, {
    filterByFormula: `{user_id} = "${esc(ledgerUserId)}"`,
    pageSize: 1,
    _caller: "test-rewards-system.findCp",
  });
  const r = records[0];
  if (r && cpRowMatchesLedgerUser(r.fields as CpFields)) {
    return { id: r.id, fields: (r.fields as CpFields) ?? {} };
  }
  const all = await listAllRecords<CpFields>(CHATTER_POINTS, { _caller: "test-rewards-system.findCpScan" });
  const matches = all.filter((row) => cpRowMatchesLedgerUser(row.fields as CpFields));
  if (matches.length === 0) return null;
  matches.sort(
    (a, b) =>
      Math.max(0, Math.floor(Number((b.fields as CpFields)?.total_points ?? 0))) -
      Math.max(0, Math.floor(Number((a.fields as CpFields)?.total_points ?? 0)))
  );
  const hit = matches[0];
  return { id: hit.id, fields: (hit.fields as CpFields) ?? {} };
}

async function resetChatterPointsProfile(): Promise<string> {
  if (!ledgerUserId) throw new Error("ledgerUserId not set");
  const today = getTodayYmdAthens();
  let row = await findChatterPointsRow();
  if (!row) {
    const createdRow = await createRecord<CpFields>(CHATTER_POINTS, {
      user_id: ledgerUserId,
      total_points: 0,
      level: "Bronze",
      streak_days: 0,
      last_active: today,
      spins_available: 0,
    });
    return createdRow.id;
  }
  await updateRecord<CpFields>(CHATTER_POINTS, row.id, {
    total_points: 0,
    level: "Bronze",
    streak_days: 0,
    last_active: today,
    spins_available: 0,
  });
  return row.id;
}

async function cleanupOrphanChallenges(): Promise<void> {
  const formula = `FIND("E2E Rewards Test", {title})`;
  let offset: string | undefined;
  for (;;) {
    const page = await listRecords<{ id: string }>(CHALLENGES, {
      filterByFormula: formula,
      pageSize: 50,
      offset,
      _caller: "test-rewards-system.cleanupChallenges",
    });
    for (const r of page.records) {
      const id = r.id;
      await deletePages(CHALLENGE_PROGRESS, `{challenge_id} = "${esc(id)}"`);
      try {
        await deleteRecord(CHALLENGES, id);
      } catch {
        /* ignore */
      }
    }
    if (!page.offset) break;
    offset = page.offset;
  }
}

async function cleanupOrphanSpins(): Promise<void> {
  if (!ledgerUserId) return;
  await deletePages(SPIN_WHEEL_SPINS, `{user_id} = "${esc(ledgerUserId)}"`);
}

async function deleteSeededChatterUser(): Promise<void> {
  const u = await getUserByEmail(TEST_USER_EMAIL);
  if (!u) return;
  try {
    await deleteRecord(USERS, u.id);
  } catch {
    /* may fail if FK refs remain */
  }
}

async function cleanupAll(): Promise<void> {
  console.log(
    `[test-rewards-system] cleanup marker=${TEST_USER_ID} ledger_user_id=${ledgerUserId || "(none)"} (${TEST_USER_NAME})…`
  );
  await deleteTestTransactions();
  for (const cid of created.challengeIds) {
    await deletePages(CHALLENGE_PROGRESS, `{challenge_id} = "${esc(cid)}"`);
    try {
      await deleteRecord(CHALLENGES, cid);
    } catch {
      /* ignore */
    }
  }
  created.challengeIds.length = 0;
  for (const sid of created.spinIds) {
    try {
      await deleteRecord(SPIN_WHEEL_SPINS, sid);
    } catch {
      /* ignore */
    }
  }
  created.spinIds.length = 0;
  await cleanupOrphanChallenges();
  await cleanupOrphanSpins();
  const row = await findChatterPointsRow();
  if (row) {
    try {
      await deleteRecord(CHATTER_POINTS, row.id);
    } catch {
      /* ignore */
    }
  }
  await deleteSeededChatterUser();
  invalidatePointsConfigCache();
  clearLeaderboardCacheAdminDebug();
  console.log("[test-rewards-system] cleanup done.");
}

async function resolveLedgerUserId(opts: { createIfMissing: boolean }): Promise<void> {
  const existing = await getUserByEmail(TEST_USER_EMAIL);
  if (existing) {
    ledgerUserId = existing.id;
    return;
  }
  if (!opts.createIfMissing) {
    ledgerUserId = "";
    return;
  }
  const u = await createUser({
    full_name: TEST_USER_NAME,
    email: TEST_USER_EMAIL,
    role: "chatter",
    status: "active",
    can_login: false,
    notes: `rewards_e2e_marker=${TEST_USER_ID}`,
  });
  ledgerUserId = u.id;
}

type TestResult = { name: string; ok: boolean; error?: string };

async function runSpinWheelLikeAction(userId: string): Promise<
  | { success: true; prize: { label: string; prize_type: string }; spinRecordId: string; rotationDelta: number }
  | { success: false; error: string }
> {
  const prizes = await getActiveSpinPrizes();
  if (prizes.length === 0) return { success: false, error: "No prizes configured." };
  const consumed = await consumeOneSpin(userId);
  if (!consumed.ok) return { success: false, error: consumed.error ?? "consumeOneSpin failed" };
  const winIndex = pickWeightedPrizeIndex(prizes);
  const prize = prizes[winIndex];
  const rotationDelta = computeSpinRotationDelta(winIndex, prizes.length);
  const claimed = prize.prize_type !== "cash" && prize.prize_type !== "extra_break";
  let spinRec: AirtableRecord<Record<string, unknown>>;
  try {
    spinRec = await createRecord(SPIN_WHEEL_SPINS, {
      user_id: userId,
      prize_id: prize.id,
      prize_label: prize.label,
      created_at: new Date().toISOString(),
      claimed,
    });
  } catch (e) {
    await refundOneSpin(userId);
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
  try {
    if (prize.prize_type === "points") {
      const pts = Math.max(0, Math.floor(Number.parseFloat(prize.prize_value) || 0));
      if (pts > 0) {
        await awardPoints(userId, pts, `Spin wheel: ${prize.label}`, "spin", spinRec.id);
      }
    }
  } catch (e) {
    console.error("[test-rewards-system] spin bonus awardPoints failed (non-fatal for spin record)", e);
  }
  return {
    success: true,
    prize: { label: prize.label, prize_type: prize.prize_type },
    spinRecordId: spinRec.id,
    rotationDelta,
  };
}

async function main(): Promise<void> {
  if (!process.env.AIRTABLE_TOKEN?.trim() || !process.env.AIRTABLE_BASE_ID?.trim()) {
    console.error("Set AIRTABLE_TOKEN and AIRTABLE_BASE_ID in .env");
    process.exit(1);
  }

  if (CLEANUP_ONLY) {
    await resolveLedgerUserId({ createIfMissing: false });
    await cleanupAll();
    process.exit(0);
  }

  const results: TestResult[] = [];
  let originalWhaleAdded: number | null = null;

  const push = (name: string, ok: boolean, error?: string) => {
    results.push({ name, ok, error });
    console.log(ok ? `✅ PASS — ${name}` : `❌ FAIL — ${name}${error ? `: ${error}` : ""}`);
  };

  try {
    await resolveLedgerUserId({ createIfMissing: true });
    console.log(
      `[test-rewards-system] BEFORE ALL: marker=${TEST_USER_ID} | ledger user_id=${ledgerUserId} (${TEST_USER_NAME})`
    );
    await deleteTestTransactions();
    await wipeAllChatterPointsForLedgerUser();
    await resetChatterPointsProfile();
    invalidatePointsConfigCache();
    clearLeaderboardCacheAdminDebug();

    const pointsCfg = await getPointsConfig();

    // —— 1. awardPoints basic ——
    try {
      const before = await getChatterPoints(ledgerUserId);
      if (before.total_points !== 0) throw new Error(`expected 0 pts before test 1, got ${before.total_points}`);
      const total = await awardPoints(ledgerUserId, 100, "test", "manual");
      if (total !== 100) throw new Error(`total_points expected 100, got ${total}`);
      const cp = await getChatterPoints(ledgerUserId);
      if (cp.level !== "Bronze") throw new Error(`level expected Bronze, got ${cp.level}`);
      const { records: txs } = await listRecords<TxFields>(POINTS_TRANSACTIONS, {
        filterByFormula: `AND({user_id} = "${esc(ledgerUserId)}", {reason} = "test")`,
        sort: [{ field: "created_at", direction: "desc" }],
        pageSize: 5,
        _caller: "test-rewards-system.t1",
      });
      const t = txs[0];
      if (!t?.fields) throw new Error("no points_transaction for reason=test");
      if (Number(t.fields.points) !== 100) throw new Error(`tx points ${t.fields.points}`);
      if (String(t.fields.category) !== "manual") throw new Error(`tx category ${t.fields.category}`);
      push("1. awardPoints basic", true);
    } catch (e) {
      push("1. awardPoints basic", false, e instanceof Error ? e.message : String(e));
    }

    // —— 2. Level up Bronze → Silver ——
    try {
      const before2 = await getChatterPoints(ledgerUserId);
      const deltaSilver = Math.max(0, pointsCfg.LEVEL_SILVER_MIN - before2.total_points);
      await awardPoints(ledgerUserId, deltaSilver, "test silver", "manual");
      const cp = await getChatterPoints(ledgerUserId);
      if (cp.total_points !== pointsCfg.LEVEL_SILVER_MIN) throw new Error(`total ${cp.total_points} want ${pointsCfg.LEVEL_SILVER_MIN}`);
      if (levelRank(cp.level) < levelRank("Silver")) {
        throw new Error(`level ${cp.level} at ${cp.total_points} pts (need ≥ Silver for LEVEL_SILVER_MIN=${pointsCfg.LEVEL_SILVER_MIN})`);
      }
      console.log(
        "[test-rewards-system] (log only) level-up path runs notify in awardPoints; failures are swallowed in engine."
      );
      push("2. Level up Bronze → Silver", true);
    } catch (e) {
      push("2. Level up Bronze → Silver", false, e instanceof Error ? e.message : String(e));
    }

    // —— 3. Points floor ——
    try {
      const row3 = await findChatterPointsRow();
      if (!row3) throw new Error("no chatter_points");
      await updateRecord<CpFields>(CHATTER_POINTS, row3.id, { total_points: 100, level: "Bronze" });
      await awardPoints(ledgerUserId, -600, "floor test", "manual");
      const cp = await getChatterPoints(ledgerUserId);
      if (cp.total_points !== 0) throw new Error(`expected 0 pts floor, got ${cp.total_points}`);
      push("3. Points floor", true);
    } catch (e) {
      push("3. Points floor", false, e instanceof Error ? e.message : String(e));
    }

    // —— 4. Level never drops ——
    try {
      const base4 = await getChatterPoints(ledgerUserId);
      const deltaGold = Math.max(0, pointsCfg.LEVEL_GOLD_MIN - base4.total_points);
      await awardPoints(ledgerUserId, deltaGold, "to gold", "manual");
      const cp1 = await getChatterPoints(ledgerUserId);
      if (levelRank(cp1.level) < levelRank("Gold")) {
        throw new Error(`expected ≥ Gold, got ${cp1.level} at ${cp1.total_points} (LEVEL_GOLD_MIN=${pointsCfg.LEVEL_GOLD_MIN})`);
      }
      await awardPoints(ledgerUserId, -1000, "penalty", "manual");
      const cp2 = await getChatterPoints(ledgerUserId);
      const expectedPts = Math.max(0, cp1.total_points - 1000);
      if (cp2.total_points !== expectedPts) throw new Error(`pts ${cp2.total_points} want ${expectedPts}`);
      if (levelRank(cp2.level) < levelRank("Gold")) throw new Error(`level should stay ≥ Gold, got ${cp2.level}`);
      push("4. Level never drops", true);
    } catch (e) {
      push("4. Level never drops", false, e instanceof Error ? e.message : String(e));
    }

    // —— 5. Spin unlock ——
    try {
      const row = await findChatterPointsRow();
      if (!row) throw new Error("no chatter_points");
      await updateRecord<CpFields>(CHATTER_POINTS, row.id, {
        total_points: 0,
        level: "Bronze",
        spins_available: 0,
        streak_days: 0,
      });
      await deleteTestTransactions();
      const spinTh = Math.max(1, pointsCfg.POINTS_PER_SPIN);
      await awardPoints(ledgerUserId, spinTh, "spin half", "manual");
      let cp = await getChatterPoints(ledgerUserId);
      if (cp.spins_available !== 1) throw new Error(`spins ${cp.spins_available}`);
      await awardPoints(ledgerUserId, spinTh, "spin half 2", "manual");
      cp = await getChatterPoints(ledgerUserId);
      if (cp.spins_available !== 2) throw new Error(`spins ${cp.spins_available}`);
      push("5. Spin unlock", true);
    } catch (e) {
      push("5. Spin unlock", false, e instanceof Error ? e.message : String(e));
    }

    // —— 6. Idempotency ——
    try {
      const row = await findChatterPointsRow();
      if (!row) throw new Error("no chatter_points");
      await updateRecord<CpFields>(CHATTER_POINTS, row.id, { total_points: 100, spins_available: 0 });
      await deletePages(POINTS_TRANSACTIONS, `AND({user_id} = "${esc(ledgerUserId)}", {reference_id} = "test-ref-123")`);
      const t0 = await getChatterPoints(ledgerUserId);
      await awardPoints(ledgerUserId, 50, "idem", "shift", "test-ref-123");
      await awardPoints(ledgerUserId, 50, "idem dup", "shift", "test-ref-123");
      const t1 = await getChatterPoints(ledgerUserId);
      if (t1.total_points !== t0.total_points + 50) throw new Error(`expected +50 only, ${t0.total_points} → ${t1.total_points}`);
      push("6. Idempotency (referenceId)", true);
    } catch (e) {
      push("6. Idempotency (referenceId)", false, e instanceof Error ? e.message : String(e));
    }

    // —— 7. Streak: increment when last_active was yesterday ——
    try {
      const row = await findChatterPointsRow();
      if (!row) throw new Error("no chatter_points");
      const today = getTodayYmdAthens();
      const yesterday = addDaysAthensYmd(today, -1);
      await updateRecord<CpFields>(CHATTER_POINTS, row.id, {
        last_active: yesterday,
        streak_days: 4,
      });
      await updateStreak(ledgerUserId);
      const cp = await getChatterPoints(ledgerUserId);
      if (cp.streak_days !== 5) throw new Error(`expected streak 5 (yesterday → +1), got ${cp.streak_days}`);
      push("7. Streak increment (last_active was yesterday)", true);
    } catch (e) {
      push("7. Streak increment (last_active was yesterday)", false, e instanceof Error ? e.message : String(e));
    }

    // —— 8. Streak broken ——
    try {
      const row = await findChatterPointsRow();
      if (!row) throw new Error("no chatter_points");
      const today = getTodayYmdAthens();
      const old = addDaysAthensYmd(today, -3);
      await updateRecord<CpFields>(CHATTER_POINTS, row.id, {
        last_active: old,
        streak_days: 7,
      });
      await updateStreak(ledgerUserId);
      const cp = await getChatterPoints(ledgerUserId);
      if (cp.streak_days !== 0) throw new Error(`expected 0, got ${cp.streak_days}`);
      push("8. Streak broken (last_active 3+ days ago)", true);
    } catch (e) {
      push("8. Streak broken (last_active 3+ days ago)", false, e instanceof Error ? e.message : String(e));
    }

    // —— 9. Challenge progress ——
    try {
      const today = getTodayYmdAthens();
      const start = addDaysAthensYmd(today, -1);
      const end = addDaysAthensYmd(today, 30);
      const ch = await createRecord<ChallengeFields>(CHALLENGES, {
        title: `E2E Rewards Test ${Date.now()}`,
        description: "Automated test challenge",
        target_metric: "transactions",
        target_value: 3,
        reward_points: 100,
        start_date: start,
        end_date: end,
        active: true,
      });
      created.challengeIds.push(ch.id);

      const ptsBefore = (await getChatterPoints(ledgerUserId)).total_points;
      await updateChallengeProgress(ledgerUserId, "transactions", 1);
      await sleep(1100);
      await updateChallengeProgress(ledgerUserId, "transactions", 1);
      await sleep(1100);
      await updateChallengeProgress(ledgerUserId, "transactions", 1);

      const prog = await getChallengeProgress(ledgerUserId, ch.id);
      if (!prog) throw new Error("no challenge_progress");
      if (prog.current_value !== 3) throw new Error(`challenge_progress.current_value ${prog.current_value}`);
      if (!prog.completed) throw new Error("challenge_progress.completed not true");
      const ptsAfter = (await getChatterPoints(ledgerUserId)).total_points;
      if (ptsAfter < ptsBefore + 100) throw new Error(`reward not applied: ${ptsBefore} → ${ptsAfter}`);
      push("9. Challenge progress + reward", true);
    } catch (e) {
      push("9. Challenge progress + reward", false, e instanceof Error ? e.message : String(e));
    }

    // —— 10. Leaderboard ——
    try {
      clearLeaderboardCacheAdminDebug();
      const rows = await getLeaderboard("weekly");
      if (!Array.isArray(rows)) throw new Error("not array");
      for (const r of rows) {
        if (typeof (r as { userId?: string }).userId !== "string") throw new Error("row missing userId");
        if (typeof (r as { points?: number }).points !== "number") throw new Error("row missing points");
        if (typeof (r as { level?: string }).level !== "string") throw new Error("row missing level");
      }
      push("10. Leaderboard weekly", true);
    } catch (e) {
      push("10. Leaderboard weekly", false, e instanceof Error ? e.message : String(e));
    }

    // —— 11. Points config + cache ——
    try {
      if (process.env.REWARDS_E2E_SKIP_POINTS_CONFIG_WRITE === "1") {
        const cfg0 = await getPointsConfig();
        if (typeof cfg0.SHIFT_PER_HOUR !== "number" || typeof cfg0.WHALE_ADDED !== "number") {
          throw new Error("getPointsConfig missing expected keys");
        }
        invalidatePointsConfigCache();
        const cached = await getCachedPointsConfig();
        if (typeof cached.WHALE_ADDED !== "number") throw new Error("getCachedPointsConfig broken");
        push("11. Points config + cache (read-only; REWARDS_E2E_SKIP_POINTS_CONFIG_WRITE=1)", true);
      } else {
        const cfg0 = await getPointsConfig();
        for (const k of ["SHIFT_PER_HOUR", "WHALE_ADDED"] as const) {
          if (typeof (cfg0 as Record<string, number>)[k] !== "number") throw new Error(`missing ${k}`);
        }
        originalWhaleAdded = cfg0.WHALE_ADDED;
        const patched: PointsConfig = { ...cfg0, WHALE_ADDED: 999 };
        await savePointsConfig(patched);
        invalidatePointsConfigCache();
        const disk = await getPointsConfig();
        if (disk.WHALE_ADDED !== 999) {
          throw new Error(
            `persist failed: WHALE_ADDED on disk is ${disk.WHALE_ADDED} (expected 999). Grant write on system_settings or set REWARDS_E2E_SKIP_POINTS_CONFIG_WRITE=1 for a read-only check.`
          );
        }
        const cached = await getCachedPointsConfig();
        if (cached.WHALE_ADDED !== 999) throw new Error(`cached WHALE_ADDED ${cached.WHALE_ADDED}`);
        push("11. Points config + cache invalidate", true);
      }
    } catch (e) {
      push("11. Points config + cache invalidate", false, e instanceof Error ? e.message : String(e));
    } finally {
      if (originalWhaleAdded != null) {
        const cur = await getPointsConfig();
        await savePointsConfig({ ...cur, WHALE_ADDED: originalWhaleAdded });
        invalidatePointsConfigCache();
      }
    }

    // —— 12. Spin wheel (mirrors app action; no browser session) ——
    try {
      const row = await findChatterPointsRow();
      if (!row) throw new Error("no chatter_points");
      await updateRecord<CpFields>(CHATTER_POINTS, row.id, { spins_available: 1 });
      const spin = await runSpinWheelLikeAction(ledgerUserId);
      if (!spin.success) throw new Error(spin.error);
      if (!spin.prize.label || !spin.prize.prize_type) throw new Error("prize shape");
      created.spinIds.push(spin.spinRecordId);
      const cp = await getChatterPoints(ledgerUserId);
      if (cp.spins_available !== 0) throw new Error(`spins_available expected 0, got ${cp.spins_available}`);
      const { records: spinRows } = await listRecords<{ id: string }>(SPIN_WHEEL_SPINS, {
        filterByFormula: `{user_id} = "${esc(ledgerUserId)}"`,
        pageSize: 10,
        sort: [{ field: "created_at", direction: "desc" }],
        _caller: "test-rewards-system.t12",
      });
      if (!spinRows.some((r) => r.id === spin.spinRecordId)) throw new Error("spin record not found");
      push("12. Spin wheel", true);
    } catch (e) {
      push("12. Spin wheel", false, e instanceof Error ? e.message : String(e));
    }
  } finally {
    console.log("\n[test-rewards-system] AFTER ALL: removing test data…");
    await cleanupAll();
    ledgerUserId = "";
  }

  const passed = results.filter((r) => r.ok).length;
  const total = results.length;
  console.log(`\nTotal: ${passed}/${total} passed`);
  if (passed < total) {
    for (const r of results.filter((x) => !x.ok)) {
      console.error(`Failure detail — ${r.name}: ${r.error ?? "unknown"}`);
    }
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
