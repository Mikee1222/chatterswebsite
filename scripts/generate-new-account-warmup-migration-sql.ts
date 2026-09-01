#!/usr/bin/env npx tsx
/**
 * Generates supabase/migrations/*_split_new_account_warmup_us_templates.sql
 * from lib/task-template-seeds/new-account-warmup-us.ts
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import {
  NEW_ACCOUNT_WARMUP_US_LEGACY_TEMPLATE_NAME,
  NEW_ACCOUNT_WARMUP_US_TEMPLATE_SEEDS,
} from "@/lib/task-template-seeds/new-account-warmup-us";
import type { TaskTemplateCreateInput } from "@/services/task-templates-supabase";

function sqlEscape(value: string): string {
  return value.replace(/'/g, "''");
}

function renderTemplateInserts(
  seed: { slug: string; logicalTemplateId: string; template: TaskTemplateCreateInput },
  lines: string[],
): void {
  const { slug, logicalTemplateId, template } = seed;
  lines.push(
    `  SELECT id INTO v_existing FROM public.task_templates WHERE name = '${sqlEscape(template.name)}' LIMIT 1;`,
    "  IF v_existing IS NULL THEN",
    "    INSERT INTO public.task_templates (template_id, name, description, category, is_active, created_at)",
    `    VALUES ('${logicalTemplateId}', '${sqlEscape(template.name)}', '${sqlEscape(template.description ?? "")}', '${template.category ?? "marketing"}', true, now())`,
    "    RETURNING id INTO v_template_id;",
    "",
  );

  for (const phase of template.phases ?? []) {
    lines.push(
      "    INSERT INTO public.task_template_phases (phase_template_id, template, phase_number, title, description)",
      `    VALUES ('phase_tpl_${phase.phase_number}_warmup_us_${slug}', ARRAY[v_template_id], ${phase.phase_number}, '${sqlEscape(phase.title)}', '${sqlEscape(phase.description ?? "")}')`,
      "    RETURNING id INTO v_phase_id;",
      "",
    );

    for (const item of phase.items ?? []) {
      lines.push(
        "    INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)",
        `    VALUES ('item_tpl_${phase.phase_number}_${item.sort_order ?? 0}_warmup_us_${slug}', ARRAY[v_phase_id], '${sqlEscape(item.title)}', '${sqlEscape(item.description ?? "")}', ${item.requires_screenshot ? "true" : "false"}, ${item.sort_order ?? 0}, '${sqlEscape(item.step_type ?? "Other")}');`,
      );
    }
    lines.push("");
  }

  lines.push(
    `    RAISE NOTICE 'Created template "${sqlEscape(template.name)}" (%).', v_template_id;`,
    "  ELSE",
    `    RAISE NOTICE 'Template "${sqlEscape(template.name)}" already exists (%), skipping.', v_existing;`,
    "  END IF;",
    "",
  );
}

function main(): void {
  const lines: string[] = [
    "-- Split New Account Warm-Up (US) into two independently-assignable templates.",
    "-- Removes the legacy combined 6-phase template if present.",
    "",
    "DO $$",
    "DECLARE",
    "  v_template_id uuid;",
    "  v_phase_id uuid;",
    "  v_existing uuid;",
    "  v_old_id uuid;",
    "BEGIN",
    `  SELECT id INTO v_old_id FROM public.task_templates WHERE name = '${sqlEscape(NEW_ACCOUNT_WARMUP_US_LEGACY_TEMPLATE_NAME)}' LIMIT 1;`,
    "  IF v_old_id IS NOT NULL THEN",
    "    DELETE FROM public.task_template_items",
    "    WHERE phase_template && ARRAY(",
    "      SELECT id FROM public.task_template_phases WHERE v_old_id = ANY(template)",
    "    );",
    "    DELETE FROM public.task_template_phases WHERE v_old_id = ANY(template);",
    "    DELETE FROM public.task_templates WHERE id = v_old_id;",
    `    RAISE NOTICE 'Removed legacy combined template "${sqlEscape(NEW_ACCOUNT_WARMUP_US_LEGACY_TEMPLATE_NAME)}" (%).', v_old_id;`,
    "  END IF;",
    "",
  ];

  for (const seed of NEW_ACCOUNT_WARMUP_US_TEMPLATE_SEEDS) {
    renderTemplateInserts(seed, lines);
  }

  lines.push("END $$;", "");

  const outPath = path.join(
    process.cwd(),
    "supabase/migrations/20260902130000_split_new_account_warmup_us_templates.sql",
  );
  writeFileSync(outPath, lines.join("\n"), "utf8");
  console.log(`Wrote ${outPath} (${lines.length} lines)`);
}

main();
