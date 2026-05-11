#!/usr/bin/env tsx
/**
 * One-time cleanup: mark active shift_model rows as left when their parent shift
 * is already completed/cancelled.
 *
 * Usage: npx tsx scripts/cleanup-orphaned-shift-models.ts
 */

import { config as loadEnv } from "dotenv";
import { listAllRecords, updateRecord } from "../lib/airtable-server";

loadEnv();
loadEnv({ path: ".env.local" });

type ShiftModelFields = {
  shift?: string | string[];
  model_name?: string;
};

async function run(): Promise<void> {
  const now = new Date().toISOString();

  const shiftModels = await listAllRecords<ShiftModelFields>("shift_models", {
    filterByFormula: `AND({status} = "active", {left_at} = "")`,
    _caller: "cleanup-orphaned-shift-models.shift_models",
  });

  const shifts = await listAllRecords("shifts", {
    filterByFormula: `OR({status} = "completed", {status} = "cancelled")`,
    _caller: "cleanup-orphaned-shift-models.shifts",
  });

  const completedShiftIds = new Set(shifts.map((s) => s.id));

  let fixed = 0;
  for (const sm of shiftModels) {
    const shiftLink = sm.fields.shift;
    const shiftId = Array.isArray(shiftLink) ? shiftLink[0] : null;
    if (!shiftId || !completedShiftIds.has(shiftId)) continue;

    await updateRecord("shift_models", sm.id, {
      left_at: now,
      status: "left",
    });
    console.log(`Fixed orphaned row: ${sm.id} (model: ${sm.fields.model_name ?? "—"})`);
    fixed++;

    await new Promise((r) => setTimeout(r, 100));
  }

  console.log(`Done. Fixed ${fixed} orphaned shift_model rows.`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
