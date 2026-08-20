#!/usr/bin/env tsx
/**
 * Full historical resync of ClarioSuite per-post media insights.
 *
 * Unlike daily account insights (typically capped ~90 days by plan), GET /media
 * and GET /media/:id/insights have no documented trailing-day window — this
 * script paginates media since SINCE_YMD (default 2026-01-01) and re-fetches
 * insights for every linked model / multi-IG account at ~100 req/min.
 *
 * Usage:
 *   vercel env pull .env.production.local --environment production --yes
 *   npx tsx scripts/resync-clariosuite-media-insights.ts
 *
 * Optional:
 *   SINCE_YMD=2026-01-01 DRY_RUN=1 npx tsx scripts/resync-clariosuite-media-insights.ts
 *   MODEL_RECORD_ID=recXXX npx tsx scripts/resync-clariosuite-media-insights.ts
 */
import { config as loadEnv } from "dotenv";
import { readFileSync } from "node:fs";
import "./_polyfill-websocket";

loadEnv({ path: ".env.production.local", override: true });
loadEnv({ path: ".env.local" });
loadEnv();

/** Vercel sometimes pulls CLARIOSUITE_API_KEY as empty — fill from .env.local if needed. */
function ensureClarioSuiteApiKey(): void {
  if (process.env.CLARIOSUITE_API_KEY?.trim()) return;
  try {
    const text = readFileSync(".env.local", "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^\s*CLARIOSUITE_API_KEY\s*=\s*(.*)$/);
      if (!m) continue;
      let v = (m[1] ?? "").trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (v.trim()) {
        process.env.CLARIOSUITE_API_KEY = v.trim();
        console.log("CLARIOSUITE_API_KEY: using .env.local (production pull was empty)");
      }
      break;
    }
  } catch {
    /* ignore */
  }
}
ensureClarioSuiteApiKey();

async function countInsightsSnapshot(): Promise<{
  total: number;
  availableTrue: number;
  availableFalse: number;
  withError: number;
  availableNonzero: number;
  oldest: string | null;
  newest: string | null;
}> {
  const { getSupabaseServiceClient } = await import("../lib/supabase-server");
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("clariosuite_top_posts")
    .select("insights_available,insights_error,reach,views,posted_at");
  if (error) throw new Error(`snapshot select: ${error.message}`);
  const rows = data ?? [];
  let availableTrue = 0;
  let availableFalse = 0;
  let withError = 0;
  let availableNonzero = 0;
  let oldest: string | null = null;
  let newest: string | null = null;
  for (const row of rows) {
    const avail = Boolean(row.insights_available);
    if (avail) availableTrue += 1;
    else availableFalse += 1;
    if (row.insights_error != null && String(row.insights_error).trim()) withError += 1;
    const reach = Number(row.reach) || 0;
    const views = Number(row.views) || 0;
    if (avail && (reach > 0 || views > 0)) availableNonzero += 1;
    const posted = row.posted_at != null ? String(row.posted_at) : null;
    if (posted) {
      if (!oldest || posted < oldest) oldest = posted;
      if (!newest || posted > newest) newest = posted;
    }
  }
  return {
    total: rows.length,
    availableTrue,
    availableFalse,
    withError,
    availableNonzero,
    oldest,
    newest,
  };
}

