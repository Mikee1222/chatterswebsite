#!/usr/bin/env tsx
/**
 * Content Pipeline — create the 5 NEW spine tables (additive, zero touch to existing).
 *
 * Design: all cross-references use TEXT SLUGS (model_id / user_id), NOT record links,
 * so `modelss` / `users` / `winner_videos` get NO reciprocal fields (creators untouched).
 *
 * Tables: creator_assignments, content_items, content_item_events,
 *         research_bunches, research_ideas
 *
 * Idempotent (skips existing). Requires AIRTABLE_TOKEN, AIRTABLE_BASE_ID.
 * Token scope needed to APPLY: schema.bases:write
 *
 * Usage:
 *   npx tsx scripts/create-content-pipeline-tables.ts            # DRY RUN (default, no writes)
 *   npx tsx scripts/create-content-pipeline-tables.ts --apply    # actually create
 */

import { config as loadEnv } from "dotenv";
import { syncBase } from "../lib/airtable-admin";
import type { TableDef } from "../lib/airtable-schema";

loadEnv({ path: ".env.local" });
loadEnv();

const ROLE_CHOICES = [
  { name: "researcher" },
  { name: "creative" },
  { name: "filmer" },
  { name: "editor" },
  { name: "icloud-manager" },
  { name: "marketing-executive" },
  { name: "head-of-marketing" },
  { name: "supervisor" },
];
const STAGE_CHOICES = [
  { name: "creative" },
  { name: "filming" },
  { name: "icloud_raw" },
  { name: "editing" },
  { name: "post" },
  { name: "analytics" },
  { name: "done" },
];

const TABLES: TableDef[] = [
  {
    name: "creator_assignments",
    fields: [
      { name: "assignment_id", def: { type: "singleLineText" } },
      { name: "user_id", def: { type: "singleLineText" } },
      { name: "user_name", def: { type: "singleLineText" } },
      { name: "role", def: { type: "singleSelect", options: { choices: ROLE_CHOICES } } },
      { name: "creator_model_id", def: { type: "singleLineText" } },
      { name: "creator_name", def: { type: "singleLineText" } },
      { name: "is_active", def: { type: "checkbox" } },
      { name: "created_at", def: { type: "dateTime" } },
    ],
  },
  {
    name: "content_items",
    fields: [
      { name: "item_id", def: { type: "singleLineText" } },
      { name: "title", def: { type: "singleLineText" } },
      { name: "creator_model_id", def: { type: "singleLineText" } },
      { name: "creator_name", def: { type: "singleLineText" } },
      { name: "week", def: { type: "singleLineText" } },
      { name: "source", def: { type: "singleSelect", options: { choices: [{ name: "research" }, { name: "winner_recreate" }] } } },
      { name: "research_idea_id", def: { type: "singleLineText" } },
      { name: "winner_video_id", def: { type: "singleLineText" } },
      { name: "stage", def: { type: "singleSelect", options: { choices: STAGE_CHOICES } } },
      { name: "status", def: { type: "singleSelect", options: { choices: [{ name: "in_progress" }, { name: "awaiting_qa" }, { name: "rejected" }, { name: "blocked_unassigned" }, { name: "done" }] } } },
      { name: "assignee_user_id", def: { type: "singleLineText" } },
      { name: "assignee_name", def: { type: "singleLineText" } },
      { name: "script_status", def: { type: "singleSelect", options: { choices: [{ name: "pending" }, { name: "submitted" }, { name: "approved" }, { name: "rejected" }] } } },
      { name: "script_text", def: { type: "multilineText" } },
      { name: "script_video_type", def: { type: "singleLineText" } },
      { name: "film_type", def: { type: "singleSelect", options: { choices: [{ name: "self_record" }, { name: "filmer" }] } } },
      { name: "raw_link", def: { type: "url" } },
      { name: "edited_link", def: { type: "url" } },
      { name: "post_link", def: { type: "url" } },
      { name: "posted_at", def: { type: "dateTime" } },
      { name: "views", def: { type: "number", options: { precision: 0 } } },
      { name: "became_winner", def: { type: "checkbox" } },
      { name: "stage_entered_at", def: { type: "dateTime" } },
      { name: "priority", def: { type: "singleSelect", options: { choices: [{ name: "low" }, { name: "normal" }, { name: "high" }, { name: "urgent" }] } } },
      { name: "notes", def: { type: "multilineText" } },
      { name: "created_at", def: { type: "dateTime" } },
      { name: "updated_at", def: { type: "dateTime" } },
    ],
  },
  {
    name: "content_item_events",
    fields: [
      { name: "event_id", def: { type: "singleLineText" } },
      { name: "item_id", def: { type: "singleLineText" } },
      { name: "stage", def: { type: "singleSelect", options: { choices: STAGE_CHOICES } } },
      { name: "action", def: { type: "singleSelect", options: { choices: [{ name: "entered" }, { name: "completed" }, { name: "qa_approved" }, { name: "qa_rejected" }, { name: "reassigned" }, { name: "blocked" }, { name: "spawned" }] } } },
      { name: "actor_user_id", def: { type: "singleLineText" } },
      { name: "actor_name", def: { type: "singleLineText" } },
      { name: "at", def: { type: "dateTime" } },
      { name: "duration_seconds", def: { type: "number", options: { precision: 0 } } },
      { name: "note", def: { type: "multilineText" } },
    ],
  },
  {
    name: "research_bunches",
    fields: [
      { name: "bunch_id", def: { type: "singleLineText" } },
      { name: "creator_model_id", def: { type: "singleLineText" } },
      { name: "creator_name", def: { type: "singleLineText" } },
      { name: "researcher_user_id", def: { type: "singleLineText" } },
      { name: "researcher_name", def: { type: "singleLineText" } },
      { name: "week", def: { type: "singleLineText" } },
      { name: "status", def: { type: "singleSelect", options: { choices: [{ name: "draft" }, { name: "awaiting_qa" }, { name: "changes_requested" }, { name: "approved" }] } } },
      { name: "qa_by_user_id", def: { type: "singleLineText" } },
      { name: "qa_by_name", def: { type: "singleLineText" } },
      { name: "submitted_at", def: { type: "dateTime" } },
      { name: "approved_at", def: { type: "dateTime" } },
      { name: "created_at", def: { type: "dateTime" } },
    ],
  },
  {
    name: "research_ideas",
    fields: [
      { name: "idea_id", def: { type: "singleLineText" } },
      { name: "bunch_id", def: { type: "singleLineText" } },
      { name: "platform", def: { type: "singleSelect", options: { choices: [{ name: "IG" }, { name: "TT" }, { name: "both" }] } } },
      { name: "idea_text", def: { type: "multilineText" } },
      { name: "reference_link", def: { type: "url" } },
      { name: "checked", def: { type: "checkbox" } },
      { name: "qa_note", def: { type: "multilineText" } },
      { name: "spawned_item_id", def: { type: "singleLineText" } },
      { name: "created_at", def: { type: "dateTime" } },
    ],
  },
];

