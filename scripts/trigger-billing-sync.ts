#!/usr/bin/env npx tsx
/**
 * One-shot trigger for the Infloww monthly billing sync.
 * Run: npx tsx scripts/trigger-billing-sync.ts
 * Loads .env.production.local for real Infloww credentials.
 */
// Note: run with explicit env vars, e.g.:
// INFLOWW_API_KEY=sk-... INFLOWW_AGENCY_OID=... npx tsx scripts/trigger-billing-sync.ts

import { syncInflowwMonthlyBilling } from "../services/infloww-monthly-billing";

async function main() {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, "0");
  const endTime = `${year}-${month}`;
  const startTime = `${year}-01`;

  console.log(`[billing-sync] Syncing ${startTime} → ${endTime} ...`);
  const result = await syncInflowwMonthlyBilling({ startTime, endTime });
  console.log("[billing-sync] Result:", JSON.stringify(result, null, 2));

  if (result.errors.length > 0) {
    console.error("[billing-sync] Errors:", result.errors);
    process.exit(1);
  }
  console.log(`[billing-sync] ✓ Upserted ${result.upserted} rows`);
}

main().catch((e) => {
  console.error("[billing-sync] FAILED:", e);
  process.exit(1);
});
