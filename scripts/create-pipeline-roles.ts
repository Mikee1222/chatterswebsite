#!/usr/bin/env tsx
/**
 * Content Pipeline — create/patch the 8 pipeline custom roles (UNION-SAFE).
 *
 * SAFETY: for roles that already exist (e.g. researcher, marketing-executive from Mike),
 * permissions are MERGED (union) — never removed/overwritten. is_system_role stays false.
 * Also ensures each role slug exists as a `users.role` single-select option (Meta API).
 *
 * Self-contained (raw Airtable API, no app imports). Requires AIRTABLE_TOKEN, AIRTABLE_BASE_ID.
 * Scope: schema.bases:write (select option) + data write (roles records).
 *
 * Usage:
 *   npx tsx scripts/create-pipeline-roles.ts            # DRY RUN
 *   npx tsx scripts/create-pipeline-roles.ts --apply    # apply
 */

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();
import { syncRoleOptionsToAirtable } from "../lib/airtable-role-field-sync";

type RoleSpec = { role_id: string; label: string; permissions: string[] };

const ROLES: RoleSpec[] = [
  { role_id: "researcher", label: "Researcher", permissions: ["content_pipeline:view"] },
  { role_id: "creative", label: "Creative", permissions: ["content_pipeline:view", "creative_scripts:submit"] },
  { role_id: "filmer", label: "Filmer", permissions: ["content_pipeline:view"] },
  { role_id: "editor", label: "Editor", permissions: ["content_pipeline:view"] },
  { role_id: "icloud-manager", label: "iCloud Manager", permissions: ["content_pipeline:view"] },
  { role_id: "marketing-executive", label: "Marketing Executive", permissions: ["content_pipeline:view", "marketing:view", "winner_videos:submit", "daily_review:submit"] },
  { role_id: "head-of-marketing", label: "Head of Marketing", permissions: ["content_pipeline:view", "content_pipeline:qa", "content_pipeline:manage", "winner_videos:manage", "creative_scripts:manage", "marketing:manage", "daily_review:manage"] },
  { role_id: "supervisor", label: "Supervisor", permissions: ["content_pipeline:view", "content_pipeline:qa", "spotcheck:manage", "daily_review:manage"] },
];

const TOKEN = process.env.AIRTABLE_TOKEN?.trim() ?? "";
const BASE = process.env.AIRTABLE_BASE_ID?.trim() ?? "";
const APPLY = process.argv.includes("--apply");

if (!TOKEN || !BASE) { console.error("Missing AIRTABLE_TOKEN / AIRTABLE_BASE_ID."); process.exit(1); }

const H = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };
const meta = (p: string, init?: RequestInit) => fetch(`https://api.airtable.com/v0/meta/bases/${BASE}${p}`, { ...init, headers: { ...H, ...(init?.headers ?? {}) } });
const data = (p: string, init?: RequestInit) => fetch(`https://api.airtable.com/v0/${BASE}${p}`, { ...init, headers: { ...H, ...(init?.headers ?? {}) } });

async function ensureRoleOptions(slugs: string[]): Promise<void> {
  const res = await meta("/tables");
  const json = (await res.json()) as { tables: { id: string; name: string; fields: { id: string; name: string; type: string; options?: { choices?: { id: string; name: string }[] } }[] }[] };
  const users = json.tables.find((t) => t.name === "users");
  const roleField = users?.fields.find((f) => f.name === "role");
  if (!users || !roleField) { console.error("users.role field not found"); process.exit(1); }
  const existing = roleField.options?.choices ?? [];
  const existingNames = new Set(existing.map((c) => c.name));
  const toAdd = slugs.filter((s) => !existingNames.has(s));
  if (!toAdd.length) { console.log("users.role options: all slugs already present"); return; }
  console.log(`users.role: adding options → ${toAdd.join(", ")}`);
  if (!APPLY) return;
  // Reuse the repo's proven sync (Meta PATCH → typecast create+delete fallback on 422).
  const { added, skipped } = await syncRoleOptionsToAirtable(toAdd);
  console.log(`  ✓ options synced (added: ${added.join(", ") || "none"}${skipped.length ? `; skipped: ${skipped.join(", ")}` : ""})`);
}

async function findRole(roleId: string): Promise<{ id: string; permissions: string[] } | null> {
  const f = encodeURIComponent(`{role_id} = "${roleId}"`);
  const res = await data(`/roles?filterByFormula=${f}&pageSize=1`);
  if (!res.ok) { console.error("  ✗ role lookup failed:", res.status, await res.text()); return null; }
  const json = (await res.json()) as { records: { id: string; fields: { permissions?: string } }[] };
  const rec = json.records[0];
  if (!rec) return null;
  let perms: string[] = [];
  try { const p = JSON.parse(rec.fields.permissions ?? "[]"); if (Array.isArray(p)) perms = p.filter((x) => typeof x === "string"); } catch { /* ignore */ }
  return { id: rec.id, permissions: perms };
}

async function main(): Promise<void> {
  console.log(`\n=== Pipeline roles — ${APPLY ? "APPLY" : "DRY RUN"} (union-safe) ===\n`);
  await ensureRoleOptions(ROLES.map((r) => r.role_id));
  console.log("");
  const now = new Date().toISOString();

  for (const r of ROLES) {
    const existing = await findRole(r.role_id);
    const merged = existing ? Array.from(new Set([...existing.permissions, ...r.permissions])) : [...r.permissions];
    const added = existing ? merged.filter((p) => !existing.permissions.includes(p)) : merged;

    if (existing) {
      if (!added.length) { console.log(`= ${r.role_id}: exists, no new perms (keeping ${existing.permissions.length})`); continue; }
      console.log(`~ ${r.role_id}: UNION +[${added.join(", ")}] (was ${existing.permissions.length} → ${merged.length})`);
      if (!APPLY) continue;
      const res = await data(`/roles/${existing.id}`, { method: "PATCH", body: JSON.stringify({ fields: { permissions: JSON.stringify(merged), updated_at: now } }) });
      console.log(res.ok ? "  ✓ updated" : `  ✗ ${res.status}: ${await res.text()}`);
    } else {
      console.log(`+ ${r.role_id}: CREATE "${r.label}" [${r.permissions.join(", ")}]`);
      if (!APPLY) continue;
      const res = await data(`/roles`, { method: "POST", body: JSON.stringify({ fields: { role_id: r.role_id, label: r.label, permissions: JSON.stringify(r.permissions), is_system_role: false, created_at: now, updated_at: now } }) });
      console.log(res.ok ? "  ✓ created" : `  ✗ ${res.status}: ${await res.text()}`);
    }
  }
  console.log(APPLY ? "\nDone.\n" : "\n(DRY RUN — nothing written.)\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
