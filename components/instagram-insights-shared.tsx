"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { Check, ChevronDown, Clapperboard, ImageIcon, Layers, Search, Sparkles } from "lucide-react";
import { IgInstagramExternalButton, IgViewStatsButton } from "@/components/instagram-insights-buttons";
import { MR_SELECT_TRIGGER } from "@/components/manager-review-ui";
import { VA_CARD, VA_FILTER_INPUT } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";
import {
  CHART_TOOLTIP_STYLE,
  classifyIgPost,
  fmtNum,
  fmtPct,
  genderLabel,
  GENDER_COLORS,
  igPostGroupLabel,
  rankMedal,
  type IgPostGroup,
} from "@/lib/instagram-insights-ui";
import { InstagramPostDetailModal } from "@/components/instagram-post-detail-modal";

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
  media_product_type?: string | null;
  caption: string | null;
  image_url?: string | null;
  engagement_score: number | null;
  reach?: number;
  likes: number;
  comments: number;
  shares?: number;
  saved?: number;
  views?: number;
  posted_at?: string | null;
  rank: number;
};

function MediaTypeBadge({ group }: { group: IgPostGroup }) {
  if (group === "reels") {
    return (
      <span className="absolute bottom-1 right-1 inline-flex items-center gap-0.5 rounded bg-black/70 px-1 py-0.5 text-[9px] font-semibold text-white/90 backdrop-blur-sm">
        <Clapperboard className="h-2.5 w-2.5" /> Reel
      </span>
    );
  }
  if (group === "carousels") {
    return (
      <span className="absolute bottom-1 right-1 inline-flex items-center gap-0.5 rounded bg-black/70 px-1 py-0.5 text-[9px] font-semibold text-white/90 backdrop-blur-sm">
        <Layers className="h-2.5 w-2.5" /> Album
      </span>
    );
  }
  return null;
}

