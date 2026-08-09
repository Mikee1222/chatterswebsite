"use client";

import * as React from "react";
import { ImageIcon, Play, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtNum, formatIgPostedAt } from "@/lib/instagram-insights-ui";
import { IgEmptyState } from "@/components/instagram-insights-shared";
import { IgInstagramExternalButton } from "@/components/instagram-insights-buttons";

export type IgStory = {
  id: string;
  media_type: string | null;
  permalink: string | null;
  image_url: string | null;
  posted_at: string | null;
  reach: number | null;
  views: number | null;
};

export type IgStoriesPayload = {
  active: IgStory[];
  has_metrics: boolean;
  error: string | null;
};

function storyMediaKind(mediaType: string | null): "video" | "photo" | "unknown" {
  const t = (mediaType ?? "").trim().toUpperCase();
  if (t.includes("VIDEO")) return "video";
  if (t.includes("IMAGE") || t.includes("PHOTO")) return "photo";
  return "unknown";
}

function StoryMediaTypeBadge({ mediaType }: { mediaType: string | null }) {
  const kind = storyMediaKind(mediaType);
  const Icon = kind === "video" ? Play : kind === "photo" ? ImageIcon : Sparkles;
  const label = kind === "video" ? "Video" : kind === "photo" ? "Photo" : "Story";

  return (
    <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-lg border border-white/15 bg-black/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/90 backdrop-blur-sm">
      <Icon className={cn("h-3 w-3", kind === "video" && "fill-current")} aria-hidden />
      {label}
    </span>
  );
}

function StoryStatChip({
  label,
  value,
  unavailable,
  accent = "pink",
}: {
  label: string;
  value?: string;
  unavailable?: boolean;
  accent?: "pink" | "champagne";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium tabular-nums",
        unavailable
          ? "border-white/8 bg-white/[0.03] text-white/35"
          : accent === "champagne"
            ? "border-[#D4AF8C]/25 bg-[#D4AF8C]/[0.08] text-[#E8D0B0]"
            : "border-[#FF1493]/25 bg-[#FF1493]/[0.08] text-[#FFB6DE]"
      )}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wider opacity-70">{label}</span>
      {unavailable ? (
        <span className="normal-case tracking-normal">not available</span>
      ) : (
        <span className="font-semibold text-white/90">{value}</span>
      )}
    </span>
  );
}

function formatStoryTimestamp(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const diffMs = Date.now() - t;
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins >= 0 && diffMins < 60) {
    return diffMins <= 1 ? "Just now" : `${diffMins}m ago`;
  }
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return formatIgPostedAt(iso);
}

export function IgStoryCard({
  story,
  showMetrics,
  metricsUnavailableNote,
}: {
  story: IgStory;
  showMetrics: boolean;
  metricsUnavailableNote?: string;
}) {
  const kind = storyMediaKind(story.media_type);
  const PlaceholderIcon = kind === "video" ? Play : kind === "photo" ? ImageIcon : Sparkles;
  const posted = formatStoryTimestamp(story.posted_at);
  const hasReach = story.reach != null && Number.isFinite(story.reach);
  const hasViews = story.views != null && Number.isFinite(story.views);

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-black/30 to-black/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="relative aspect-[9/16] max-h-52 w-full overflow-hidden bg-white/[0.03]">
        {story.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={story.image_url}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#FF1493]/[0.06] via-black/20 to-[#D4AF8C]/[0.06] text-white/30">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm">
              <PlaceholderIcon
                className={cn("h-6 w-6", kind === "video" && "fill-current")}
                aria-hidden
              />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-white/25">
              No preview
            </span>
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 to-transparent" />
        <StoryMediaTypeBadge mediaType={story.media_type} />
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-3">
        {posted ? (
          <p className="text-[11px] font-medium text-white/45">{posted}</p>
        ) : null}

        {showMetrics ? (
          <div className="flex flex-wrap gap-1.5">
            {hasReach ? (
              <StoryStatChip label="Reach" value={fmtNum(story.reach)} accent="pink" />
            ) : null}
            {hasViews ? (
              <StoryStatChip label="Views" value={fmtNum(story.views)} accent="champagne" />
            ) : hasReach ? (
              <StoryStatChip label="Views" unavailable />
            ) : null}
          </div>
        ) : metricsUnavailableNote ? (
          <p className="text-[11px] leading-snug text-white/35">{metricsUnavailableNote}</p>
        ) : null}

        {story.permalink ? (
          <div className="mt-auto pt-0.5">
            <IgInstagramExternalButton href={story.permalink} />
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function IgStoriesSection({
  stories,
  emptyTitle,
  emptyDetail,
  errorTitle,
  errorDetail,
  metricsUnavailableNote = "Performance metrics not provided by Instagram for these Stories.",
}: {
  stories: IgStoriesPayload | null | undefined;
  emptyTitle: string;
  emptyDetail: string;
  errorTitle: string;
  errorDetail: string;
  metricsUnavailableNote?: string;
}) {
  if (stories?.error) {
    return <IgEmptyState title={errorTitle} detail={errorDetail} />;
  }

  if (!stories?.active?.length) {
    return <IgEmptyState title={emptyTitle} detail={emptyDetail} />;
  }

  const count = stories.active.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2.5 rounded-full border border-[#FF1493]/25 bg-[#FF1493]/[0.08] px-3.5 py-2">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FF1493]/50 opacity-75 motion-reduce:animate-none" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#FF1493]" />
          </span>
          <span className="text-xs font-semibold text-[#FFB6DE]">
            {count} currently active
          </span>
        </div>
        {!stories.has_metrics ? (
          <span className="text-[11px] text-white/40">Metrics not provided by API</span>
        ) : null}
      </div>

      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 snap-x snap-mandatory scrollbar-thin md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 lg:grid-cols-3">
        {stories.active.map((s) => (
          <div
            key={s.id}
            className="w-[72vw] max-w-[260px] shrink-0 snap-start md:w-auto md:max-w-none md:shrink"
          >
            <IgStoryCard
              story={s}
              showMetrics={stories.has_metrics}
              metricsUnavailableNote={!stories.has_metrics ? metricsUnavailableNote : undefined}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
