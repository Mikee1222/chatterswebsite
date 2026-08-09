import { listClarioSuiteStories } from "@/lib/clariosuite-api";
import type { IgStoriesPayload, IgStory } from "@/components/instagram-stories-ui";

type StoryRow = Awaited<ReturnType<typeof listClarioSuiteStories>>["data"][number];

function storyInsightMetrics(insight: StoryRow["insight"]) {
  const reach =
    insight?.reach != null && Number.isFinite(insight.reach) ? Math.round(insight.reach) : null;
  const views =
    insight?.views != null && Number.isFinite(insight.views)
      ? Math.round(insight.views)
      : insight?.videoViews != null && Number.isFinite(insight.videoViews)
        ? Math.round(insight.videoViews)
        : null;
  return { reach, views };
}

/** Oldest-first — matches Instagram story playback order. */
export function sortStoriesOldestFirst(stories: IgStory[]): IgStory[] {
  return [...stories].sort((a, b) => {
    const ta = a.posted_at ? Date.parse(a.posted_at) : 0;
    const tb = b.posted_at ? Date.parse(b.posted_at) : 0;
    if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta - tb;
    return a.id.localeCompare(b.id);
  });
}

export function mapClarioSuiteStoryRow(s: StoryRow): IgStory {
  const { reach, views } = storyInsightMetrics(s.insight);
  const mediaUrl = s.mediaUrl?.trim() || null;
  return {
    id: String(s.id),
    media_type: s.mediaType ?? null,
    permalink: s.permalink ?? null,
    image_url: s.imageUrl || null,
    media_url: mediaUrl,
    posted_at: s.timestamp || null,
    reach,
    views,
  };
}

export async function fetchClarioSuiteStoriesPayload(igUserId: string): Promise<IgStoriesPayload> {
  try {
    const { data: storyRows } = await listClarioSuiteStories(igUserId);
    const active = sortStoriesOldestFirst((storyRows ?? []).map(mapClarioSuiteStoryRow));
    return {
      active,
      has_metrics: active.some((a) => a.reach != null || a.views != null),
      error: null,
    };
  } catch (err) {
    return {
      active: [],
      has_metrics: false,
      error: err instanceof Error ? err.message : "Stories unavailable",
    };
  }
}
