#!/usr/bin/env npx tsx
/**
 * Generates supabase/migrations/*_new_account_warmup_us_task_template.sql
 * from lib/task-template-seeds/new-account-warmup-us.ts
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import {
  NEW_ACCOUNT_WARMUP_US_TEMPLATE,
  NEW_ACCOUNT_WARMUP_US_TEMPLATE_NAME,
} from "@/lib/task-template-seeds/new-account-warmup-us";

function sqlEscape(value: string): string {
  return value.replace(/'/g, "''");
}

function main(): void {
  const template = NEW_ACCOUNT_WARMUP_US_TEMPLATE;
  const lines: string[] = [
    "-- Seed task template: New Account Warm-Up (US)",
    "-- Idempotent: skips if template name already exists.",
    "",
    "DO $$",
    "DECLARE",
    "  v_template_id uuid;",
    "  v_phase_id uuid;",
    "  v_existing uuid;",
    "BEGIN",
    `  SELECT id INTO v_existing FROM public.task_templates WHERE name = '${sqlEscape(NEW_ACCOUNT_WARMUP_US_TEMPLATE_NAME)}' LIMIT 1;`,
    "  IF v_existing IS NOT NULL THEN",
    `    RAISE NOTICE 'Template "${sqlEscape(NEW_ACCOUNT_WARMUP_US_TEMPLATE_NAME)}" already exists (%), skipping.', v_existing;`,
    "    RETURN;",
    "  END IF;",
    "",
    "  INSERT INTO public.task_templates (template_id, name, description, category, is_active, created_at)",
    `  VALUES ('tpl_new_account_warmup_us', '${sqlEscape(template.name)}', '${sqlEscape(template.description ?? "")}', '${template.category ?? "marketing"}', true, now())`,
    "  RETURNING id INTO v_template_id;",
    "",
  ];

  for (const phase of template.phases ?? []) {
    lines.push(
      "  INSERT INTO public.task_template_phases (phase_template_id, template, phase_number, title, description)",
      `  VALUES ('phase_tpl_${phase.phase_number}_warmup_us', ARRAY[v_template_id], ${phase.phase_number}, '${sqlEscape(phase.title)}', '${sqlEscape(phase.description ?? "")}')`,
      "  RETURNING id INTO v_phase_id;",
      "",
    );

    for (const item of phase.items ?? []) {
      lines.push(
        "  INSERT INTO public.task_template_items (item_template_id, phase_template, title, description, requires_screenshot, sort_order, step_type)",
        `  VALUES ('item_tpl_${phase.phase_number}_${item.sort_order ?? 0}_warmup_us', ARRAY[v_phase_id], '${sqlEscape(item.title)}', '${sqlEscape(item.description ?? "")}', ${item.requires_screenshot ? "true" : "false"}, ${item.sort_order ?? 0}, '${sqlEscape(item.step_type ?? "Other")}');`,
      );
    }
    lines.push("");
  }

  lines.push("END $$;", "");

  const outPath = path.join(
    process.cwd(),
    "supabase/migrations/20260902120000_new_account_warmup_us_task_template.sql",
  );
  writeFileSync(outPath, lines.join("\n"), "utf8");
  console.log(`Wrote ${outPath} (${lines.length} lines)`);
}

main();
