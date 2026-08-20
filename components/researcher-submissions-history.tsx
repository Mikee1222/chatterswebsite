"use client";

import * as React from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ExternalLink, Pencil, Search, Trash2 } from "lucide-react";
import { InflowwCustomDateRange } from "@/components/infloww-performance-ui";
import { WinnerVideoStatusBadge } from "@/components/manager-review-ui";
import {
  QualityRatingAggregate,
  QualityRatingBadge,
  ResearchDisplayVideoTypeBadge,
} from "@/components/winner-videos-shared";
import { formatDateTimeAthens } from "@/lib/format";
import {
  RESEARCH_DISPLAY_VIDEO_TYPE_OPTIONS,
  groupWinnerVideosByBunch,
  researchDisplayVideoType,
  type ResearchDisplayVideoType,
  type WinnerVideoDateRange,
} from "@/lib/winner-videos-filters";
import {
  WINNER_VIDEO_QUALITY_RATINGS,
  WINNER_VIDEO_STATUSES,
  type WinnerVideoQualityRating,
  type WinnerVideoStatus,
} from "@/lib/winner-videos-helpers";
import { getTodayYmdAthens, addDaysAthensYmd } from "@/lib/airtable-datetime";
import { VA_CARD, VA_FILTER_INPUT } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";
import type { WinnerVideoRecord } from "@/services/winner-videos";

const BUNCHES_PER_PAGE = 8;

