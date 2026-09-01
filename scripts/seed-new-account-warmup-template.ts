#!/usr/bin/env npx tsx
/**
 * Idempotent seed: "New Account Warm-Up (US)" task template (6 phases).
 *
 * Usage:
 *   npx tsx scripts/seed-new-account-warmup-template.ts
 *   npx tsx scripts/seed-new-account-warmup-template.ts --dry-run
 */
import "dotenv/config";
import {
  countNewAccountWarmupUsItems,
  NEW_ACCOUNT_WARMUP_US_TEMPLATE,
  NEW_ACCOUNT_WARMUP_US_TEMPLATE_NAME,
} from "@/lib/task-template-seeds/new-account-warmup-us";
import { getSupabaseServiceClient } from "@/lib/supabase-server";
import { createTaskTemplate } from "@/services/task-templates-supabase";

const DRY_RUN = process.argv.includes("--dry-run");

function log(msg: string) {
  console.log(`[seed-new-account-warmup-template] ${msg}`);
}

async function main(): Promise<void> {
  const counts = countNewAccountWarmupUsItems();
  log(
    `Template "${NEW_ACCOUNT_WARMUP_US_TEMPLATE_NAME}" — ${NEW_ACCOUNT_WARMUP_US_TEMPLATE.phases?.length ?? 0} phases, ${counts.total} items (stage1=${counts.stage1}, stage2=${counts.stage2}).`,
  );
  log(`Per-phase item counts: ${counts.byPhase.join(", ")}`);

  if (DRY_RUN) {
    log("[dry-run] Skipping Supabase insert.");
    return;
  }

  const sb = getSupabaseServiceClient();
  const { data: existing } = await sb
    .from("task_templates")
    .select("id, template_id, name")
    .eq("name", NEW_ACCOUNT_WARMUP_US_TEMPLATE_NAME)
    .maybeSingle();

  if (existing?.id) {
    log(`Template already exists (${existing.id}, ${existing.template_id}) — skipped.`);
    return;
  }

  const created = await createTaskTemplate(NEW_ACCOUNT_WARMUP_US_TEMPLATE);
  log(`Created template id=${created.id} template_id=${created.template_id}`);
  log(
    `Phases=${created.phases.length}, items=${created.phases.reduce((n, p) => n + p.items.length, 0)}`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
