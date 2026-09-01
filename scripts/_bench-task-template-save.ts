/**
 * Benchmark task template save (updateTaskTemplate with phases).
 * Run: npx tsx scripts/_bench-task-template-save.ts
 */
import { config } from "dotenv";
import "./_polyfill-websocket";
config({ path: ".env" });
config({ path: ".env.local", override: true });
process.env.DATA_BACKEND = "supabase";

const LARGE = "New Account Warm-Up (US) - Days 1-4";
const SMALL = "Daily Marketing Routine";

async function benchTemplate(name: string) {
  const { getAllTaskTemplatesAdmin, getTaskTemplateDetail, updateTaskTemplate } = await import(
    "../services/task-templates"
  );
  const templates = await getAllTaskTemplatesAdmin();
  const rec = templates.find((t) => t.name === name);
  if (!rec) {
    console.log(`SKIP ${name}: not found`);
    return;
  }
  const detail = await getTaskTemplateDetail(rec.id);
  if (!detail) {
    console.log(`SKIP ${name}: detail not found`);
    return;
  }
  const itemCount = detail.phases.reduce((n, p) => n + p.items.length, 0);
  const phasesPayload = detail.phases.map((p, idx) => ({
    phase_number: idx + 1,
    title: p.title,
    description: p.description,
    items: p.items.map((it, i) => ({
      title: it.title,
      description: it.description,
      requires_screenshot: it.requires_screenshot,
      sort_order: i,
      step_type: it.step_type,
    })),
  }));

  const t0 = performance.now();
  await updateTaskTemplate(rec.id, { phases: phasesPayload });
  const ms = Math.round(performance.now() - t0);
  console.log(
    `${name}: ${ms}ms (${detail.phases.length} phases, ${itemCount} items)`
  );
}

async function main() {
  await benchTemplate(SMALL);
  await benchTemplate(LARGE);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