export function TopPostCard({
  post,
  compact,
  onSelect,
}: {
  post: IgTopPost;
  compact?: boolean;
  onSelect?: (post: IgTopPost) => void;
}) {
  const medal = rankMedal(post.rank);
  const group = classifyIgPost({
    mediaType: post.media_type,
    mediaProductType: post.media_product_type,
  });
  const interactive = Boolean(onSelect);

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-black/25 transition",
        medal ? medal.className : "border-white/8",
        compact ? "p-3" : "p-3.5",
        interactive && "cursor-pointer hover:bg-black/40 focus-within:ring-1 focus-within:ring-[#FF1493]/40"
      )}
    >
      <div
        className="flex gap-3 text-left"
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        onClick={interactive ? () => onSelect?.(post) : undefined}
        onKeyDown={
          interactive
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect?.(post);
                }
              }
            : undefined
        }
      >
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
          <MediaTypeBadge group={group} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn("line-clamp-2 text-sm text-white/90", compact && "line-clamp-1")}>
            {post.caption?.trim() || igPostGroupLabel(group)}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/45">
            <span className="font-semibold text-[#D4AF8C]">
              {post.engagement_score != null ? `${post.engagement_score.toFixed(1)}% score` : "—"}
            </span>
            {post.reach != null ? <span>{fmtNum(post.reach)} reach</span> : null}
            <span>{fmtNum(post.likes)} likes</span>
            <span>{fmtNum(post.comments)} comments</span>
          </div>
          {interactive ? (
            <IgViewStatsButton
              onClick={(e) => {
                e.stopPropagation();
                onSelect?.(post);
              }}
              className="mt-2"
            />
          ) : post.permalink ? (
            <div className="mt-2" onClick={(e) => e.stopPropagation()}>
              <IgInstagramExternalButton href={post.permalink} className="md:w-auto" />
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

const GROUP_TABS: IgPostGroup[] = ["reels", "carousels", "posts"];

export function TopPostsLeaderboard({
  posts,
  loading,
  emptyDetail,
  compact,
  detailUrlFor,
}: {
  posts: IgTopPost[];
  loading?: boolean;
  emptyDetail?: string;
  compact?: boolean;
  /** Build lazy detail fetch URL for a media id. Enables click → detail modal. */
  detailUrlFor?: (mediaId: string) => string;
}) {
  const grouped = React.useMemo(() => {
    const buckets: Record<IgPostGroup, IgTopPost[]> = {
      reels: [],
      carousels: [],
      posts: [],
    };
    for (const p of posts) {
      buckets[
        classifyIgPost({
          mediaType: p.media_type,
          mediaProductType: p.media_product_type,
        })
      ].push(p);
    }
    return buckets;
  }, [posts]);

  const availableTabs = GROUP_TABS.filter((g) => grouped[g].length > 0);
  const [tab, setTab] = React.useState<IgPostGroup | "all">("all");
  const [selected, setSelected] = React.useState<IgTopPost | null>(null);

  React.useEffect(() => {
    if (tab !== "all" && !grouped[tab].length) setTab("all");
  }, [tab, grouped]);

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

  const visible =
    tab === "all" ? posts : grouped[tab];
  const podium = visible.filter((p) => p.rank <= 3);
  const rest = visible.filter((p) => p.rank > 3);
  const onSelect = detailUrlFor ? (p: IgTopPost) => setSelected(p) : undefined;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setTab("all")}
          className={cn(
            "rounded-full border px-3 py-1 text-[11px] font-semibold transition",
            tab === "all"
              ? "border-[#FF1493]/50 bg-[#FF1493]/15 text-[#FFB6DE]"
              : "border-white/10 bg-white/[0.03] text-white/55 hover:bg-white/[0.06]"
          )}
        >
          All ({posts.length})
        </button>
        {GROUP_TABS.map((g) => {
          const count = grouped[g].length;
          if (!count && !availableTabs.includes(g)) return null;
          return (
            <button
              key={g}
              type="button"
              disabled={!count}
              onClick={() => setTab(g)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold transition disabled:opacity-35",
                tab === g
                  ? "border-[#D4AF8C]/50 bg-[#D4AF8C]/15 text-[#E8D0B0]"
                  : "border-white/10 bg-white/[0.03] text-white/55 hover:bg-white/[0.06]"
              )}
            >
              {g === "reels" ? <Clapperboard className="h-3 w-3" /> : null}
              {g === "carousels" ? <Layers className="h-3 w-3" /> : null}
              {igPostGroupLabel(g)} ({count})
            </button>
          );
        })}
      </div>

      {!visible.length ? (
        <p className="py-8 text-center text-sm text-white/35">
          No {tab === "all" ? "posts" : igPostGroupLabel(tab as IgPostGroup).toLowerCase()} in this
          sync set.
        </p>
      ) : (
        <>
          <div className={cn("grid gap-3", podium.length > 1 ? "md:grid-cols-3" : "grid-cols-1")}>
            {podium.map((p) => (
              <TopPostCard key={p.media_id} post={p} compact={compact} onSelect={onSelect} />
            ))}
          </div>
          {rest.length ? (
            <div className={cn("grid gap-3", compact ? "sm:grid-cols-1" : "sm:grid-cols-2")}>
              {rest.map((p) => (
                <TopPostCard key={p.media_id} post={p} compact onSelect={onSelect} />
              ))}
            </div>
          ) : null}
        </>
      )}

      <InstagramPostDetailModal
        open={Boolean(selected && detailUrlFor)}
        onClose={() => setSelected(null)}
        detailUrl={selected && detailUrlFor ? detailUrlFor(selected.media_id) : null}
        seed={selected}
      />
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

/* ── Admin filter bar ─────────────────────────────────────────── */

export type IgModelOption = { id: string; name: string };

function modelInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : "?";
}

function ModelInitialAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "h-6 w-6 text-[10px]" : "h-7 w-7 text-[11px]";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-[#FF1493]/15 font-semibold text-[#FFB6DE]",
        dim
      )}
    >
      {modelInitial(name)}
    </span>
  );
}

