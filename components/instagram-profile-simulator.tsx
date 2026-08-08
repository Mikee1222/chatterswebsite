"use client";

import * as React from "react";
import { Battery, Clapperboard, Grid3X3, Layers, MoreHorizontal, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtCompact, type IgPostGroup } from "@/lib/instagram-insights-ui";
import { InstagramPostDetailModal } from "@/components/instagram-post-detail-modal";
import { IgSkeleton } from "@/components/instagram-insights-shared";

function CellularBars({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 18 12" className={className} fill="currentColor" aria-hidden>
      <rect x="0" y="8" width="2.5" height="4" rx="0.5" />
      <rect x="4" y="5.5" width="2.5" height="6.5" rx="0.5" />
      <rect x="8" y="3" width="2.5" height="9" rx="0.5" />
      <rect x="12" y="0.5" width="2.5" height="11.5" rx="0.5" />
    </svg>
  );
}

type ProfilePayload = {
  profile: {
    igUserId: string;
    username: string;
    name: string | null;
    biography: string | null;
    website: string | null;
    profilePictureUrl: string | null;
    followersCount: number | null;
    followsCount: number | null;
    mediaCount: number | null;
  };
  highlightsAvailable: boolean;
  highlightsNote?: string;
  posts: Array<{
    media_id: string;
    permalink: string | null;
    media_type: string | null;
    media_product_type: string | null;
    caption: string | null;
    image_url: string | null;
    posted_at: string | null;
    group: IgPostGroup;
  }>;
  error?: string;
};

function IgGridIcon({ group }: { group: IgPostGroup }) {
  if (group === "reels") {
    return (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 drop-shadow" fill="white" aria-hidden>
        <path d="M8 5.14v13.72L19 12 8 5.14z" />
      </svg>
    );
  }
  if (group === "carousels") {
    return (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 drop-shadow" fill="none" stroke="white" strokeWidth="2" aria-hidden>
        <rect x="3" y="5" width="14" height="14" rx="1.5" />
        <path d="M19 8v10a2 2 0 0 1-2 2H7" />
      </svg>
    );
  }
  return null;
}

function StatusBar() {
  return (
    <div className="relative z-20 flex items-center justify-between px-5 pt-3 text-[11px] font-semibold text-black">
      <span className="tabular-nums">9:41</span>
      <div className="flex items-center gap-1">
        <CellularBars className="h-3 w-3" />
        <Wifi className="h-3 w-3" aria-hidden />
        <Battery className="h-3.5 w-3.5" aria-hidden />
      </div>
    </div>
  );
}

