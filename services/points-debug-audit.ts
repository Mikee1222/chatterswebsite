/**
 * Admin-only diagnostics and repair helpers for points data.
 * Does not alter normal award flows; used from server actions behind admin auth.
 */

import { deleteRecord, listAllRecords, updateRecord, type AirtableRecord } from "@/lib/airtable-server";
import { isSupabaseBackend } from "@/lib/data-backend";
import { getPointsConfig } from "@/services/points-config";
import { finalLevelNoDowngrade } from "@/services/points-engine";

const CHATTER_POINTS = "chatter_points";
const POINTS_TRANSACTIONS = "points_transactions";

type PointsTxFields = {
  user_id?: string;
  points?: number;
  reference_id?: string;
  created_at?: string;
  category?: string;
};

type ChatterPointsFields = {
  user_id?: string;
  total_points?: number;
  level?: string;
};

export type PointsAuditIssueKind = "duplicate_tx" | "negative_total" | "wrong_level";

export type PointsAuditIssue = {
  id: string;
  kind: PointsAuditIssueKind;
  message: string;
  userId?: string;
  /** Duplicate rows that would be removed (newest first), excluding the kept row. */
  duplicateRecordIds?: string[];
};

function txSortKey(a: AirtableRecord<PointsTxFields>, b: AirtableRecord<PointsTxFields>): number {
  const ta = String(a.fields?.created_at ?? "").trim();
  const tb = String(b.fields?.created_at ?? "").trim();
  if (ta !== tb) return ta.localeCompare(tb);
  return a.id.localeCompare(b.id);
}

export async function runPointsAudit(): Promise<PointsAuditIssue[]> {
  if (isSupabaseBackend()) return (await import("./points-debug-audit-supabase")).runPointsAudit();
  const issues: PointsAuditIssue[] = [];
  let issueSeq = 0;
  const nextId = () => `audit-${++issueSeq}`;

  const cfg = await getPointsConfig();

  const [txs, cps] = await Promise.all([
    listAllRecords<PointsTxFields>(POINTS_TRANSACTIONS, { _caller: "points-debug-audit.run.loadTx" }),
    listAllRecords<ChatterPointsFields>(CHATTER_POINTS, { _caller: "points-debug-audit.run.loadCp" }),
  ]);

  const byRef = new Map<string, AirtableRecord<PointsTxFields>[]>();
  for (const r of txs) {
    const uid = String(r.fields?.user_id ?? "").trim();
    const ref = String(r.fields?.reference_id ?? "").trim();
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
    const remove = sorted.slice(1).map((x) => x.id);
    const uid = String(keep.fields?.user_id ?? "").trim();
    issues.push({
      id: nextId(),
      kind: "duplicate_tx",
      message: `Duplicate ledger rows (${group.length}) for user ${uid}, reference_id "${String(keep.fields?.reference_id ?? "").slice(0, 80)}…" — would remove ${remove.length} newer row(s).`,
      userId: uid || undefined,
      duplicateRecordIds: remove,
    });
  }

  for (const cp of cps) {
    const uid = String(cp.fields?.user_id ?? "").trim();
    if (!uid) continue;
    const total = Number(cp.fields?.total_points ?? 0);
    const floorTotal = Math.max(0, Math.floor(Number.isFinite(total) ? total : 0));
    if (total < 0 || !Number.isFinite(total)) {
      issues.push({
        id: nextId(),
        kind: "negative_total",
        message: `Chatter ${uid} has invalid total_points (${String(cp.fields?.total_points)}).`,
        userId: uid,
      });
      continue;
    }
    const storedRaw = typeof cp.fields?.level === "string" ? cp.fields.level.trim() : "";
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

export type PointsAuditFixResult = {
  deletedLedgerRows: number;
  updatedChatterRows: number;
  errors: string[];
};

/**
 * Removes duplicate ledger rows (same user_id + non-empty reference_id, keep earliest),
 * then recomputes `total_points` / `level` from the full ledger for every affected chatter.
 */
export async function applyPointsAuditFixAll(): Promise<PointsAuditFixResult> {
  if (isSupabaseBackend()) return (await import("./points-debug-audit-supabase")).applyPointsAuditFixAll();
  const errors: string[] = [];
  let deletedLedgerRows = 0;
  let updatedChatterRows = 0;

  const cfg = await getPointsConfig();

  const txs = await listAllRecords<PointsTxFields>(POINTS_TRANSACTIONS, { _caller: "points-debug-audit.fix.loadTx" });
  const byRef = new Map<string, AirtableRecord<PointsTxFields>[]>();
  for (const r of txs) {
    const uid = String(r.fields?.user_id ?? "").trim();
    const ref = String(r.fields?.reference_id ?? "").trim();
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
    const uid = String(sorted[0].fields?.user_id ?? "").trim();
    if (uid) affected.add(uid);
    for (let i = 1; i < sorted.length; i++) {
      toDelete.push(sorted[i].id);
    }
  }

  const cpsBefore = await listAllRecords<ChatterPointsFields>(CHATTER_POINTS, { _caller: "points-debug-audit.fix.loadCp" });
  for (const cp of cpsBefore) {
    const uid = String(cp.fields?.user_id ?? "").trim();
    if (!uid) continue;
    const raw = Number(cp.fields?.total_points ?? 0);
    if (raw < 0 || !Number.isFinite(raw)) affected.add(uid);
    const floorTotal = Math.max(0, Math.floor(Number.isFinite(raw) ? raw : 0));
    const storedRaw = typeof cp.fields?.level === "string" ? cp.fields.level.trim() : "";
    const storedLevel = storedRaw || "Bronze";
    const expected = finalLevelNoDowngrade(storedLevel, floorTotal, cfg);
    if (storedLevel !== expected) affected.add(uid);
  }

  for (const id of toDelete) {
    try {
      await deleteRecord(POINTS_TRANSACTIONS, id);
      deletedLedgerRows += 1;
    } catch (e) {
      errors.push(`delete ${id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const txsAfter = await listAllRecords<PointsTxFields>(POINTS_TRANSACTIONS, { _caller: "points-debug-audit.fix.reloadTx" });
  const sumByUser = new Map<string, number>();
  for (const r of txsAfter) {
    const uid = String(r.fields?.user_id ?? "").trim();
    if (!uid) continue;
    const p = Number(r.fields?.points ?? 0);
    sumByUser.set(uid, (sumByUser.get(uid) ?? 0) + (Number.isFinite(p) ? p : 0));
  }

  const cps = await listAllRecords<ChatterPointsFields>(CHATTER_POINTS, { _caller: "points-debug-audit.fix.loadCp2" });
  for (const cp of cps) {
    const uid = String(cp.fields?.user_id ?? "").trim();
    if (!uid || !affected.has(uid)) continue;
    const sumRaw = sumByUser.get(uid) ?? 0;
    const newTotal = Math.max(0, Math.floor(Number.isFinite(sumRaw) ? sumRaw : 0));
    const storedRaw = typeof cp.fields?.level === "string" ? cp.fields.level.trim() : "";
    const storedLevel = storedRaw || "Bronze";
    const newLevel = finalLevelNoDowngrade(storedLevel, newTotal, cfg);
    const prevTotal = Math.max(0, Math.floor(Number(cp.fields?.total_points ?? 0)));
    try {
      if (prevTotal !== newTotal || storedLevel !== newLevel) {
        await updateRecord<ChatterPointsFields>(CHATTER_POINTS, cp.id, {
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
