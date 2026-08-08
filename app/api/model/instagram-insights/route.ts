import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getModelContext } from "@/lib/model-context-server";
import { bestTimeToPostUtc } from "@/lib/clariosuite-api";
import {
  resolveInflowwStatsRange,
  type InflowwStatsPreset,
} from "@/services/infloww-performance";
import {
  getClarioSuiteAudienceSnapshot,
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

function friendlyBestTimeLabel(hourUtc: number): string {
  const start = hourUtc % 24;
  const end = (start + 2) % 24;
  const fmt = (h: number) => {
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12} ${ampm}`;
  };
  return `${fmt(start)}–${fmt(end)} UTC`;
}

/**
 * GET /api/model/instagram-insights
 * Own-model ClarioSuite Instagram insights for the Earnings Instagram tab.
 */
export async function GET(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { modelRecord, linkedModelId } = await getModelContext();
  if (!linkedModelId || !modelRecord) {
    return NextResponse.json({ error: "Model profile not linked", linked: false }, { status: 404 });
  }

  const igUserId = modelRecord.clariosuite_ig_user_id?.trim() || null;
  if (!igUserId) {
    return NextResponse.json({
      linked: false,
      modelName: modelRecord.model_name,
      range: null,
      daily: [],
      totals: null,
      audience: null,
      bestTime: null,
      topPosts: [],
      message:
        "Your Instagram account isn’t linked yet. Ask an admin to connect it in Accounts → Models.",
    });
  }

  const url = new URL(request.url);
  const preset = (url.searchParams.get("preset") || "this_month") as InflowwStatsPreset;
  const range = resolveInflowwStatsRange(preset);

  const [daily, audienceRow, topPosts] = await Promise.all([
    queryClarioSuiteDailyInsights({
      modelRecordId: modelRecord.id,
      startYmd: range.startYmd,
      endYmd: range.endYmd,
    }),
    getClarioSuiteAudienceSnapshot({ modelRecordId: modelRecord.id }),
    queryClarioSuiteTopPosts({ modelRecordId: modelRecord.id, limit: 8 }),
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
    linked: true,
    modelName: modelRecord.model_name,
    range,
    daily,
    totals: {
      reach,
      views,
      total_interactions: interactions,
      avg_engagement_rate: avgEr,
      follower_delta: followerDelta,
    },
    audience: audienceRow
      ? {
          followers_count: audienceRow.followers_count ?? null,
          age_ranges: asBuckets(audienceRow.age_ranges).slice(0, 6),
          countries: asBuckets(audienceRow.countries).slice(0, 5),
          gender_split: asBuckets(audienceRow.gender_split),
        }
      : null,
    bestTime: best
      ? {
          hourUtc: best.hour,
          friendlyLabel: friendlyBestTimeLabel(best.hour),
          message: `You get the most engagement around ${friendlyBestTimeLabel(best.hour)} — that's a great time to post!`,
        }
      : null,
    topPosts,
  });
}
