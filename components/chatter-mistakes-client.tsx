"use client";

import * as React from "react";
import { ImageIcon, UserRound, Users } from "lucide-react";
import { formatDateTimeEuropean, formatRelativeTime } from "@/lib/format";
import { usePagination } from "@/lib/use-pagination";
import { PaginationControls } from "@/components/ui/pagination-controls";
import type { MistakeReasonCategory, MistakeRecord } from "@/services/chatter-mistakes";

type Props = {
  initialMistakes: MistakeRecord[];
};

type DatePreset = "all" | "month" | "last_month";

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getChatterDateRange(preset: DatePreset): { from?: string; to?: string } {
  const now = new Date();
  if (preset === "all") return {};
  if (preset === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: toDateStr(start), to: toDateStr(now) };
  }
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0);
  return { from: toDateStr(start), to: toDateStr(end) };
}

function categoryBadgeClass(cat: MistakeReasonCategory): string {
  if (cat === "High") return "border-red-500/25 bg-red-500/10 text-red-400";
  if (cat === "Medium") return "border-yellow-500/25 bg-yellow-500/10 text-yellow-400";
  return "border-blue-500/25 bg-blue-500/10 text-blue-400";
}

function ScreenshotThumb({ url }: { url?: string }) {
  if (!url) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5">
        <ImageIcon className="h-4 w-4 text-white/25" aria-hidden />
      </div>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="block shrink-0 overflow-hidden rounded-lg ring-1 ring-white/10 transition hover:ring-pink-500/40"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="Screenshot" className="h-10 w-10 object-cover" />
    </a>
  );
}

function RelativeDate({ iso }: { iso: string }) {
  const full = formatDateTimeEuropean(iso);
  return (
    <span className="text-xs text-white/40" title={full !== "—" ? full : undefined}>
      {formatRelativeTime(iso)}
    </span>
  );
}

