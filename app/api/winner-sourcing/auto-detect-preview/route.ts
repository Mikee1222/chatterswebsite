import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { detectWinnersFromClarioSuitePosts } from "@/services/winner-auto-detect";

/**
 * Dry run of the ClarioSuite winner auto-detect — writes nothing.
 * Shows which already-synced posts the next sync would classify, in which feed
 * (grid | trial — trial = link of a posting-brief post with placement trial), and the
 * baseline of every account + feed.
 *   GET /api/winner-sourcing/auto-detect-preview
 *   GET /api/winner-sourcing/auto-detect-preview?model_id=…
 */
export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.WINNER_SOURCING_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const url = new URL(req.url);
  const modelRecordId = url.searchParams.get("model_id")?.trim() || undefined;
  try {
    const r = await detectWinnersFromClarioSuitePosts({ modelRecordId, dryRun: true });
    const list = r.wouldClassify ?? [];
    const byModel: Record<
      string,
      { total: number; winners: number; super_winners: number; grid: number; trial: number }
    > = {};
    for (const w of list) {
      const m = (byModel[w.model_name] ??= { total: 0, winners: 0, super_winners: 0, grid: 0, trial: 0 });
      m.total += 1;
      if (w.tier === "super_winner") m.super_winners += 1;
      else m.winners += 1;
      if (w.feed === "trial") m.trial += 1;
      else m.grid += 1;
    }
    return NextResponse.json({
      dry_run: true,
      scanned: r.scanned,
      trial_matched: r.trialMatched,
      would_classify: list.length,
      // Live ×N: existing winners inside the window re-scored against tonight's baseline.
      rescored: r.rescored,
      would_withdraw: r.wouldWithdraw ?? [],
      kept_below_threshold: r.keptBelowThreshold,
      by_model: byModel,
      // One row per account + feed: the average the candidates were compared against.
      // baseline_count < 3 or no_views > 0 means ClarioSuite insights are missing.
      baselines: r.baselines,
      skipped: {
        already_classified: r.skippedAlreadyClassified,
        not_video: r.skippedNotVideo,
        outside_window: r.skippedOutsideWindow,
        no_views: r.skippedNoViews,
        no_baseline: r.skippedNoBaseline,
        below_threshold: r.skippedBelowThreshold,
        no_permalink: r.skippedNoPermalink,
        duplicate_link: r.skippedDuplicateLink,
      },
      items: list,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}
