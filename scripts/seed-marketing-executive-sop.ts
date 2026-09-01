#!/usr/bin/env npx tsx
/**
 * Idempotent seed: Greek Marketing Executive SOP role + 29 functions.
 *
 * Usage: npx tsx scripts/seed-marketing-executive-sop.ts
 */
import "dotenv/config";
import { getSupabaseServiceClient } from "@/lib/supabase-server";
import { MARKETING_EXECUTIVE_FUNCTIONS } from "@/lib/sop-seed/marketing-executive-functions";

const SOP_ROLE_SLUG = "marketing-executive";
const SOP_ROLE_NAME = "Marketing Executive";
const MARKETING_DEPT_ID = "1c6713c4-ffa4-468e-bc2f-bb972cd24182";
const AUTH_ROLE = "marketing-executive";

function genStableId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function main(): Promise<void> {
  const sb = getSupabaseServiceClient();
  const now = new Date().toISOString();

  const { data: existingRole } = await sb
    .from("sop_roles")
    .select("id, role_id")
    .eq("slug", SOP_ROLE_SLUG)
    .maybeSingle();

  let roleUuid: string;

  if (existingRole?.id) {
    roleUuid = existingRole.id;
    console.log(`[seed] SOP role "${SOP_ROLE_NAME}" already exists (${roleUuid}). Updating metadata.`);
    await sb
      .from("sop_roles")
      .update({
        name: SOP_ROLE_NAME,
        auth_roles: [AUTH_ROLE],
        academy_mode: true,
        department: [MARKETING_DEPT_ID],
        color: "blue",
        is_active: true,
        updated_at: now,
      })
      .eq("id", roleUuid);
  } else {
    const { data: maxSort } = await sb
      .from("sop_roles")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const sortOrder = (Number(maxSort?.sort_order ?? 0) || 0) + 1;

    const { data: inserted, error } = await sb
      .from("sop_roles")
      .insert({
        role_id: genStableId("sop_role"),
        name: SOP_ROLE_NAME,
        slug: SOP_ROLE_SLUG,
        color: "blue",
        department: [MARKETING_DEPT_ID],
        auth_roles: [AUTH_ROLE],
        academy_mode: true,
        sort_order: sortOrder,
        is_active: true,
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single();

    if (error || !inserted?.id) {
      throw new Error(`Failed to insert SOP role: ${error?.message ?? "unknown"}`);
    }
    roleUuid = inserted.id;
    console.log(`[seed] Created SOP role "${SOP_ROLE_NAME}" (${roleUuid}).`);
  }

  const { data: existingFns } = await sb
    .from("sop_functions")
    .select("id, sort_order, function_id")
    .contains("sop_role", [roleUuid]);

  const bySort = new Map(
    (existingFns ?? []).map((f) => [Number(f.sort_order), f as { id: string; function_id: string }])
  );

  let created = 0;
  let updated = 0;

  for (const fn of MARKETING_EXECUTIVE_FUNCTIONS) {
    const existing = bySort.get(fn.sort_order);
    const row = {
      name: fn.name,
      kpi: fn.kpi,
      standard_type: "text",
      sop_content: fn.sop_content,
      cadence_type: fn.cadence_type,
      cadence_note: fn.cadence_note,
      sort_order: fn.sort_order,
      department: [MARKETING_DEPT_ID],
      sop_role: [roleUuid],
      is_active: true,
      content_version: 1,
      updated_at: now,
    };

    if (existing) {
      const { error } = await sb.from("sop_functions").update(row).eq("id", existing.id);
      if (error) throw new Error(`Update function ${fn.sort_order} failed: ${error.message}`);
      updated++;
    } else {
      const { error } = await sb.from("sop_functions").insert({
        ...row,
        function_id: genStableId("sop_fn"),
        created_at: now,
      });
      if (error) throw new Error(`Insert function ${fn.sort_order} failed: ${error.message}`);
      created++;
    }
  }

  console.log(
    `[seed] Done — ${MARKETING_EXECUTIVE_FUNCTIONS.length} functions (${created} created, ${updated} updated).`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