export function IgModelPicker({
  models,
  value,
  onChange,
  disabled,
  loading,
  emptyLabel = "No linked models",
  className,
}: {
  models: IgModelOption[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  loading?: boolean;
  emptyLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const rootRef = React.useRef<HTMLDivElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const [portalPos, setPortalPos] = React.useState<{
    left: number;
    width: number;
    top?: number;
    bottom?: number;
  } | null>(null);

  const selected = models.find((m) => m.id === value);
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return models;
    return models.filter((m) => m.name.toLowerCase().includes(q));
  }, [models, query]);

  const updatePortalPosition = React.useCallback(() => {
    const root = rootRef.current;
    if (!root || !open) return;
    const rect = root.getBoundingClientRect();
    const need = 280;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const up = spaceBelow < need && spaceAbove > spaceBelow;
    const gap = 4;
    if (up) {
      setPortalPos({
        left: rect.left,
        width: rect.width,
        bottom: window.innerHeight - rect.top + gap,
      });
    } else {
      setPortalPos({
        left: rect.left,
        width: rect.width,
        top: rect.bottom + gap,
      });
    }
  }, [open]);

  React.useLayoutEffect(() => {
    if (!open) {
      setPortalPos(null);
      return;
    }
    updatePortalPosition();
    window.addEventListener("resize", updatePortalPosition);
    window.addEventListener("scroll", updatePortalPosition, true);
    return () => {
      window.removeEventListener("resize", updatePortalPosition);
      window.removeEventListener("scroll", updatePortalPosition, true);
    };
  }, [open, updatePortalPosition, models.length]);

  React.useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const t = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const isDisabled = disabled || loading || models.length === 0;

  const listbox = (
    <div
      ref={panelRef}
      role="listbox"
      className="max-h-72 overflow-y-auto rounded-xl border border-white/10 bg-[#1a1a1a] shadow-2xl"
      style={
        portalPos
          ? {
              position: "fixed",
              left: portalPos.left,
              width: portalPos.width,
              zIndex: 10050,
              ...(portalPos.top != null ? { top: portalPos.top } : {}),
              ...(portalPos.bottom != null ? { bottom: portalPos.bottom } : {}),
            }
          : undefined
      }
    >
      <div className="sticky top-0 z-10 border-b border-white/10 bg-[#1a1a1a] p-2">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/35"
            aria-hidden
          />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search models…"
            className={cn(
              VA_FILTER_INPUT,
              "h-11 w-full pl-9 shadow-[inset_0_2px_6px_rgba(0,0,0,0.35)]"
            )}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
            }}
          />
        </div>
      </div>
      {filtered.length === 0 ? (
        <p className="px-4 py-3 text-sm text-white/40">No models match your search.</p>
      ) : (
        filtered.map((m) => {
          const active = value === m.id;
          return (
            <button
              key={m.id}
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => {
                onChange(m.id);
                setOpen(false);
              }}
              className={cn(
                "flex min-h-[44px] w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition hover:bg-white/10",
                active && "bg-[#FF1493]/10"
              )}
            >
              <ModelInitialAvatar name={m.name} size="sm" />
              <span className={cn("min-w-0 flex-1 truncate", active ? "font-medium text-[#FFB6DE]" : "text-white")}>
                {m.name}
              </span>
              {active ? <Check className="h-4 w-4 shrink-0 text-[#FF1493]" /> : null}
            </button>
          );
        })
      )}
    </div>
  );

  return (
    <div
      ref={rootRef}
      className={cn("relative min-w-0", className)}
      style={{ zIndex: open ? 50 : 1 }}
    >
      <button
        type="button"
        disabled={isDisabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => !isDisabled && setOpen((v) => !v)}
        className={cn(
          MR_SELECT_TRIGGER,
          "flex min-h-[44px] w-full items-center justify-between gap-2 px-3 text-left",
          open && "border-[#FF1493]/50 shadow-[0_0_16px_-4px_rgba(255,20,147,0.25)]"
        )}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          {selected ? (
            <>
              <ModelInitialAvatar name={selected.name} />
              <span className="truncate text-white">{selected.name}</span>
            </>
          ) : (
            <span className="text-white/45">{models.length === 0 ? emptyLabel : "Select model…"}</span>
          )}
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-white/40 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && !isDisabled && portalPos && typeof document !== "undefined"
        ? createPortal(listbox, document.body)
        : null}
    </div>
  );
}

export type IgContentTypeFilter = "all" | "reels" | "carousels" | "posts";

const IG_CONTENT_TYPE_OPTIONS: { id: IgContentTypeFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "reels", label: "Reels" },
  { id: "carousels", label: "Carousels" },
  { id: "posts", label: "Posts" },
];

export function IgContentTypeChips({
  value,
  onChange,
  className,
}: {
  value: IgContentTypeFilter;
  onChange: (next: IgContentTypeFilter) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {IG_CONTENT_TYPE_OPTIONS.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={cn(
              "min-h-[44px] rounded-full border px-4 py-2 text-xs font-semibold transition duration-200 motion-reduce:transition-none",
              active
                ? "border-[#FF1493]/50 bg-[#FF1493]/15 text-[#FFB6DE] shadow-[0_0_24px_-8px_rgba(255,20,147,0.55)]"
                : "border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:text-white"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
