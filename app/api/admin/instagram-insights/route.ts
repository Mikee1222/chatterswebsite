import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { bestTimeToPostUtc } from "@/lib/clariosuite-api";
import {
  resolveInflowwStatsRange,
  type InflowwStatsPreset,
} from "@/services/infloww-performance";
import {
  getClarioSuiteAudienceSnapshot,
  listLinkedClarioSuiteModels,
  queryClarioSuiteDailyInsights,
  queryClarioSuiteTopPosts,
} from "@/services/clariosuite-sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type DemoBucket = { label: string; value: number };

function asBuckets(v: unknown): DemoBucket[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const o = row as Record<string, unknown>;
      const label = typeof o.label === "string" ? o.label : String(o.label ?? "");
      const value = typeof o.value === "number" ? o.value : Number(o.value);
      if (!label || !Number.isFinite(value)) return null;
      return { label, value };
    })
    .filter((x): x is DemoBucket => Boolean(x));
}

function asOnlineHours(v: unknown): Array<{ hour: number; value: number }> {
  if (!Array.isArray(v)) return [];
  return v
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const o = row as Record<string, unknown>;
      const hour = typeof o.hour === "number" ? o.hour : Number(o.hour);
      const value = typeof o.value === "number" ? o.value : Number(o.value);
      if (!Number.isFinite(hour) || !Number.isFinite(value)) return null;
      return { hour, value };
    })
    .filter((x): x is { hour: number; value: number } => Boolean(x));
}

/**
 * GET /api/admin/instagram-insights
 * Aggregated ClarioSuite insights for admin Marketing dashboard.
 */
export async function GET(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.INSTAGRAM_INSIGHTS_VIEW))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const preset = (url.searchParams.get("preset") || "this_month") as InflowwStatsPreset;
  const customFrom = url.searchParams.get("from") ?? undefined;
  const customTo = url.searchParams.get("to") ?? undefined;
  const modelRecordId = url.searchParams.get("modelId")?.trim() || undefined;

  const range = resolveInflowwStatsRange(preset, customFrom, customTo);
  const linked = await listLinkedClarioSuiteModels();
  const models = linked.map((l) => ({
    id: l.modelRecordId,
    name: l.modelName,
    igUserId: l.igUserId,
  }));

  if (!models.length) {
    return NextResponse.json({
      range,
      models,
      selectedModelId: null,
      linked: false,
      daily: [],
      totals: { reach: 0, views: 0, total_interactions: 0, avg_engagement_rate: null, follower_start: null, follower_end: null, follower_delta: null },
      audience: null,
      bestTime: null,
      topPosts: [],
    });
  }

  const selected =
    (modelRecordId && linked.find((l) => l.modelRecordId === modelRecordId)) || linked[0]!;

  const [daily, audienceRow, topPosts] = await Promise.all([
    queryClarioSuiteDailyInsights({
      modelRecordId: selected.modelRecordId,
      startYmd: range.startYmd,
      endYmd: range.endYmd,
    }),
    getClarioSuiteAudienceSnapshot({ modelRecordId: selected.modelRecordId }),
    queryClarioSuiteTopPosts({ modelRecordId: selected.modelRecordId, limit: 10 }),
  ]);

  const reach = daily.reduce((s, d) => s + d.reach, 0);
  const views = daily.reduce((s, d) => s + d.views, 0);
  const interactions = daily.reduce((s, d) => s + d.total_interactions, 0);
  const erDays = daily.filter((d) => d.engagement_rate != null);
  const avgEr =
    erDays.length > 0
      ? erDays.reduce((s, d) => s + (d.engagement_rate ?? 0), 0) / erDays.length
      : reach > 0
        ? (interactions / reach) * 100
        : null;

  const withFollowers = daily.filter((d) => d.follower_count != null);
  const followerStart = withFollowers[0]?.follower_count ?? null;
  const followerEnd = withFollowers[withFollowers.length - 1]?.follower_count ?? null;
  const followerDelta =
    followerStart != null && followerEnd != null ? followerEnd - followerStart : null;

  const online = asOnlineHours(audienceRow?.online_followers_by_hour);
  const best = bestTimeToPostUtc(online);

  return NextResponse.json({
    range,
    models,
    selectedModelId: selected.modelRecordId,
    selectedIgUserId: selected.igUserId,
    linked: true,
    daily,
    totals: {
      reach,
      views,
      total_interactions: interactions,
      avg_engagement_rate: avgEr,
      follower_start: followerStart,
      follower_end: followerEnd,
      follower_delta: followerDelta,
    },
    audience: audienceRow
      ? {
          followers_count: audienceRow.followers_count ?? null,
          age_ranges: asBuckets(audienceRow.age_ranges),
          countries: asBuckets(audienceRow.countries),
          gender_split: asBuckets(audienceRow.gender_split),
          online_followers_by_hour: online,
          synced_at: audienceRow.synced_at ?? null,
        }
      : null,
    bestTime: best
      ? {
          hourUtc: best.hour,
          value: best.value,
          label: `${String(best.hour).padStart(2, "0")}:00–${String((best.hour + 1) % 24).padStart(2, "0")}:00 UTC`,
        }
      : null,
    topPosts,
  });
}
