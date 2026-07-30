#!/usr/bin/env tsx
/**
 * Fix: Pantelis & Konstantina are CREATIVES but tagged `researcher` (Mike's setup).
 *
 * SAFE, lossless:
 *  1. Enrich `creative` role perms = UNION(current creative, current researcher) so switching
 *     users loses NO permission they rely on (scripts, winners, pdf, blur, transcribe, sops).
 *  2. Move those 2 users' `users.role` researcher → creative (option already exists).
 * Does NOT touch the `researcher` role itself or any other user.
 *
 * Requires AIRTABLE_TOKEN, AIRTABLE_BASE_ID.
 * Usage: npx tsx scripts/fix-creatives-role.ts [--apply]
 */

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

const TOKEN = process.env.AIRTABLE_TOKEN?.trim() ?? "";
const BASE = process.env.AIRTABLE_BASE_ID?.trim() ?? "";
const APPLY = process.argv.includes("--apply");
const TARGET_NAMES = ["Pantelis", "Konstantina"];

if (!TOKEN || !BASE) { console.error("Missing creds."); process.exit(1); }
const H = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };
const data = (p: string, init?: RequestInit) => fetch(`https://api.airtable.com/v0/${BASE}${p}`, { ...init, headers: { ...H, ...(init?.headers ?? {}) } });

async function getRole(roleId: string): Promise<{ id: string; permissions: string[] } | null> {
  const r = await data(`/roles?filterByFormula=${encodeURIComponent(`{role_id}="${roleId}"`)}&pageSize=1`);
  const j = (await r.json()) as { records: { id: string; fields: { permissions?: string } }[] };
  const rec = j.records[0];
  if (!rec) return null;
  let perms: string[] = [];
  try { const p = JSON.parse(rec.fields.permissions ?? "[]"); if (Array.isArray(p)) perms = p.filter((x) => typeof x === "string"); } catch { /* */ }
  return { id: rec.id, permissions: perms };
}

async function main(): Promise<void> {
  console.log(`\n=== Fix creatives role — ${APPLY ? "APPLY" : "DRY RUN"} ===\n`);

  const researcher = await getRole("researcher");
  const creative = await getRole("creative");
  if (!researcher || !creative) { console.error("researcher/creative role missing"); process.exit(1); }

  const mergedPerms = Array.from(new Set([...creative.permissions, ...researcher.permissions]));
  const addedPerms = mergedPerms.filter((p) => !creative.permissions.includes(p));
  console.log(`1) creative role perms: ${creative.permissions.length} → ${mergedPerms.length}`);
  console.log(`   + adding: [${addedPerms.join(", ") || "none"}]`);

  // find target users
  const uf = TARGET_NAMES.map((n) => `{full_name}="${n}"`).join(",");
  const ures = await data(`/users?filterByFormula=${encodeURIComponent(`OR(${uf})`)}&pageSize=50`);
  const uj = (await ures.json()) as { records: { id: string; fields: { full_name?: string; role?: string } }[] };
  const targets = uj.records.filter((r) => (r.fields.role ?? "") === "researcher");
  console.log(`\n2) users to switch researcher → creative:`);
  for (const t of targets) console.log(`   ${t.fields.full_name} (${t.id}) role=${t.fields.role}`);
  if (targets.length !== TARGET_NAMES.length) {
    console.log(`   ⚠️ expected ${TARGET_NAMES.length}, found ${targets.length} — check names/roles before apply.`);
  }

  if (!APPLY) { console.log("\n(DRY RUN — nothing written.)\n"); return; }

  // 1. update creative role perms
  const pr = await data(`/roles/${creative.id}`, { method: "PATCH", body: JSON.stringify({ fields: { permissions: JSON.stringify(mergedPerms), updated_at: new Date().toISOString() } }) });
  console.log(pr.ok ? "\n  ✓ creative role perms updated" : `\n  ✗ role update ${pr.status}: ${await pr.text()}`);

  // 2. switch users
  for (const t of targets) {
    const r = await data(`/users/${t.id}`, { method: "PATCH", body: JSON.stringify({ fields: { role: "creative" } }) });
    console.log(r.ok ? `  ✓ ${t.fields.full_name} → creative` : `  ✗ ${t.fields.full_name}: ${r.status} ${await r.text()}`);
  }
  console.log("\nDone.\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
