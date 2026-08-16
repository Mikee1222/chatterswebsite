#!/usr/bin/env tsx
/**
 * Create 4 USA chatting_agency model records and link orphaned credential_entries.
 *
 * Usage:
 *   npx tsx scripts/create-usa-models-and-link-credentials.ts
 *   DRY_RUN=1 npx tsx scripts/create-usa-models-and-link-credentials.ts
 */
import { config as loadEnv } from "dotenv";
import "./_polyfill-websocket";

loadEnv({ path: ".env.production.local", override: true });
loadEnv({ path: ".env.local" });
loadEnv();
process.env.DATA_BACKEND = "supabase";

const USA_MODELS = [
  { model_name: "Silia (USA)" },
  { model_name: "Zhanna Frost" },
  { model_name: "Lina (USA)" },
  { model_name: "Ioanna (USA)" },
] as const;

const CREDENTIAL_LINKS: Record<(typeof USA_MODELS)[number]["model_name"], string[]> = {
  "Silia (USA)": [
    "f390a920-9994-4d68-84ad-04671da47a47",
    "68528ac6-428e-43c3-aa84-155a4015d414",
    "0cde3350-c19b-4d68-8e5d-3f92e131181d",
    "d062cccf-2e63-4652-be89-77f52e5a7cea",
    "a2dde913-5b68-4f4e-b7d5-c6431a2b4a1c",
    "1e42eb36-79bf-41a7-b87a-57cff4904e1c",
    "4a1cb1e0-49ad-4eb0-9c12-6ebb24b9bd53",
  ],
  "Zhanna Frost": ["661c7ee9-7d15-4fb0-b6b0-bfa5fc3c83a3"],
  "Lina (USA)": ["5508e36c-0d33-4ac1-933a-47108ea5dcb2"],
  "Ioanna (USA)": ["f8e274b7-1ca2-409d-8541-389392319fe5"],
};

async function main() {
  const dryRun = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";
  const { createModel, listAllModelss } = await import("../services/modelss");
  const { getSupabaseServiceClient } = await import("../lib/supabase-server");
  const sb = getSupabaseServiceClient();

  console.log("=== Create USA models + link credential_entries ===");
  console.log(dryRun ? "DRY_RUN=1 (no writes)" : "Writing…");

  const existing = await listAllModelss();
  const modelIds = new Map<string, string>();

  for (const spec of USA_MODELS) {
    const found = existing.find((m) => m.model_name === spec.model_name);
    if (found) {
      console.log(`  reuse model: ${spec.model_name} → ${found.id}`);
      modelIds.set(spec.model_name, found.id);
      continue;
    }
    if (dryRun) {
      console.log(`  would create model: ${spec.model_name}`);
      modelIds.set(spec.model_name, `dry-run-${spec.model_name}`);
      continue;
    }
    const created = await createModel({
      model_name: spec.model_name,
      platform: "onlyfans",
      status: "active",
      team: "chatting_agency",
    });
    console.log(`  created model: ${spec.model_name} → ${created.id}`);
    modelIds.set(spec.model_name, created.id);
  }

  let linked = 0;
  for (const [modelName, entryIds] of Object.entries(CREDENTIAL_LINKS)) {
    const modelId = modelIds.get(modelName);
    if (!modelId || modelId.startsWith("dry-run-")) continue;
    for (const entryId of entryIds) {
      if (dryRun) {
        console.log(`  would link ${entryId} → ${modelName} (${modelId})`);
        linked += 1;
        continue;
      }
      const { data, error } = await sb
        .from("credential_entries")
        .update({ model_id: modelId })
        .eq("id", entryId)
        .select("id, label, category, model_id")
        .maybeSingle();
      if (error) throw new Error(`link ${entryId}: ${error.message}`);
      if (!data) throw new Error(`credential entry not found: ${entryId}`);
      console.log(`  linked ${entryId} (${data.label}, ${data.category}) → ${modelName}`);
      linked += 1;
    }
  }

  console.log(`\nModels: ${USA_MODELS.length}, credential links: ${linked}`);

  if (!dryRun) {
    const { data: verify, error: verifyError } = await sb
      .from("credential_entries")
      .select("id, label, category, model_id, modelss(model_name)")
      .in(
        "id",
        Object.values(CREDENTIAL_LINKS).flat(),
      );
    if (verifyError) throw new Error(`verify: ${verifyError.message}`);
    console.log("\n=== Verification ===");
    for (const row of verify ?? []) {
      const modelName =
        row.modelss && typeof row.modelss === "object" && "model_name" in row.modelss
          ? (row.modelss as { model_name: string }).model_name
          : "Unknown";
      console.log(`  ${row.id} | ${row.label} | ${row.category} | ${modelName}`);
    }
    const orphans = (verify ?? []).filter((r) => !r.model_id).length;
    console.log(`\nOrphan entries (null model_id): ${orphans}`);
    console.log("\nNew model UUIDs:");
    for (const spec of USA_MODELS) {
      console.log(`  ${spec.model_name}: ${modelIds.get(spec.model_name)}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