export function ChatterMistakesClient({ initialMistakes }: Props) {
  const [mistakes] = React.useState(initialMistakes);
  const [datePreset, setDatePreset] = React.useState<DatePreset>("all");
  const [category, setCategory] = React.useState<"all" | MistakeReasonCategory>("all");

  const dateRange = React.useMemo(() => getChatterDateRange(datePreset), [datePreset]);

  const filtered = React.useMemo(() => {
    return mistakes.filter((m) => {
      if (category !== "all" && m.reason_category !== category) return false;
      const d = (m.mistake_date || m.created_at || "").slice(0, 10);
      if (dateRange.from && (!d || d < dateRange.from)) return false;
      if (dateRange.to && (!d || d > dateRange.to)) return false;
      return true;
    });
  }, [mistakes, category, dateRange]);

  const { page, setPage, totalPages, paginated, reset: resetPage } = usePagination(filtered, 20);

  React.useEffect(() => {
    resetPage();
  }, [category, datePreset, resetPage]);

  const stats = React.useMemo(() => {
    const rows = filtered;
    let low = 0;
    let med = 0;
    let high = 0;
    let pts = 0;
    for (const m of rows) {
      pts += m.points_deducted ?? 0;
      if (m.reason_category === "High") high += 1;
      else if (m.reason_category === "Medium") med += 1;
      else low += 1;
    }
    return { total: rows.length, low, med, high, pts };
  }, [filtered]);

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-red-400/60">My performance</p>
        <h1 className="text-3xl font-bold tracking-tight text-white">My mistakes</h1>
        <p className="mt-1 text-sm text-white/40">Approved mistake records and point deductions.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { label: "Total", value: stats.total, border: "border-white/20", text: "text-white" },
          { label: "Low", value: stats.low, border: "border-blue-500/30", text: "text-blue-400" },
          { label: "Medium", value: stats.med, border: "border-yellow-500/30", text: "text-yellow-400" },
          { label: "High", value: stats.high, border: "border-red-500/30", text: "text-red-400" },
          { label: "Points lost", value: stats.pts, border: "border-red-500/40", text: "text-red-400" },
        ].map((stat) => (
          <div
            key={stat.label}
            className={`rounded-2xl border ${stat.border} bg-white/[0.03] p-4 backdrop-blur-sm`}
          >
            <p className="mb-2 text-xs uppercase tracking-widest text-white/30">{stat.label}</p>
            <p className={`text-2xl font-bold tabular-nums sm:text-3xl ${stat.text}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {(
            [
              { key: "all", label: "All" },
              { key: "month", label: "This month" },
              { key: "last_month", label: "Last month" },
            ] as const
          ).map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setDatePreset(p.key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                datePreset === p.key
                  ? "border-pink-500/30 bg-pink-500/20 text-pink-300"
                  : "border-white/10 text-white/50 hover:border-white/20 hover:text-white"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as typeof category)}
          className="min-h-10 rounded-xl border border-white/10 bg-black/40 px-3 text-sm text-white"
          aria-label="Filter by severity"
        >
          <option value="all">All severity</option>
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
        </select>
      </section>

      <p className="text-sm text-white/50">
        Showing {filtered.length} mistake{filtered.length === 1 ? "" : "s"}
      </p>

      {filtered.length === 0 ? (
        <p className="glass-card border-dashed py-12 text-center text-sm text-white/45">No mistakes match your filters.</p>
      ) : (
        <>
          <ul className="space-y-3 md:hidden">
            {paginated.map((m) => (
              <li key={m.id} className="glass-card space-y-3 p-4 transition hover:bg-white/[0.07]">
                <div className="flex items-start gap-3">
                  <ScreenshotThumb url={m.screenshot?.[0]?.url} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${categoryBadgeClass(m.reason_category)}`}>
                        {m.reason_category}
                      </span>
                      <RelativeDate iso={m.mistake_date || m.created_at} />
                    </div>
                    <p className="mt-2 truncate font-semibold text-white" title={m.reason_label}>
                      {m.reason_label}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/40">
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" aria-hidden />
                        {m.model_name}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <UserRound className="h-3.5 w-3.5" aria-hidden />@{m.sub_username}
                      </span>
                    </div>
                    <p className="mt-2 text-right text-lg font-bold text-red-400">-{m.points_deducted ?? 0} pts</p>
                  </div>
                </div>
                {m.admin_notes ? (
                  <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                    <p className="mb-1 text-xs uppercase tracking-widest text-white/30">Admin note</p>
                    <p className="text-sm italic text-white/60">&ldquo;{m.admin_notes}&rdquo;</p>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>

          <div className="glass-card hidden overflow-x-auto md:block">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-white/10 bg-zinc-950/95 backdrop-blur-md">
                <tr className="text-xs uppercase tracking-wider text-white/45">
                  <th className="w-14 px-4 py-3.5 font-semibold">Shot</th>
                  <th className="px-4 py-3.5 font-semibold">Model</th>
                  <th className="px-4 py-3.5 font-semibold">Reason</th>
                  <th className="px-4 py-3.5 font-semibold">Severity</th>
                  <th className="px-4 py-3.5 text-right font-semibold">Points</th>
                  <th className="px-4 py-3.5 font-semibold">Date</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((m, idx) => (
                  <tr
                    key={m.id}
                    className={`border-b border-white/[0.06] transition-colors last:border-0 hover:bg-white/[0.04] ${
                      idx % 2 === 1 ? "bg-white/[0.02]" : ""
                    }`}
                  >
                    <td className="px-4 py-3 align-middle">
                      <ScreenshotThumb url={m.screenshot?.[0]?.url} />
                    </td>
                    <td className="px-4 py-3 align-middle text-white/80">{m.model_name}</td>
                    <td className="max-w-[220px] px-4 py-3 align-middle">
                      <span className="block truncate text-white/80" title={m.reason_label}>
                        {m.reason_label}
                      </span>
                      <span className="text-xs text-white/35">@{m.sub_username}</span>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${categoryBadgeClass(m.reason_category)}`}>
                        {m.reason_category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right align-middle font-semibold tabular-nums text-red-400">
                      -{m.points_deducted ?? 0}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 align-middle">
                      <RelativeDate iso={m.mistake_date || m.created_at} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <PaginationControls
            page={page}
            totalPages={totalPages}
            onPage={setPage}
            totalItems={filtered.length}
          />
        </>
      )}
    </div>
  );
}
