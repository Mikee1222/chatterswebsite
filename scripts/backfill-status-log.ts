/**
 * One-shot: backfill Infloww creator status-change-log from 2026-06-01 → now.
 *
 * Usage: npx tsx scripts/backfill-status-log.ts
 */
import { config as loadEnv } from "dotenv";
import "./_polyfill-websocket";

// Prefer production secrets (real Infloww keys); fall back to local.
loadEnv({ path: ".env.production.local", override: true });
loadEnv({ path: ".env.local" });
loadEnv();
process.env.DATA_BACKEND = process.env.DATA_BACKEND || "supabase";

import { backfillCreatorStatusLog } from "@/services/infloww-creator-status-log";

async function main() {
  console.log("Starting status log backfill from 2026-06-01...");
  const result = await backfillCreatorStatusLog();
  console.log("Result:", JSON.stringify(result, null, 2));
  process.exit(result.errors.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