async function main(): Promise<void> {
  const token = process.env.AIRTABLE_TOKEN?.trim();
  const baseId = process.env.AIRTABLE_BASE_ID?.trim();
  if (!token || !baseId) {
    console.error("Missing AIRTABLE_TOKEN / AIRTABLE_BASE_ID (.env.local).");
    process.exit(1);
  }
  const apply = process.argv.includes("--apply");
  const dryRun = !apply;

  console.log(`\n=== Content Pipeline tables — ${dryRun ? "DRY RUN (no writes)" : "APPLY (writing to base)"} ===`);
  console.log(`Base: ${baseId.slice(0, 6)}…  Tables: ${TABLES.map((t) => t.name).join(", ")}\n`);

  const result = await syncBase(baseId, "content-pipeline", token, TABLES, dryRun);

  console.log("Tables created:", result.tablesCreated.length ? result.tablesCreated.join(", ") : "(none)");
  console.log("Tables already existed:", result.tablesExisted.length ? result.tablesExisted.join(", ") : "(none)");
  console.log("Fields created:", result.fieldsCreated.length);
  if (result.fieldsCreated.length) {
    for (const f of result.fieldsCreated) console.log(`   + ${f.table}.${f.field}`);
  }
  if (result.fallbackFields.length) {
    console.log("\nFallback-typed fields (API-unsupported requested type):");
    for (const f of result.fallbackFields) console.log(`   ! ${f.table}.${f.field} ${f.requestedType} → ${f.actualType}`);
  }
  if (result.errors.length) {
    console.log("\nERRORS:");
    for (const e of result.errors) console.log("   ✗", e);
    process.exitCode = 1;
  }
  console.log(dryRun ? "\n(DRY RUN — nothing written. Re-run with --apply to create.)\n" : "\nDone.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