function submittedAtMs(video: WinnerVideoRecord): number {
  if (!video.submitted_at?.trim()) return 0;
  const ms = new Date(video.submitted_at).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

function startOfDayMs(ymd: string): number {
  return new Date(`${ymd}T00:00:00.000Z`).getTime();
}

function endOfDayMs(ymd: string): number {
  return new Date(`${ymd}T23:59:59.999Z`).getTime();
}

export function ResearcherSubmissionsHistory({
  submissions,
  onChanged,
}: {
  submissions: WinnerVideoRecord[];
  onChanged?: () => void;
}) {
  const today = getTodayYmdAthens();
  const [bunchId, setBunchId] = React.useState("");
  const [status, setStatus] = React.useState<WinnerVideoStatus | "">("");
  const [videoType, setVideoType] = React.useState<ResearchDisplayVideoType | "">("");
  const [rating, setRating] = React.useState<WinnerVideoQualityRating | "">("");
  const [dateRange, setDateRange] = React.useState<WinnerVideoDateRange>("all");
  const [dateFrom, setDateFrom] = React.useState(() => addDaysAthensYmd(today, -30));
  const [dateTo, setDateTo] = React.useState(today);
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});

  const bunchOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const v of submissions) {
      const id = v.bunch_id?.trim();
      if (!id) continue;
      if (!map.has(id)) map.set(id, v.bunch_name?.trim() || "Unnamed bunch");
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [submissions]);

  const filtered = React.useMemo(() => {
    let list = submissions;
    if (bunchId) list = list.filter((v) => v.bunch_id === bunchId);
    if (status) list = list.filter((v) => v.status === status);
    if (videoType) list = list.filter((v) => researchDisplayVideoType(v) === videoType);
    if (rating) list = list.filter((v) => v.quality_rating === rating);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((v) => (v.note ?? "").toLowerCase().includes(q));
    }
    if (dateRange === "7d") {
      const cutoff = startOfDayMs(addDaysAthensYmd(today, -7));
      list = list.filter((v) => submittedAtMs(v) >= cutoff);
    } else if (dateRange === "30d") {
      const cutoff = startOfDayMs(addDaysAthensYmd(today, -30));
      list = list.filter((v) => submittedAtMs(v) >= cutoff);
    } else if (dateRange === "custom") {
      if (dateFrom) list = list.filter((v) => submittedAtMs(v) >= startOfDayMs(dateFrom));
      if (dateTo) list = list.filter((v) => submittedAtMs(v) <= endOfDayMs(dateTo));
    }
    return [...list].sort((a, b) => submittedAtMs(b) - submittedAtMs(a));
  }, [submissions, bunchId, status, videoType, rating, search, dateRange, dateFrom, dateTo, today]);

  React.useEffect(() => {
    setPage(1);
  }, [bunchId, status, videoType, rating, search, dateRange, dateFrom, dateTo]);

  const allGroups = React.useMemo(() => groupWinnerVideosByBunch(filtered), [filtered]);
  const totalPages = Math.max(1, Math.ceil(allGroups.length / BUNCHES_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const groups = allGroups.slice((safePage - 1) * BUNCHES_PER_PAGE, safePage * BUNCHES_PER_PAGE);

  function toggleBunch(key: string) {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#D4AF8C]/70">
            History
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-white">Your submissions</h2>
          <p className="mt-0.5 text-xs text-[#B8B4B8]/45">
            Grouped by bunch — ratings from Research Manage appear on approved finds.
          </p>
        </div>
        <QualityRatingAggregate ratings={filtered.map((v) => v.quality_rating)} />
      </div>

      <div className={cn(VA_CARD, "space-y-3 border border-white/10 bg-white/[0.03] p-4")}>
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
          <label className="relative block min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/35" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search description…"
              className={cn(VA_FILTER_INPUT, "w-full py-2 pl-9")}
            />
          </label>
          <select
            className={cn(VA_FILTER_INPUT, "w-full lg:w-44")}
            value={bunchId}
            onChange={(e) => setBunchId(e.target.value)}
          >
            <option value="">All bunches</option>
            {bunchOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <select
            className={cn(VA_FILTER_INPUT, "w-full lg:w-36")}
            value={status}
            onChange={(e) => setStatus(e.target.value as WinnerVideoStatus | "")}
          >
            <option value="">All statuses</option>
            {WINNER_VIDEO_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            className={cn(VA_FILTER_INPUT, "w-full lg:w-40")}
            value={videoType}
            onChange={(e) => setVideoType(e.target.value as ResearchDisplayVideoType | "")}
          >
            {RESEARCH_DISPLAY_VIDEO_TYPE_OPTIONS.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            className={cn(VA_FILTER_INPUT, "w-full lg:w-36")}
            value={rating}
            onChange={(e) => setRating(e.target.value as WinnerVideoQualityRating | "")}
          >
            <option value="">All ratings</option>
            {WINNER_VIDEO_QUALITY_RATINGS.map((r) => (
              <option key={r} value={r}>
                {r === "good" ? "👍 Good" : r === "excellent" ? "🌟 Excellent" : "🔥 Fire"}
              </option>
            ))}
          </select>
          <select
            className={cn(VA_FILTER_INPUT, "w-full lg:w-36")}
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as WinnerVideoDateRange)}
          >
            <option value="all">All dates</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="custom">Custom range</option>
          </select>
        </div>

        {dateRange === "custom" ? (
          <InflowwCustomDateRange
            startYmd={dateFrom}
            endYmd={dateTo}
            onChange={(s, e) => {
              setDateFrom(s);
              setDateTo(e);
            }}
            onApply={(s, e) => {
              setDateFrom(s);
              setDateTo(e);
            }}
          />
        ) : null}

        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", "All dates"],
              ["7d", "7d"],
              ["30d", "30d"],
              ["custom", "Custom"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setDateRange(value)}
              className={cn(
                "rounded-full border px-3 py-1 text-[11px] font-medium transition",
                dateRange === value
                  ? "border-[#FF1493]/40 bg-[#FF1493]/15 text-[#FF1493]"
                  : "border-white/10 bg-white/5 text-white/50 hover:border-white/20 hover:text-white/80",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className={cn(VA_CARD, "border border-white/10 bg-white/[0.03] px-5 py-14 text-center")}>
          <p className="text-sm text-[#B8B4B8]/50">
            {submissions.length === 0
              ? "No submissions yet — finds you submit appear here."
              : "No matches for the current filters."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => {
            const key = group.bunchId ?? "__ungrouped__";
            const isCollapsed = Boolean(collapsed[key]);
            return (
              <section
                key={key}
                className={cn(VA_CARD, "overflow-hidden border border-white/[0.08] bg-white/[0.03]")}
              >
                <button
                  type="button"
                  onClick={() => toggleBunch(key)}
                  className="flex w-full items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3 text-left hover:bg-white/[0.03]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{group.bunchName}</p>
                    <p className="text-[11px] tabular-nums text-[#B8B4B8]/45">
                      {group.videos.length} submission{group.videos.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-[#D4AF8C]/70 transition-transform",
                      isCollapsed && "-rotate-90",
                    )}
                    aria-hidden
                  />
                </button>
                {!isCollapsed ? (
                  <ul className="divide-y divide-white/[0.05]">
                    {group.videos.map((v) => (
                      <li key={v.id} className="space-y-2 px-4 py-3.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <WinnerVideoStatusBadge status={v.status} />
                          <QualityRatingBadge rating={v.quality_rating} />
                          <ResearchDisplayVideoTypeBadge video={v} />
                          <span className="text-[11px] text-[#B8B4B8]/45">
                            {v.submitted_at ? formatDateTimeAthens(v.submitted_at) : "—"}
                          </span>
                          {v.status === "Pending" ? (
                            <span className="ml-auto flex gap-1.5">
                              <button type="button" className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/70" onClick={async () => {
                                const note = window.prompt("Description (optional)", v.note ?? ""); if (note === null) return;
                                const link = window.prompt("Video link", v.video_link ?? ""); if (link === null) return;
                                const res = await fetch(`/api/winner-videos/${encodeURIComponent(v.id)}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note, video_link: link }) });
                                if (res.status === 409 && window.confirm("Duplicate for this model. Save anyway?")) {
                                  await fetch(`/api/winner-videos/${encodeURIComponent(v.id)}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note, video_link: link, force_duplicate: true }) });
                                }
                                onChanged?.();
                              }}><Pencil className="h-3 w-3" /> Edit</button>
                              <button type="button" className="inline-flex items-center gap-1 rounded-lg border border-red-500/25 bg-red-500/10 px-2 py-1 text-[11px] text-red-200" onClick={async () => {
                                if (!window.confirm("Delete this pending submission?")) return;
                                await fetch(`/api/winner-videos/${encodeURIComponent(v.id)}`, { method: "DELETE", credentials: "include" });
                                onChanged?.();
                              }}><Trash2 className="h-3 w-3" /> Delete</button>
                            </span>
                          ) : null}
                        </div>
                        <p className="text-sm leading-relaxed text-[#B8B4B8]/80">
                          {v.note?.trim() || "—"}
                        </p>
                        {v.rejection_reason?.trim() ? (
                          <p className="rounded-lg border border-red-500/20 bg-red-500/8 px-3 py-2 text-xs text-red-200">
                            {v.rejection_reason}
                          </p>
                        ) : null}
                        {v.video_link ? (
                          <a
                            href={v.video_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium text-[#FF1493] hover:underline"
                          >
                            Video <ExternalLink className="h-3 w-3" aria-hidden />
                          </a>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            );
          })}

          <div className="flex flex-col gap-3 border-t border-white/10 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-white/35">
              Showing {allGroups.length === 0 ? 0 : (safePage - 1) * BUNCHES_PER_PAGE + 1}–
              {Math.min(safePage * BUNCHES_PER_PAGE, allGroups.length)} of {allGroups.length} bunches
            </p>
            {allGroups.length > 0 ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 text-xs text-white/60 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Prev
                </button>
                <span className="min-w-[6.5rem] text-center text-xs tabular-nums text-white/50">
                  Page {safePage} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 text-xs text-white/60 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
