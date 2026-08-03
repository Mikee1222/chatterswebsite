#!/usr/bin/env tsx
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import "./_polyfill-websocket";
import { getSupabaseServiceClient } from "../lib/supabase-server";
import { isSbStorageToken, resolveStorageUrl } from "../lib/supabase-signed-url";

async function main() {
  const sb = getSupabaseServiceClient();
  const tables: Array<[string, string]> = [
    ["payment_submissions", "proof_attachment"],
    ["feedback", "screenshot"],
    ["chatter_mistakes", "screenshot"],
    ["va_task_phase_items", "screenshot"],
    ["mss", "screenshot"],
    ["winner_videos", "screenshot"],
    ["shadowban_reports", "screenshot"],
    ["marketing_phones", "phone_photos"],
    ["model_social_accounts", "shadowban_screenshot"],
    ["rebills", "screenshot"],
    ["invoices", "attachment"],
  ];

  for (const [table, col] of tables) {
    const { data, error } = await sb.from(table).select(col).not(col, "is", null).limit(50);
    if (error) {
      console.log(`${table}.${col}: ERR ${error.message}`);
      continue;
    }
    let token = "";
    for (const row of data ?? []) {
      const arr = (row as unknown as Record<string, unknown>)[col];
      if (!Array.isArray(arr)) continue;
      const hit = arr.find((u) => typeof u === "string" && u.startsWith("sb://"));
      if (typeof hit === "string") {
        token = hit;
        break;
      }
    }
    if (!token) {
      console.log(`${table}.${col}: no sb:// sample yet`);
      continue;
    }
    const signed = await resolveStorageUrl(token);
    const head = await fetch(signed, { method: "HEAD" });
    console.log(
      `${table}.${col}: sb=${isSbStorageToken(token)} HEAD=${head.status} signedHttp=${signed.startsWith("https://")}`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
