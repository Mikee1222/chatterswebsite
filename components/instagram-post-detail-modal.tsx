"use client";

import * as React from "react";
import { AnimatePresence } from "framer-motion";
import { ExternalLink, ImageIcon, Layers } from "lucide-react";
import { GlassModal } from "@/components/ui/glass-modal";
import { cn } from "@/lib/utils";
import {
  fmtNum,
  fmtPct,
  formatIgPostedAt,
  igPostGroupLabel,
  type IgPostGroup,
} from "@/lib/instagram-insights-ui";

export type IgMediaDetail = {
  media_id: string;
  permalink: string | null;
  media_type: string | null;
  media_product_type: string | null;
  group: IgPostGroup;
  caption: string | null;
  image_url: string | null;
  posted_at: string | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saved: number | null;
  views: number | null;
  video_views: number | null;
  total_interactions: number | null;
  engagement_score: number | null;
  children: Array<{
    id: string;
    mediaType: string | null;
    mediaUrl: string | null;
    permalink: string | null;
  }>;
  children_note: string | null;
};

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-white/90">{value}</p>
    </div>
  );
}

export function InstagramPostDetailModal({
  open,
  onClose,
  detailUrl,
  seed,
}: {
  open: boolean;
  onClose: () => void;
  /** Full URL to lazy-fetch detail (admin or model route). */
  detailUrl: string | null;
  seed?: {
    media_id: string;
    caption?: string | null;
    image_url?: string | null;
    media_type?: string | null;
    media_product_type?: string | null;
    permalink?: string | null;
    engagement_score?: number | null;
    reach?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    saved?: number;
    views?: number;
    posted_at?: string | null;
  } | null;
}) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<IgMediaDetail | null>(null);

  React.useEffect(() => {
    if (!open || !detailUrl) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDetail(null);
    void (async () => {
      try {
        const res = await fetch(detailUrl, { cache: "no-store" });
        const json = (await res.json()) as IgMediaDetail & { error?: string };
        if (!res.ok) throw new Error(json.error || `Failed (${res.status})`);
        if (!cancelled) setDetail(json);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load post details");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, detailUrl]);

  const group = detail?.group;
  const posted = formatIgPostedAt(detail?.posted_at ?? seed?.posted_at);
  const title = group ? igPostGroupLabel(group) : "Post details";

  return (
    <AnimatePresence>
      {open ? (
        <GlassModal
          onClose={onClose}
          title={title}
          subtitle={posted ? `Posted ${posted}` : "Live insights from ClarioSuite"}
          className="md:max-w-lg"
        >
          <div className="space-y-4 px-4 py-4 md:px-5">
            <div className="flex gap-3">
              <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]">
                {(detail?.image_url || seed?.image_url) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={detail?.image_url || seed?.image_url || ""}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-white/25">
                    <ImageIcon className="h-7 w-7" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug text-white/85">
                  {(detail?.caption || seed?.caption)?.trim() || "No caption"}
                </p>
                <p className="mt-1.5 text-[11px] text-white/40">
                  {[detail?.media_type || seed?.media_type, detail?.media_product_type || seed?.media_product_type]
                    .filter(Boolean)
                    .join(" · ") || "Instagram media"}
                </p>
                {(detail?.permalink || seed?.permalink) ? (
                  <a
                    href={detail?.permalink || seed?.permalink || "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#FFB6DE] hover:underline"
                  >
                    Open on Instagram <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null}
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded-xl bg-white/5" />
                ))}
              </div>
            ) : null}

            {error ? (
              <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {error}
                {seed ? " Showing synced stats where available." : null}
              </p>
            ) : null}

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <StatCell
                label="Engagement"
                value={
                  (detail?.engagement_score ?? seed?.engagement_score) != null
                    ? fmtPct(detail?.engagement_score ?? seed?.engagement_score ?? null, 1)
                    : "—"
                }
              />
              <StatCell
                label="Reach"
                value={fmtNum(detail?.reach ?? seed?.reach)}
              />
              <StatCell label="Likes" value={fmtNum(detail?.likes ?? seed?.likes)} />
              <StatCell
                label="Comments"
                value={fmtNum(detail?.comments ?? seed?.comments)}
              />
              <StatCell label="Shares" value={fmtNum(detail?.shares ?? seed?.shares)} />
              <StatCell label="Saved" value={fmtNum(detail?.saved ?? seed?.saved)} />
              <StatCell
                label="Views"
                value={fmtNum(detail?.views ?? detail?.video_views ?? seed?.views)}
              />
              <StatCell
                label="Interactions"
                value={fmtNum(detail?.total_interactions)}
              />
            </div>

            {detail?.children?.length ? (
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <Layers className="h-3.5 w-3.5 text-[#D4AF8C]" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/45">
                    Carousel slides ({detail.children.length})
                  </p>
                </div>
                {detail.children_note ? (
                  <p className="mb-2 text-[11px] text-white/35">{detail.children_note}</p>
                ) : null}
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {detail.children.map((child, idx) => (
                    <div
                      key={child.id}
                      className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]"
                    >
                      {child.mediaUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={child.mediaUrl}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-white/25">
                          <ImageIcon className="h-4 w-4" />
                        </div>
                      )}
                      <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1 text-[9px] font-medium text-white/80">
                        {idx + 1}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {!loading && !detail && !error && seed ? (
              <p className={cn("text-[11px] text-white/35")}>Loading live insights…</p>
            ) : null}
          </div>
        </GlassModal>
      ) : null}
    </AnimatePresence>
  );
}
