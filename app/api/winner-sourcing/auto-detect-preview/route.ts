import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { detectWinnersFromClarioSuitePosts } from "@/services/winner-auto-detect";

/**
 * Dry run of the ClarioSuite winner auto-detect — writes nothing.
 * Shows which already-synced posts the next sync would classify, and by which rule.
 *   GET /api/winner-sourcing/auto-detect-preview
 *   GET /api/winner-sourcing/auto-detect-preview?relative=1   → as if every model had the
 *       relative rule enabled (to see the impact before switching it on)
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
  const forceRelative = url.searchParams.get("relative") === "1";
  try {
    const r = await detectWinnersFromClarioSuitePosts({ modelRecordId, dryRun: true, forceRelative });
    const list = r.wouldClassify ?? [];
    const byModel: Record<string, { total: number; absolute: number; relative: number; both: number }> = {};
    for (const w of list) {
      const m = (byModel[w.model_name] ??= { total: 0, absolute: 0, relative: 0, both: 0 });
      m.total += 1;
      m[w.by] += 1;
    }
    return NextResponse.json({
      dry_run: true,
      relative_forced: forceRelative,
      scanned: r.scanned,
      would_classify: list.length,
      by_model: byModel,
      skipped: {
        already_classified: r.skippedAlreadyClassified,
        not_video: r.skippedNotVideo,
        below_threshold: r.skippedBelowThreshold,
        outside_window: r.skippedOutsideWindow,
        no_permalink: r.skippedNoPermalink,
        duplicate_link: r.skippedDuplicateLink,
      },
      items: list,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}
