"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { ExternalLink, ImageIcon, Sparkles } from "lucide-react";
import { VA_CARD } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";
import {
  CHART_TOOLTIP_STYLE,
  fmtNum,
  fmtPct,
  genderLabel,
  GENDER_COLORS,
  rankMedal,
} from "@/lib/instagram-insights-ui";

const ResponsiveContainer = dynamic(() => import("recharts").then((m) => m.ResponsiveContainer), {
  ssr: false,
});
const PieChart = dynamic(() => import("recharts").then((m) => m.PieChart), { ssr: false });
const Pie = dynamic(() => import("recharts").then((m) => m.Pie), { ssr: false });
const Cell = dynamic(() => import("recharts").then((m) => m.Cell), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });

export function IgSkeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-white/5", className)} />;
}

export function IgEmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className={cn(VA_CARD, "flex flex-col items-center justify-center px-6 py-12 text-center")}>
      <Sparkles className="mb-3 h-6 w-6 text-[#D4AF8C]/70" />
      <p className="text-sm font-medium text-white/80">{title}</p>
      <p className="mt-1 max-w-md text-xs text-white/45">{detail}</p>
    </div>
  );
}

export type IgTopPost = {
  media_id: string;
  permalink: string | null;
  media_type?: string | null;
  caption: string | null;
  image_url?: string | null;
  engagement_score: number | null;
  reach?: number;
  likes: number;
  comments: number;
  shares?: number;
  saved?: number;
  views?: number;
  rank: number;
};

export function TopPostCard({
  post,
  compact,
}: {
  post: IgTopPost;
  compact?: boolean;
}) {
  const medal = rankMedal(post.rank);
  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-black/25 transition hover:bg-black/35",
        medal ? medal.className : "border-white/8",
        compact ? "p-3" : "p-3.5"
      )}
    >
      <div className="flex gap-3">
        <div
          className={cn(
            "relative shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]",
            compact ? "h-16 w-16" : "h-20 w-20 sm:h-24 sm:w-24"
          )}
        >
          {post.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.image_url}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-white/25">
              <ImageIcon className={compact ? "h-5 w-5" : "h-6 w-6"} />
            </div>
          )}
          <span
            className={cn(
              "absolute left-1 top-1 flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[10px] font-bold shadow-sm",
              medal ? medal.badgeClass : "bg-black/60 text-white/80 backdrop-blur-sm"
            )}
          >
            {medal ? medal.badge : `#${post.rank}`}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn("line-clamp-2 text-sm text-white/90", compact && "line-clamp-1")}>
            {post.caption?.trim() || post.media_type || "Instagram post"}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/45">
            <span className="font-semibold text-[#D4AF8C]">
              {post.engagement_score != null ? `${post.engagement_score.toFixed(1)}% score` : "—"}
            </span>
            {post.reach != null ? <span>{fmtNum(post.reach)} reach</span> : null}
            <span>{fmtNum(post.likes)} likes</span>
            <span>{fmtNum(post.comments)} comments</span>
          </div>
          {post.permalink ? (
            <a
              href={post.permalink}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#FFB6DE] hover:underline"
            >
              Open on Instagram <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function TopPostsLeaderboard({
  posts,
  loading,
  emptyDetail,
  compact,
}: {
  posts: IgTopPost[];
  loading?: boolean;
  emptyDetail?: string;
  compact?: boolean;
}) {
  if (!posts.length) {
    return (
      <IgEmptyState
        title={loading ? "Loading top posts…" : "No top posts yet"}
        detail={
          emptyDetail ||
          (loading
            ? "Fetching ranked posts from the latest sync."
            : "Run a ClarioSuite sync to pull the highest-engagement posts.")
        }
      />
    );
  }
  const podium = posts.filter((p) => p.rank <= 3);
  const rest = posts.filter((p) => p.rank > 3);
  return (
    <div className="space-y-3">
      <div className={cn("grid gap-3", podium.length > 1 ? "md:grid-cols-3" : "grid-cols-1")}>
        {podium.map((p) => (
          <TopPostCard key={p.media_id} post={p} compact={compact} />
        ))}
      </div>
      {rest.length ? (
        <div className={cn("grid gap-3", compact ? "sm:grid-cols-1" : "sm:grid-cols-2")}>
          {rest.map((p) => (
            <TopPostCard key={p.media_id} post={p} compact />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function GenderDonut({
  genders,
  height = 180,
}: {
  genders: Array<{ label: string; value: number }>;
  height?: number;
}) {
  const data = genders.map((g) => ({
    name: genderLabel(g.label),
    value: g.value,
  }));
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!data.length || total <= 0) {
    return (
      <p className="flex h-full min-h-[120px] items-center justify-center text-sm text-white/35">
        No gender data
      </p>
    );
  }
  return (
    <div className="flex h-full flex-col">
      <div style={{ height }} className="min-h-0 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={48}
              outerRadius={72}
              paddingAngle={data.length > 1 ? 3 : 0}
              stroke="rgba(10,10,16,0.9)"
              strokeWidth={2}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={GENDER_COLORS[entry.name] ?? "rgba(255,255,255,0.25)"}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              formatter={(v, name) => [
                `${fmtNum(Number(v))} (${total > 0 ? ((Number(v) / total) * 100).toFixed(0) : 0}%)`,
                String(name),
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-1 space-y-1.5 px-1">
        {data.map((d) => (
          <li key={d.name} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 text-white/65">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: GENDER_COLORS[d.name] ?? "rgba(255,255,255,0.25)" }}
              />
              {d.name}
            </span>
            <span className="tabular-nums text-white/85">
              {fmtPct((d.value / total) * 100, 0)} · {fmtNum(d.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RankedBarList({
  items,
  accent = "pink",
  formatLabel,
  empty = "No data",
}: {
  items: Array<{ label: string; value: number }>;
  accent?: "pink" | "champagne";
  formatLabel?: (label: string) => string;
  empty?: string;
}) {
  if (!items.length) {
    return <p className="py-8 text-center text-sm text-white/35">{empty}</p>;
  }
  const max = Math.max(...items.map((i) => i.value), 1);
  const bar =
    accent === "champagne"
      ? "bg-gradient-to-r from-[#D4AF8C]/90 to-[#D4AF8C]/45"
      : "bg-gradient-to-r from-[#FF1493]/90 to-[#FF1493]/40";
  return (
    <ul className="space-y-2.5">
      {items.map((item, idx) => {
        const pct = (item.value / max) * 100;
        return (
          <li key={`${item.label}-${idx}`}>
            <div className="mb-1 flex items-center justify-between gap-2 text-xs">
              <span className="truncate text-white/75">
                <span className="mr-1.5 text-white/35">{idx + 1}.</span>
                {formatLabel ? formatLabel(item.label) : item.label}
              </span>
              <span className="shrink-0 tabular-nums text-white/90">{fmtNum(item.value)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className={cn("h-full rounded-full transition-all duration-700", bar)}
                style={{ width: `${Math.max(pct, 4)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
