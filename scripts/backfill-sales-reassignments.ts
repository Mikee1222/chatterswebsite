#!/usr/bin/env npx tsx
/**
 * Initial 366-day backfill for the Infloww sales reassignment log.
 * Run: INFLOWW_API_KEY=sk-... INFLOWW_AGENCY_OID=... npx tsx scripts/backfill-sales-reassignments.ts
 *
 * The endpoint uses unix-ms range params and is chunked into 31-day windows
 * automatically by fetchReassignedSalesLogForRange().
 */
import { syncSalesReassignments } from "../services/infloww-sales-reassignments";
import { inflowwReportTodayYmd } from "../lib/infloww-api";

function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const endYmd = inflowwReportTodayYmd();
  const startYmd = addDays(endYmd, -365);

  console.log(`[backfill-reassignments] Backfilling ${startYmd} → ${endYmd} (366 days)...`);
  console.log("[backfill-reassignments] This will take a few minutes due to 31-day chunking.");

  const result = await syncSalesReassignments({ startYmd, endYmd });

  console.log("[backfill-reassignments] Done:", JSON.stringify(result, null, 2));

  if (result.errors.length > 0) {
    console.error("[backfill-reassignments] Errors:", result.errors);
    process.exit(1);
  }

  console.log(`[backfill-reassignments] ✓ Upserted ${result.upserted} reassignment rows`);
}

main().catch((e) => {
  console.error("[backfill-reassignments] FAILED:", e);
  process.exit(1);
});