async function main() {
  const sinceYmd = (process.env.SINCE_YMD ?? "2026-01-01").trim();
  const dryRun = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";
  const modelRecordId = process.env.MODEL_RECORD_ID?.trim() || undefined;

  const {
    listLinkedClarioSuiteModels,
    resyncClarioSuiteMediaInsights,
    MEDIA_INSIGHTS_BACKFILL_SINCE_YMD,
  } = await import("../services/clariosuite-sync");
  const { listClarioSuiteMedia, CLARIOSUITE_MAX_INSIGHTS_RANGE } = await import(
    "../lib/clariosuite-api"
  );

  const linked = await listLinkedClarioSuiteModels();
  const filtered = modelRecordId
    ? linked.filter((m) => m.modelRecordId === modelRecordId)
    : linked;
  const accountCount = filtered.reduce((s, m) => s + m.accounts.length, 0);

  console.log("=== ClarioSuite per-post media insights resync ===");
  console.log(`since: ${sinceYmd || MEDIA_INSIGHTS_BACKFILL_SINCE_YMD}`);
  console.log(
    `lookback note: daily account insights max in our client clamp = ${CLARIOSUITE_MAX_INSIGHTS_RANGE}d; media list + /media/:id/insights have no documented day cap`
  );
  console.log(`linked models: ${filtered.length}, IG accounts: ${accountCount}`);
  for (const m of filtered) {
    console.log(
      `  - ${m.modelName}: ${m.accounts.map((a) => a.label || a.igUserId.slice(0, 10)).join(", ")}`
    );
  }

  // Preflight: count media since cutoff (1 list request page-walk per account).
  let listedTotal = 0;
  for (const m of filtered) {
    for (const a of m.accounts) {
      const { data } = await listClarioSuiteMedia(a.igUserId, 2000, { sinceYmd });
      listedTotal += data.length;
      const oldest = data.length
        ? data.reduce((min, row) => {
            const t = row.timestamp || "";
            return !min || t < min ? t : min;
          }, "")
        : null;
      const newest = data.length
        ? data.reduce((max, row) => {
            const t = row.timestamp || "";
            return !max || t > max ? t : max;
          }, "")
        : null;
      console.log(
        `  media ${m.modelName}/${a.label || a.igUserId.slice(0, 8)}: ${data.length}` +
          (oldest && newest ? ` (${oldest.slice(0, 10)} → ${newest.slice(0, 10)})` : "")
      );
    }
  }
  const estMinutes = Math.ceil((listedTotal * 0.65) / 60);
  console.log(`media to insight-fetch (est): ${listedTotal} (~${estMinutes} min at 650ms spacing)`);

  const before = await countInsightsSnapshot();
  console.log("DB before:", before);

  if (dryRun) {
    console.log("DRY_RUN=1 — skipping insights fetch/upsert");
    return;
  }

  const result = await resyncClarioSuiteMediaInsights({
    sinceYmd,
    modelRecordId,
  });
  console.log("resync result:", {
    skipped: result.skipped,
    skipReason: result.skipReason,
    sinceYmd: result.sinceYmd,
    accountsTargeted: result.accountsTargeted,
    mediaListed: result.mediaListed,
    insightsFetched: result.insightsFetched,
    upserted: result.upserted,
    availableTrue: result.availableTrue,
    availableFalse: result.availableFalse,
    errorCount: result.errors.length,
  });
  if (result.errors.length) {
    console.error("sample errors:", result.errors.slice(0, 8));
  }

  const after = await countInsightsSnapshot();
  console.log("DB after:", after);

  // Spot-check a few available posts with non-zero reach/views.
  const { getSupabaseServiceClient } = await import("../lib/supabase-server");
  const sb = getSupabaseServiceClient();
  const { data: samples, error: sampleErr } = await sb
    .from("clariosuite_top_posts")
    .select(
      "model_name,media_id,permalink,media_product_type,reach,views,likes,comments,insights_available,insights_error,posted_at,rank"
    )
    .eq("insights_available", true)
    .or("reach.gt.0,views.gt.0")
    .order("engagement_score", { ascending: false })
    .limit(5);
  if (sampleErr) console.error("sample query error:", sampleErr.message);
  else {
    console.log("spot-check (top available nonzero):");
    for (const s of samples ?? []) {
      console.log(
        `  ${s.model_name} rank=${s.rank} ${String(s.media_product_type ?? "").padEnd(6)} reach=${s.reach} views=${s.views} likes=${s.likes} posted=${String(s.posted_at ?? "").slice(0, 10)} ${s.permalink ?? s.media_id}`
      );
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
