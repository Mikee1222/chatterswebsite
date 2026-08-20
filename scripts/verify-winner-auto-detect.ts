/**
 * Verify Winner auto-detect: low threshold → classify → non-retroactive + no duplicates.
 * Usage: npx tsx scripts/verify-winner-auto-detect.ts
 */
import { config as loadEnv } from "dotenv";
import "./_polyfill-websocket";
loadEnv({ path: ".env.local" });
loadEnv();
process.env.DATA_BACKEND = "supabase";

import { getSupabaseServiceClient } from "../lib/supabase-server";
import { upsertModelWinnerThresholds } from "../services/model-winner-thresholds";
import { detectWinnersFromClarioSuitePosts } from "../services/winner-auto-detect";

async function main() {
  const sb = getSupabaseServiceClient();

  const { data: posts, error } = await sb
    .from("clariosuite_top_posts")
    .select("media_id, model_record_id, model_name, permalink, media_type, media_product_type, views")
    .order("views", { ascending: false })
    .limit(5);
  if (error) throw error;
  if (!posts?.length) {
    console.log("No clariosuite_top_posts — nothing to verify.");
    return;
  }

  const sample = posts[0]!;
  const modelId = String(sample.model_record_id ?? "").trim();
  if (!modelId) throw new Error("Sample post missing model_record_id");

  console.log("Sample post:", {
    media_id: sample.media_id,
    model: sample.model_name,
    views: sample.views,
    permalink: sample.permalink,
  });

  // Seed a real view count if Meta returned 0 (common in early syncs)
  const seededViews = Math.max(Number(sample.views) || 0, 1500);
  if (Number(sample.views) < 1500) {
    const { error: upErr } = await sb
      .from("clariosuite_top_posts")
      .update({ views: seededViews })
      .eq("media_id", sample.media_id);
    if (upErr) throw upErr;
    console.log(`Seeded views=${seededViews} on ${sample.media_id} for test`);
  }

  // Low thresholds so classification fires
  await upsertModelWinnerThresholds({
    model_id: modelId,
    winner_threshold_views: 1000,
    super_winner_threshold_views: 5000,
    updated_by: "verify-winner-auto-detect",
  });
  console.log("Set thresholds: winner=1000, super=5000");

  // Clear any prior auto-detect for this media so we can re-run cleanly
  await sb
    .from("winner_submissions")
    .delete()
    .eq("clariosuite_media_id", sample.media_id);

  const first = await detectWinnersFromClarioSuitePosts({ modelRecordId: modelId });
  console.log("First detect:", {
    scanned: first.scanned,
    classified: first.classified,
    skippedAlreadyClassified: first.skippedAlreadyClassified,
    skippedBelowThreshold: first.skippedBelowThreshold,
    created: first.created.map((c) => ({
      id: c.id,
      tier: c.tier,
      views: c.view_count,
      source: c.source,
      media: c.clariosuite_media_id,
      thresholds: c.threshold_at_classification,
    })),
    errors: first.errors,
  });

  if (first.classified < 1) {
    throw new Error("Expected at least one classification on first run");
  }

  const created = first.created.find((c) => c.clariosuite_media_id === sample.media_id);
  if (!created) throw new Error("Expected sample media to be classified");
  if (created.source !== "auto_detected") throw new Error("source should be auto_detected");
  if (created.tier !== "winner" && created.tier !== "super_winner") {
    throw new Error(`unexpected tier ${created.tier}`);
  }

  // Raise thresholds dramatically — must NOT reclassify / change tier
  await upsertModelWinnerThresholds({
    model_id: modelId,
    winner_threshold_views: 50_000_000,
    super_winner_threshold_views: 100_000_000,
    updated_by: "verify-winner-auto-detect",
  });

  const second = await detectWinnersFromClarioSuitePosts({ modelRecordId: modelId });
  console.log("Second detect (high thresholds):", {
    classified: second.classified,
    skippedAlreadyClassified: second.skippedAlreadyClassified,
  });

  if (second.classified !== 0) {
    throw new Error("Threshold raise must not create new classifications for already-classified media");
  }
  if (second.skippedAlreadyClassified < 1) {
    throw new Error("Expected already-classified skip");
  }

  const { data: row } = await sb
    .from("winner_submissions")
    .select("id, tier, source, winner_threshold_at_classification, view_count")
    .eq("clariosuite_media_id", sample.media_id)
    .maybeSingle();

  if (!row) throw new Error("Submission missing after second run");
  if (row.tier !== created.tier) {
    throw new Error(`Tier changed retroactively: was ${created.tier}, now ${row.tier}`);
  }
  if (Number(row.winner_threshold_at_classification) !== 1000) {
    throw new Error(
      `threshold snapshot should stay 1000, got ${row.winner_threshold_at_classification}`,
    );
  }

  // Duplicate cycle again
  const third = await detectWinnersFromClarioSuitePosts({ modelRecordId: modelId });
  if (third.classified !== 0) throw new Error("Third cycle created duplicates");

  const { count } = await sb
    .from("winner_submissions")
    .select("id", { count: "exact", head: true })
    .eq("clariosuite_media_id", sample.media_id);

  if ((count ?? 0) !== 1) throw new Error(`Expected 1 row for media, got ${count}`);

  // Restore defaults for the model
  await upsertModelWinnerThresholds({
    model_id: modelId,
    winner_threshold_views: 100_000,
    super_winner_threshold_views: 300_000,
    updated_by: "verify-winner-auto-detect",
  });

  console.log("OK — auto-detect classifies once, non-retroactive, no duplicates.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
