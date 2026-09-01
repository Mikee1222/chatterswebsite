#!/usr/bin/env npx tsx
/**
 * Idempotent seed: split New Account Warm-Up (US) task templates (Days 1-4 + Days 4-7).
 *
 * Usage:
 *   npx tsx scripts/seed-new-account-warmup-template.ts
 *   npx tsx scripts/seed-new-account-warmup-template.ts --dry-run
 */
import "dotenv/config";
import {
  countAllNewAccountWarmupUsItems,
  countNewAccountWarmupUsItems,
  NEW_ACCOUNT_WARMUP_US_LEGACY_TEMPLATE_NAME,
  NEW_ACCOUNT_WARMUP_US_TEMPLATES,
} from "@/lib/task-template-seeds/new-account-warmup-us";
import { getSupabaseServiceClient } from "@/lib/supabase-server";
import { createTaskTemplate } from "@/services/task-templates-supabase";

const DRY_RUN = process.argv.includes("--dry-run");

function log(msg: string) {
  console.log(`[seed-new-account-warmup-template] ${msg}`);
}

async function removeLegacyCombinedTemplate(sb: ReturnType<typeof getSupabaseServiceClient>): Promise<string | null> {
  const { data: legacy } = await sb
    .from("task_templates")
    .select("id, template_id, name")
    .eq("name", NEW_ACCOUNT_WARMUP_US_LEGACY_TEMPLATE_NAME)
    .maybeSingle();

  if (!legacy?.id) return null;

  const { data: phases } = await sb
    .from("task_template_phases")
    .select("id")
    .contains("template", [legacy.id]);

  const phaseIds = (phases ?? []).map((p) => p.id);
  if (phaseIds.length > 0) {
    for (const phaseId of phaseIds) {
      await sb.from("task_template_items").delete().contains("phase_template", [phaseId]);
    }
    await sb.from("task_template_phases").delete().in("id", phaseIds);
  }

  await sb.from("task_templates").delete().eq("id", legacy.id);
  log(`Removed legacy combined template (${legacy.id}, ${legacy.template_id}).`);
  return legacy.id;
}

async function main(): Promise<void> {
  const counts = countAllNewAccountWarmupUsItems();
  for (const template of NEW_ACCOUNT_WARMUP_US_TEMPLATES) {
    const c = countNewAccountWarmupUsItems(template);
    log(
      `Template "${template.name}" — ${template.phases?.length ?? 0} phases, ${c.total} items (per-phase: ${c.byPhase.join(", ")}).`,
    );
  }
  log(`Combined item count: ${counts.combined} (expected 124).`);

  if (DRY_RUN) {
    log("[dry-run] Skipping Supabase changes.");
    return;
  }

  const sb = getSupabaseServiceClient();
  const removedLegacyId = await removeLegacyCombinedTemplate(sb);

  const createdIds: string[] = [];
  for (const template of NEW_ACCOUNT_WARMUP_US_TEMPLATES) {
    const { data: existing } = await sb
      .from("task_templates")
      .select("id, template_id, name")
      .eq("name", template.name)
      .maybeSingle();

    if (existing?.id) {
      log(`Template "${template.name}" already exists (${existing.id}, ${existing.template_id}) — skipped.`);
      createdIds.push(existing.id);
      continue;
    }

    const created = await createTaskTemplate(template);
    log(`Created "${template.name}" id=${created.id} template_id=${created.template_id}`);
    log(
      `  phases=${created.phases.length}, items=${created.phases.reduce((n, p) => n + p.items.length, 0)}`,
    );
    createdIds.push(created.id);
  }

  if (removedLegacyId) {
    log(`Legacy template ${removedLegacyId} removed; no VA assignment migration needed (templates are applied at assign-time).`);
  }
  log(`Active split templates: ${createdIds.join(", ")}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
