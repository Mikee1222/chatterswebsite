/**
 * Run full ClarioSuite sync locally — npx tsx scripts/run-clariosuite-sync.ts
 */
import "./_polyfill-websocket";
import { syncClarioSuiteInsights, listLinkedClarioSuiteModels } from "../services/clariosuite-sync";

async function main() {
  const linked = await listLinkedClarioSuiteModels();
  console.log(
    "Linked models:",
    linked.map((l) => `${l.modelName} (${l.igUserId})`).join(", ")
  );
  const result = await syncClarioSuiteInsights();
  console.log(JSON.stringify(result, null, 2));
  if (result.errors.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
