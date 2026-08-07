"use client";

import * as React from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { InflowwCustomDateRange } from "@/components/infloww-performance-ui";
import { ScriptStatusBadge, displayOrDash } from "@/components/manager-review-ui";
import { formatDateTimeAthens } from "@/lib/format";
import { SCRIPT_STATUSES, type ScriptStatus } from "@/lib/creative-scripts-helpers";
import { getTodayYmdAthens, addDaysAthensYmd } from "@/lib/airtable-datetime";
import { VA_CARD, VA_FILTER_INPUT } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";
import type { WinnerVideoRecord } from "@/services/winner-videos";
import type { SlotScriptMeta } from "@/services/winner-sourcing";
import type { WinnerVideoDateRange } from "@/lib/winner-videos-filters";

const PAGE_SIZE = 12;

function scriptAtMs(video: WinnerVideoRecord): number {
  const raw = video.script_submitted_at || video.script_reviewed_at || video.submitted_at;
  if (!raw?.trim()) return 0;
  const ms = new Date(raw).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

function startOfDayMs(ymd: string): number {
  return new Date(`${ymd}T00:00:00.000Z`).getTime();
}

function endOfDayMs(ymd: string): number {
  return new Date(`${ymd}T23:59:59.999Z`).getTime();
}

type BunchGroup = {
  key: string;
  title: string;
  videos: WinnerVideoRecord[];
};

export function CreativeScriptsHistory({
  scripts,
  slotMeta = [],
}: {
  scripts: WinnerVideoRecord[];
  slotMeta?: SlotScriptMeta[];
}) {
  const today = getTodayYmdAthens();
  const [bunchId, setBunchId] = React.useState("");
  const [status, setStatus] = React.useState<ScriptStatus | "">("");
  const [dateRange, setDateRange] = React.useState<WinnerVideoDateRange>("all");
  const [dateFrom, setDateFrom] = React.useState(() => addDaysAthensYmd(today, -30));
  const [dateTo, setDateTo] = React.useState(today);
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});

  const metaByVideoId = React.useMemo(() => {
    const map = new Map<string, SlotScriptMeta>();
    for (const m of slotMeta) map.set(m.winner_video_id, m);
    return map;
  }, [slotMeta]);

  const bunchOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const v of scripts) {
      const id = v.bunch_id?.trim();
      if (!id) continue;
      const name =
        v.bunch_name?.trim() ||
        metaByVideoId.get(v.id)?.bunch_name?.trim() ||
        "Unnamed bunch";
      if (!map.has(id)) map.set(id, name);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [scripts, metaByVideoId]);

  const filtered = React.useMemo(() => {
    let list = scripts.filter(
      (v) =>
        Boolean(v.script_submitted_at?.trim()) ||
        Boolean(v.script_text?.trim()) ||
        v.script_status === "Pending Review" ||
        v.script_status === "Approved" ||
        v.script_status === "Rejected",
    );

    if (bunchId) list = list.filter((v) => v.bunch_id === bunchId);
    if (status) list = list.filter((v) => v.script_status === status);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((v) => {
        const meta = metaByVideoId.get(v.id);
        const hay = [
          meta?.description,
          v.note,
          v.script_text,
          v.text_on_screen_suggestion,
          v.assigned_creator_name,
          v.bunch_name,
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    if (dateRange === "7d") {
      const cutoff = startOfDayMs(addDaysAthensYmd(today, -7));
      list = list.filter((v) => scriptAtMs(v) >= cutoff);
    } else if (dateRange === "30d") {
      const cutoff = startOfDayMs(addDaysAthensYmd(today, -30));
      list = list.filter((v) => scriptAtMs(v) >= cutoff);
    } else if (dateRange === "custom") {
      if (dateFrom) list = list.filter((v) => scriptAtMs(v) >= startOfDayMs(dateFrom));
      if (dateTo) list = list.filter((v) => scriptAtMs(v) <= endOfDayMs(dateTo));
    }
    return [...list].sort((a, b) => scriptAtMs(b) - scriptAtMs(a));
  }, [scripts, bunchId, status, search, dateRange, dateFrom, dateTo, today, metaByVideoId]);

  React.useEffect(() => {
    setPage(1);
  }, [bunchId, status, search, dateRange, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const groups = React.useMemo<BunchGroup[]>(() => {
    const byBunch = new Map<string, WinnerVideoRecord[]>();
    const other: WinnerVideoRecord[] = [];
    for (const v of pageItems) {
      const id = v.bunch_id?.trim();
      if (!id) {
        other.push(v);
        continue;
      }
      const list = byBunch.get(id) ?? [];
      list.push(v);
      byBunch.set(id, list);
    }
    const out: BunchGroup[] = [...byBunch.entries()].map(([id, videos]) => ({
      key: id,
      title:
        videos[0]?.bunch_name?.trim() ||
        metaByVideoId.get(videos[0]?.id ?? "")?.bunch_name ||
        bunchOptions.find(([bid]) => bid === id)?.[1] ||
        "Bunch",
      videos,
    }));
    out.sort((a, b) => a.title.localeCompare(b.title));
    if (other.length > 0) out.push({ key: "__other__", title: "Other scripts", videos: other });
    return out;
  }, [pageItems, metaByVideoId, bunchOptions]);

  function toggleBunch(key: string) {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const statusFilterOptions = SCRIPT_STATUSES.filter(
    (s) => s !== "Not Applicable" && s !== "Needs Script",
  );

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#D4AF8C]/70">
          History
        </p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-white">Past scripts</h2>
        <p className="mt-0.5 text-xs text-[#B8B4B8]/45">
          Grouped by bunch — includes text-on-screen suggestions and rejection reasons.
        </p>
      </div>

      <div className={cn(VA_CARD, "space-y-3 border border-white/10 bg-white/[0.03] p-4")}>
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
          <label className="relative block min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/35" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search description or script…"
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
            className={cn(VA_FILTER_INPUT, "w-full lg:w-40")}
            value={status}
            onChange={(e) => setStatus(e.target.value as ScriptStatus | "")}
          >
            <option value="">All statuses</option>
            {statusFilterOptions.map((s) => (
              <option key={s} value={s}>
                {s}
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
            {scripts.length === 0
              ? "No scripts yet — submissions appear here after you write them."
              : "No matches for the current filters."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => {
            const isCollapsed = Boolean(collapsed[group.key]);
            return (
              <section
                key={group.key}
                className={cn(VA_CARD, "overflow-hidden border border-white/[0.08] bg-white/[0.03]")}
              >
                <button
                  type="button"
                  onClick={() => toggleBunch(group.key)}
                  className="flex w-full items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3 text-left hover:bg-white/[0.03]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">
                      {group.key === "__other__" ? group.title : `Bunch: ${group.title}`}
                    </p>
                    <p className="text-[11px] tabular-nums text-[#B8B4B8]/45">
                      {group.videos.length} script{group.videos.length === 1 ? "" : "s"}
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
                    {group.videos.map((v) => {
                      const meta = metaByVideoId.get(v.id);
                      const description =
                        meta?.description?.trim() || v.note?.trim() || "";
                      return (
                        <li key={v.id} className="space-y-2 px-4 py-3.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <ScriptStatusBadge status={v.script_status} />
                            {meta ? (
                              <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] tabular-nums text-[#D4AF8C]/80">
                                Slot #{meta.sequence_number}
                                {meta.recreate_total > 1
                                  ? ` · ${meta.recreate_index}/${meta.recreate_total}`
                                  : ""}
                              </span>
                            ) : null}
                            <span className="text-[11px] text-[#B8B4B8]/45">
                              {v.script_submitted_at
                                ? formatDateTimeAthens(v.script_submitted_at)
                                : "—"}
                            </span>
                            {v.script_reviewed_at ? (
                              <span className="text-[11px] text-[#B8B4B8]/35">
                                Reviewed {formatDateTimeAthens(v.script_reviewed_at)}
                              </span>
                            ) : null}
                          </div>
                          <p className="text-sm font-medium text-white">
                            {displayOrDash(v.assigned_creator_name)}
                          </p>
                          {description ? (
                            <p className="text-sm leading-relaxed text-[#B8B4B8]/75">{description}</p>
                          ) : null}
                          {v.text_on_screen_suggestion?.trim() ? (
                            <div className="rounded-xl border border-[#D4AF8C]/15 bg-[#D4AF8C]/[0.04] px-3 py-2">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#D4AF8C]/70">
                                Text on Screen Suggestion
                              </p>
                              <p className="mt-1 whitespace-pre-wrap text-xs text-[#B8B4B8]/70">
                                {v.text_on_screen_suggestion}
                              </p>
                            </div>
                          ) : null}
                          {v.script_rejection_reason?.trim() ? (
                            <p className="rounded-lg border border-red-500/20 bg-red-500/8 px-3 py-2 text-xs text-red-200">
                              {v.script_rejection_reason}
                            </p>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </section>
            );
          })}

          <div className="flex flex-col gap-3 border-t border-white/10 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-white/35">
              Showing {filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–
              {Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
            </p>
            {filtered.length > 0 ? (
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
