#!/usr/bin/env tsx
/**
 * Retry the 1 stuck mss.screenshot attachment that timed out at 45s.
 * Airtable READ-ONLY — only writes to Supabase Storage + mss row.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import "./_polyfill-websocket";
import { createHash } from "crypto";
import { getSupabaseServiceClient } from "../lib/supabase-server";

const AIRTABLE_ID = "recjAcObgwjPGXoW8";
const TIMEOUT_MS = 180_000;

async function downloadWithRetry(url: string, attempts = 3): Promise<Buffer> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "GunzoOS-mss-retry/1.0" },
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      clearTimeout(timeout);
      lastErr = err;
      console.warn(`  attempt ${i + 1}/${attempts} failed:`, err instanceof Error ? err.message : err);
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

async function main() {
  const sb = getSupabaseServiceClient();
  const { data: row, error } = await sb
    .from("mss")
    .select("id, airtable_id, screenshot")
    .eq("airtable_id", AIRTABLE_ID)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error(`mss row ${AIRTABLE_ID} not found`);

  const screenshots = (row.screenshot as string[] | null) ?? [];
  const pending = screenshots.filter((u) => u && !u.startsWith("sb://"));
  if (pending.length === 0) {
    console.log("Already migrated — nothing to do");
    return;
  }

  console.log(`Retrying ${pending.length} attachment(s) for ${AIRTABLE_ID} (timeout ${TIMEOUT_MS}ms)`);
  const out: string[] = [];
  for (let i = 0; i < screenshots.length; i++) {
    const url = screenshots[i];
    if (!url || url.startsWith("sb://")) {
      out.push(url);
      continue;
    }
    console.log(`  downloading (${Math.round(url.length / 1024)}kb url)…`);
    const buf = await downloadWithRetry(url);
    console.log(`  got ${buf.length} bytes`);
    const hash = createHash("sha1").update(url).digest("hex").slice(0, 12);
    const objectPath = `mss/${AIRTABLE_ID}/screenshot/${hash}_${i}.bin`;
    const { error: upErr } = await sb.storage.from("attachments").upload(objectPath, buf, {
      contentType: "application/octet-stream",
      upsert: true,
    });
    if (upErr) throw new Error(`upload: ${upErr.message}`);
    out.push(`sb://attachments/${objectPath}`);
    console.log(`  uploaded sb://attachments/${objectPath}`);
  }

  const { error: updErr } = await sb.from("mss").update({ screenshot: out }).eq("id", row.id);
  if (updErr) throw new Error(`update: ${updErr.message}`);
  console.log("OK — mss screenshot migrated");
}

main().catch((e) => {
  console.error("FAIL", e);
  process.exit(1);
});
