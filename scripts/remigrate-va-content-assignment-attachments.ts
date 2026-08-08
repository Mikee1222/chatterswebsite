#!/usr/bin/env tsx
/**
 * Remigrate va_content_assignments.file_attachment rows that still hold expired
 * Airtable CDN URLs (410) into private Storage as durable sb:// tokens.
 *
 * Fresh Airtable attachment URLs are fetched via the Airtable API (CDN tokens rotate).
 *
 * Usage:
 *   npx tsx scripts/remigrate-va-content-assignment-attachments.ts --dry-run
 *   npx tsx scripts/remigrate-va-content-assignment-attachments.ts
 */

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import "./_polyfill-websocket";
import { getSupabaseServiceClient } from "../lib/supabase-server";
import {
  attachmentBucketFor,
  migrateAttachmentsForRow,
  type AttachmentObj,
} from "./lib/supabase-migrate";

const TABLE = "va_content_assignments";
const FIELD = "file_attachment";

type Args = { dryRun: boolean; limit: number | null };

function parseArgs(argv: string[]): Args {
  const limitIdx = argv.indexOf("--limit");
  const limit =
    limitIdx >= 0 && argv[limitIdx + 1] ? Number(argv[limitIdx + 1]) : null;
  return {
    dryRun: argv.includes("--dry-run"),
    limit: Number.isFinite(limit) && (limit as number) > 0 ? (limit as number) : null,
  };
}

async function fetchAirtableAttachment(
  airtableId: string
): Promise<AttachmentObj[] | null> {
  const token = process.env.AIRTABLE_TOKEN;
  const base = process.env.AIRTABLE_BASE_ID;
  if (!token || !base) throw new Error("AIRTABLE_TOKEN / AIRTABLE_BASE_ID required");
  const url = `https://api.airtable.com/v0/${base}/${encodeURIComponent(TABLE)}/${encodeURIComponent(airtableId)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    console.warn(`  Airtable GET ${airtableId}: ${res.status}`);
    return null;
  }
  const json = (await res.json()) as {
    fields?: { file_attachment?: AttachmentObj[] };
  };
  const att = json.fields?.file_attachment;
  if (!Array.isArray(att) || att.length === 0) return null;
  return att.filter((a) => a?.url);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from(TABLE)
    .select("id, airtable_id, title, file_attachment")
    .not("file_attachment", "is", null);
  if (error) throw new Error(error.message);

  const stale = (data ?? []).filter((row) => {
    const arr = (row as { file_attachment?: string[] | null }).file_attachment;
    return (
      Array.isArray(arr) &&
      arr.some((u) => typeof u === "string" && u.includes("airtableusercontent.com"))
    );
  });

  const targets = args.limit ? stale.slice(0, args.limit) : stale;
  console.log(
    `Found ${stale.length} rows with Airtable CDN URLs; processing ${targets.length}${args.dryRun ? " (dry-run)" : ""}`
  );

  let ok = 0;
  let fail = 0;
  for (const row of targets) {
    const id = String((row as { id: string }).id);
    const airtableId = String((row as { airtable_id?: string | null }).airtable_id ?? "").trim();
    const title = String((row as { title?: string | null }).title ?? "");
    if (!airtableId) {
      console.warn(`SKIP ${id} (${title}): no airtable_id`);
      fail++;
      continue;
    }
    console.log(`→ ${airtableId} / ${id} — ${title}`);
    const fresh = await fetchAirtableAttachment(airtableId);
    if (!fresh?.length) {
      console.warn(`  no fresh Airtable attachment`);
      fail++;
      continue;
    }
    const head = await fetch(fresh[0].url, { method: "HEAD" });
    console.log(`  fresh HEAD ${head.status} ${fresh[0].filename ?? ""}`);
    if (!head.ok) {
      fail++;
      continue;
    }
    if (args.dryRun) {
      ok++;
      continue;
    }
    const bucket = attachmentBucketFor(TABLE, FIELD);
    const urls = await migrateAttachmentsForRow(sb, {
      bucket,
      table: TABLE,
      airtableId,
      field: FIELD,
      attachments: fresh,
    });
    const allSb = urls.every((u) => u.startsWith("sb://"));
    if (!allSb) {
      console.warn(`  migrate did not produce sb:// tokens:`, urls.map((u) => u.slice(0, 60)));
      fail++;
      continue;
    }
    const { error: upErr } = await sb.from(TABLE).update({ file_attachment: urls }).eq("id", id);
    if (upErr) {
      console.warn(`  DB update fail: ${upErr.message}`);
      fail++;
      continue;
    }
    console.log(`  OK → ${urls[0]}`);
    ok++;
  }

  console.log(`\nDone. ok=${ok} fail=${fail}`);
  if (fail > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
