/**
 * Supabase backend for services/points-debug-audit.ts
 */
import { publicId, sbSelectAll, sbDeleteByPublicId, sbUpdateByPublicId, type SbRow } from "@/lib/supabase-data";
import { getPointsConfig } from "@/services/points-config";
import { finalLevelNoDowngrade } from "@/services/points-engine";
import type { PointsAuditIssue, PointsAuditFixResult } from "./points-debug-audit";

const CHATTER_POINTS = "chatter_points";
const POINTS_TRANSACTIONS = "points_transactions";

type PointsTxRow = SbRow & {
  user_id?: string | null;
  points?: number | null;
  reference_id?: string | null;
  created_at?: string | null;
  category?: string | null;
};

type ChatterPointsRow = SbRow & {
  user_id?: string | null;
  total_points?: number | null;
  level?: string | null;
};

function txSortKey(a: PointsTxRow, b: PointsTxRow): number {
  const ta = String(a.created_at ?? "").trim();
  const tb = String(b.created_at ?? "").trim();
  if (ta !== tb) return ta.localeCompare(tb);
  return publicId(a).localeCompare(publicId(b));
}

export async function runPointsAudit(): Promise<PointsAuditIssue[]> {
  const issues: PointsAuditIssue[] = [];
  let issueSeq = 0;
  const nextId = () => `audit-${++issueSeq}`;

  const cfg = await getPointsConfig();
  const [txs, cps] = await Promise.all([
    sbSelectAll<PointsTxRow>(POINTS_TRANSACTIONS),
    sbSelectAll<ChatterPointsRow>(CHATTER_POINTS),
  ]);

  const byRef = new Map<string, PointsTxRow[]>();
  for (const r of txs) {
    const uid = String(r.user_id ?? "").trim();
    const ref = String(r.reference_id ?? "").trim();
    if (!uid || !ref) continue;
    const key = `${uid}|${ref}`;
    const arr = byRef.get(key);
    if (arr) arr.push(r);
    else byRef.set(key, [r]);
  }

  for (const [, group] of byRef) {
    if (group.length < 2) continue;
    const sorted = [...group].sort(txSortKey);
    const keep = sorted[0];
    const remove = sorted.slice(1).map((x) => publicId(x));
    const uid = String(keep.user_id ?? "").trim();
    issues.push({
      id: nextId(),
      kind: "duplicate_tx",
      message: `Duplicate ledger rows (${group.length}) for user ${uid}, reference_id "${String(keep.reference_id ?? "").slice(0, 80)}…" — would remove ${remove.length} newer row(s).`,
      userId: uid || undefined,
      duplicateRecordIds: remove,
    });
  }

  for (const cp of cps) {
    const uid = String(cp.user_id ?? "").trim();
    if (!uid) continue;
    const total = Number(cp.total_points ?? 0);
    const floorTotal = Math.max(0, Math.floor(Number.isFinite(total) ? total : 0));
    if (total < 0 || !Number.isFinite(total)) {
      issues.push({
        id: nextId(),
        kind: "negative_total",
        message: `Chatter ${uid} has invalid total_points (${String(cp.total_points)}).`,
        userId: uid,
      });
      continue;
    }
    const storedRaw = typeof cp.level === "string" ? cp.level.trim() : "";
    const storedLevel = storedRaw || "Bronze";
    const expected = finalLevelNoDowngrade(storedLevel, floorTotal, cfg);
    if (storedLevel !== expected) {
      issues.push({
        id: nextId(),
        kind: "wrong_level",
        message: `Chatter ${uid}: level "${storedLevel}" does not match expected "${expected}" for ${floorTotal} pts.`,
        userId: uid,
      });
    }
  }

  return issues;
}

export async function applyPointsAuditFixAll(): Promise<PointsAuditFixResult> {
  const errors: string[] = [];
  let deletedLedgerRows = 0;
  let updatedChatterRows = 0;

  const cfg = await getPointsConfig();

  const txs = await sbSelectAll<PointsTxRow>(POINTS_TRANSACTIONS);
  const byRef = new Map<string, PointsTxRow[]>();
  for (const r of txs) {
    const uid = String(r.user_id ?? "").trim();
    const ref = String(r.reference_id ?? "").trim();
    if (!uid || !ref) continue;
    const key = `${uid}|${ref}`;
    const arr = byRef.get(key);
    if (arr) arr.push(r);
    else byRef.set(key, [r]);
  }

  const affected = new Set<string>();
  const toDelete: string[] = [];

  for (const [, group] of byRef) {
    if (group.length < 2) continue;
    const sorted = [...group].sort(txSortKey);
    const uid = String(sorted[0].user_id ?? "").trim();
    if (uid) affected.add(uid);
    for (let i = 1; i < sorted.length; i++) {
      toDelete.push(publicId(sorted[i]));
    }
  }

  const cpsBefore = await sbSelectAll<ChatterPointsRow>(CHATTER_POINTS);
  for (const cp of cpsBefore) {
    const uid = String(cp.user_id ?? "").trim();
    if (!uid) continue;
    const raw = Number(cp.total_points ?? 0);
    if (raw < 0 || !Number.isFinite(raw)) affected.add(uid);
    const floorTotal = Math.max(0, Math.floor(Number.isFinite(raw) ? raw : 0));
    const storedRaw = typeof cp.level === "string" ? cp.level.trim() : "";
    const storedLevel = storedRaw || "Bronze";
    const expected = finalLevelNoDowngrade(storedLevel, floorTotal, cfg);
    if (storedLevel !== expected) affected.add(uid);
  }

  for (const id of toDelete) {
    try {
      await sbDeleteByPublicId(POINTS_TRANSACTIONS, id);
      deletedLedgerRows += 1;
    } catch (e) {
      errors.push(`delete ${id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const txsAfter = await sbSelectAll<PointsTxRow>(POINTS_TRANSACTIONS);
  const sumByUser = new Map<string, number>();
  for (const r of txsAfter) {
    const uid = String(r.user_id ?? "").trim();
    if (!uid) continue;
    const p = Number(r.points ?? 0);
    sumByUser.set(uid, (sumByUser.get(uid) ?? 0) + (Number.isFinite(p) ? p : 0));
  }

  const cps = await sbSelectAll<ChatterPointsRow>(CHATTER_POINTS);
  for (const cp of cps) {
    const uid = String(cp.user_id ?? "").trim();
    if (!uid || !affected.has(uid)) continue;
    const sumRaw = sumByUser.get(uid) ?? 0;
    const newTotal = Math.max(0, Math.floor(Number.isFinite(sumRaw) ? sumRaw : 0));
    const storedRaw = typeof cp.level === "string" ? cp.level.trim() : "";
    const storedLevel = storedRaw || "Bronze";
    const newLevel = finalLevelNoDowngrade(storedLevel, newTotal, cfg);
    const prevTotal = Math.max(0, Math.floor(Number(cp.total_points ?? 0)));
    try {
      if (prevTotal !== newTotal || storedLevel !== newLevel) {
        await sbUpdateByPublicId<ChatterPointsRow>(CHATTER_POINTS, publicId(cp), {
          total_points: newTotal,
          level: newLevel,
        });
        updatedChatterRows += 1;
      }
    } catch (e) {
      errors.push(`update ${uid}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { deletedLedgerRows, updatedChatterRows, errors };
}
