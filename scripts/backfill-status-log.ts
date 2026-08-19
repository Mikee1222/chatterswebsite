import "@/scripts/_polyfill-websocket";
import { backfillCreatorStatusLog } from "@/services/infloww-creator-status-log";

async function main() {
  console.log("Starting status log backfill from 2026-06-01...");
  const result = await backfillCreatorStatusLog();
  console.log("Result:", JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
