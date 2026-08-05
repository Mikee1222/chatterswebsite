#!/usr/bin/env tsx
/**
 * Backfill modelss.infloww_creator_id from successful fuzzy name / platformPid matches.
 *
 * Usage:
 *   npx tsx scripts/backfill-infloww-creator-ids.ts
 *   DRY_RUN=1 npx tsx scripts/backfill-infloww-creator-ids.ts
 */
import { config as loadEnv } from "dotenv";
import "./_polyfill-websocket";

loadEnv({ path: ".env.production.local", override: true });
loadEnv({ path: ".env.local" });
loadEnv();
process.env.DATA_BACKEND = "supabase";

async function main() {
  const dryRun = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";
  const { getInflowwModels } = await import("../lib/infloww-api");
  const { matchModelsToInflowwCreators } = await import("../services/infloww-creator-earnings");
  const { listAllModelss, updateModel } = await import("../services/modelss");

  const models = await listAllModelss();
  const creators = await getInflowwModels();

  // Match as if no stable ids were set — so we can backfill from fuzzy results
  const stripped = models.map((m) => ({ ...m, infloww_creator_id: null }));
  const { linked, unmatched } = matchModelsToInflowwCreators(stripped, creators);

  console.log("=== Backfill infloww_creator_id ===");
  console.log(`models=${models.length} creators=${creators.length} fuzzy_linked=${linked.length} unmatched=${unmatched.length}`);
  console.log(dryRun ? "DRY_RUN=1 (no writes)" : "Writing updates…");

  let updated = 0;
  let skipped = 0;
  for (const l of linked) {
    const current = models.find((m) => m.id === l.modelRecordId);
    const existing = (current?.infloww_creator_id ?? "").trim();
    if (existing === l.creatorInflowwId) {
      skipped += 1;
      console.log(`  skip ${l.modelName} (already ${l.creatorInflowwId})`);
      continue;
    }
    if (existing && existing !== l.creatorInflowwId) {
      console.log(
        `  skip ${l.modelName} (already set to ${existing}, fuzzy wants ${l.creatorInflowwId})`
      );
      skipped += 1;
      continue;
    }
    console.log(`  set ${l.modelName} → ${l.creatorInflowwId} (${l.creatorName})`);
    if (!dryRun) {
      await updateModel(l.modelRecordId, { infloww_creator_id: l.creatorInflowwId });
    }
    updated += 1;
  }

  console.log(`\nunmatched (${unmatched.length}) — no Infloww creator to link:`);
  for (const m of unmatched) {
    console.log(`  - ${m.model_name} (${m.status}, ${m.team}) of_user_id=${m.of_user_id || "—"}`);
  }

  console.log(`\ndone: updated=${updated} skipped=${skipped}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