export function InstagramProfileSimulator({
  profileUrl,
  detailUrlFor,
  compact,
  className,
}: {
  profileUrl: string;
  detailUrlFor: (mediaId: string) => string;
  compact?: boolean;
  className?: string;
}) {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<ProfilePayload | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const selectedPost = data?.posts.find((p) => p.media_id === selectedId) ?? null;

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const res = await fetch(profileUrl, { cache: "no-store" });
        const json = (await res.json()) as ProfilePayload;
        if (!res.ok) throw new Error(json.error || `Failed (${res.status})`);
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load profile");
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profileUrl]);

  const profile = data?.profile;
  const scaleClass = compact
    ? "w-[min(100%,280px)]"
    : "w-[min(100%,340px)] sm:w-[min(100%,360px)]";

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div
        className={cn(
          "relative origin-top transition-transform duration-500 ease-out motion-reduce:transition-none",
          scaleClass
        )}
        style={{
          filter: "drop-shadow(0 28px 50px rgba(0,0,0,0.55)) drop-shadow(0 0 40px rgba(255,20,147,0.08))",
        }}
      >
        {/* iPhone frame */}
        <div
          className={cn(
            "relative overflow-hidden rounded-[2.6rem] border-[3px] border-[#2a2a2e] bg-[#1c1c1e]",
            "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]",
            compact ? "aspect-[9/17.5]" : "aspect-[9/18.5]"
          )}
        >
          {/* Side buttons (decorative) */}
          <div className="pointer-events-none absolute -left-[5px] top-24 h-8 w-[3px] rounded-l-sm bg-[#3a3a3e]" />
          <div className="pointer-events-none absolute -left-[5px] top-36 h-12 w-[3px] rounded-l-sm bg-[#3a3a3e]" />
          <div className="pointer-events-none absolute -right-[5px] top-32 h-16 w-[3px] rounded-r-sm bg-[#3a3a3e]" />

          {/* Screen */}
          <div className="absolute inset-[3px] overflow-hidden rounded-[2.35rem] bg-white">
            {/* Dynamic Island */}
            <div className="pointer-events-none absolute left-1/2 top-2.5 z-30 h-[22px] w-[96px] -translate-x-1/2 rounded-full bg-black shadow-sm" />

            <StatusBar />

            <div
              className={cn(
                "absolute inset-0 top-8 bottom-0 overflow-y-auto overscroll-contain bg-white text-black",
                "scrollbar-thin [scrollbar-width:thin]",
                "motion-reduce:scroll-auto"
              )}
            >
              {loading ? (
                <div className="space-y-3 px-3 pt-4">
                  <div className="flex items-center gap-3">
                    <IgSkeleton className="h-16 w-16 shrink-0 rounded-full bg-black/10" />
                    <div className="grid flex-1 grid-cols-3 gap-2">
                      <IgSkeleton className="h-10 bg-black/10" />
                      <IgSkeleton className="h-10 bg-black/10" />
                      <IgSkeleton className="h-10 bg-black/10" />
                    </div>
                  </div>
                  <IgSkeleton className="h-16 bg-black/10" />
                  <div className="grid grid-cols-3 gap-0.5">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <IgSkeleton key={i} className="aspect-square rounded-none bg-black/10" />
                    ))}
                  </div>
                </div>
              ) : error ? (
                <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                  <p className="text-sm font-semibold text-black/80">Couldn’t load profile</p>
                  <p className="mt-1 text-xs text-black/45">{error}</p>
                </div>
              ) : profile ? (
                <>
                  {/* Profile header */}
                  <div className="px-3 pt-1">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="truncate text-[15px] font-bold tracking-tight">
                        {profile.username}
                      </p>
                      <MoreHorizontal className="h-5 w-5 text-black/70" />
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="relative h-[76px] w-[76px] shrink-0">
                        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] p-[2.5px]">
                          <div className="h-full w-full overflow-hidden rounded-full border-2 border-white bg-neutral-100">
                            {profile.profilePictureUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={profile.profilePictureUrl}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-black/30">
                                {(profile.username || "?").slice(0, 1).toUpperCase()}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="grid flex-1 grid-cols-3 text-center">
                        <div>
                          <p className="text-[15px] font-bold tabular-nums leading-tight">
                            {fmtCompact(profile.mediaCount)}
                          </p>
                          <p className="text-[11px] text-black/70">posts</p>
                        </div>
                        <div>
                          <p className="text-[15px] font-bold tabular-nums leading-tight">
                            {fmtCompact(profile.followersCount)}
                          </p>
                          <p className="text-[11px] text-black/70">followers</p>
                        </div>
                        <div>
                          <p className="text-[15px] font-bold tabular-nums leading-tight">
                            {fmtCompact(profile.followsCount)}
                          </p>
                          <p className="text-[11px] text-black/70">following</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3">
                      {profile.name ? (
                        <p className="text-[13px] font-semibold leading-tight">{profile.name}</p>
                      ) : null}
                      {profile.biography ? (
                        <p className="mt-0.5 whitespace-pre-line text-[13px] leading-snug text-black/90">
                          {profile.biography}
                        </p>
                      ) : null}
                      {profile.website ? (
                        <a
                          href={profile.website}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-0.5 block truncate text-[13px] font-semibold text-[#00376b] hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {profile.website.replace(/^https?:\/\//, "")}
                        </a>
                      ) : null}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        className="rounded-lg bg-[#efefef] py-1.5 text-[12px] font-semibold transition hover:bg-[#e4e4e4] active:scale-[0.98] motion-reduce:active:scale-100"
                      >
                        Following
                      </button>
                      <button
                        type="button"
                        className="rounded-lg bg-[#efefef] py-1.5 text-[12px] font-semibold transition hover:bg-[#e4e4e4] active:scale-[0.98] motion-reduce:active:scale-100"
                      >
                        Message
                      </button>
                    </div>
                  </div>

                  {/* Highlights omitted — not in ClarioSuite API */}
                  <div className="mt-3 border-t border-black/10">
                    <div className="flex items-center justify-center gap-1 border-b-2 border-black py-2">
                      <Grid3X3 className="h-4 w-4" />
                    </div>
                    <div className="grid grid-cols-3 gap-[1px] bg-white">
                      {(data?.posts ?? []).map((post) => (
                        <button
                          key={post.media_id}
                          type="button"
                          onClick={() => setSelectedId(post.media_id)}
                          className="group relative aspect-square overflow-hidden bg-neutral-100 transition hover:brightness-95 active:brightness-90 motion-reduce:transition-none"
                        >
                          {post.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={post.image_url}
                              alt=""
                              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-black/20">
                              {post.group === "reels" ? (
                                <Clapperboard className="h-5 w-5" />
                              ) : post.group === "carousels" ? (
                                <Layers className="h-5 w-5" />
                              ) : (
                                <Grid3X3 className="h-5 w-5" />
                              )}
                            </div>
                          )}
                          <span className="absolute right-1 top-1 text-white">
                            <IgGridIcon group={post.group} />
                          </span>
                        </button>
                      ))}
                      {!data?.posts.length ? (
                        <p className="col-span-3 py-10 text-center text-xs text-black/40">
                          No recent posts
                        </p>
                      ) : null}
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            {/* Home indicator */}
            <div className="pointer-events-none absolute bottom-1.5 left-1/2 z-30 h-1 w-28 -translate-x-1/2 rounded-full bg-black/25" />
          </div>
        </div>
      </div>

      {profile ? (
        <p className="mt-3 max-w-sm text-center text-[11px] text-white/35">
          Live from ClarioSuite · @{profile.username}
          {data?.highlightsNote ? ` · ${data.highlightsNote}` : null}
        </p>
      ) : null}

      <InstagramPostDetailModal
        open={Boolean(selectedId)}
        onClose={() => setSelectedId(null)}
        detailUrl={selectedId ? detailUrlFor(selectedId) : null}
        seed={selectedPost}
      />
    </div>
  );
}
