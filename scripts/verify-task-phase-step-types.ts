/**
 * Verify task phase step_type: DB vs service layer vs client normalize.
 * Usage: npx tsx scripts/verify-task-phase-step-types.ts [task_id]
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

import "./_polyfill-websocket";
import { fetchPhasesGroupedByTaskId } from "@/services/task-phases-supabase";
import { normalizeTaskPhasesForClient } from "@/lib/va-task-phases-fetch";
import { DEFAULT_TASK_STEP_TYPE } from "@/lib/task-step-types";

const DEFAULT_TASK_ID = "01a5482e-5c79-44d6-8ac1-79904387f325";
const PHASE_TITLE = "Phase 1 (11am-2pm)";

async function main() {
  const taskId = process.argv[2]?.trim() || DEFAULT_TASK_ID;
  const grouped = await fetchPhasesGroupedByTaskId([taskId]);
  const phases = grouped[taskId] ?? [];
  const phase = phases.find((p) => p.title.includes("Phase 1"));
  if (!phase) {
    console.error("Phase 1 not found on task", taskId);
    process.exit(1);
  }

  const stale = phase.items.map((item) => {
    const { step_type: _drop, ...rest } = item;
    return rest as typeof item;
  });
  const normalized = normalizeTaskPhasesForClient([
    { ...phase, items: stale as typeof phase.items },
  ])[0]!;

  console.log(`\nTask ${taskId} — ${PHASE_TITLE} (${phase.items.length} items)\n`);
  console.log("item | API step_type | stale (no field) UI | normalized UI");
  console.log("---|---|---|---");
  for (const item of [...phase.items].sort((a, b) => a.sort_order - b.sort_order)) {
    const norm = normalized.items.find((i) => i.id === item.id);
    const staleUi = DEFAULT_TASK_STEP_TYPE;
    console.log(
      `${item.title} | ${item.step_type} | ${staleUi} | ${norm?.step_type ?? "?"}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
