"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Copy, RefreshCw, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InflowwModel } from "@/types/infloww";

const PAGE_SIZE = 25;

type SortKey = "name" | "id";
type SortDir = "asc" | "desc";

export function AdminInflowwCreatorsLookup() {
  const [creators, setCreators] = React.useState<InflowwModel[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [sortKey, setSortKey] = React.useState<SortKey>("name");
  const [sortDir, setSortDir] = React.useState<SortDir>("asc");
  const [page, setPage] = React.useState(1);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/infloww-creators");
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        creators?: InflowwModel[];
      };
      if (!res.ok) {
        throw new Error(body.error || `Failed to load creators (${res.status})`);
      }
      setCreators(Array.isArray(body.creators) ? body.creators : []);
    } catch (e) {
      setCreators([]);
      setError(e instanceof Error ? e.message : "Failed to load creators");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    setPage(1);
  }, [query, sortKey, sortDir]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = creators;
    if (q) {
      rows = rows.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q) ||
          (c.platformPid ?? "").toLowerCase().includes(q)
      );
    }
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = sortKey === "name" ? a.name.toLowerCase() : a.id;
      const bv = sortKey === "name" ? b.name.toLowerCase() : b.id;
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });
  }, [creators, query, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  async function copyId(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1500);
    } catch {
      setError("Could not copy to clipboard");
    }
  }

  const sortIndicator = (key: SortKey) =>
    sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
      <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#D4AF8C]/80">
            Creator ID lookup
          </p>
          <p className="mt-1 text-sm text-white/55">
            Live Infloww creators — copy the ID into Accounts → Models → Infloww creator ID.
          </p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 self-start rounded-xl border border-[#D4AF8C]/40 bg-[#D4AF8C]/10 px-3 py-1.5 text-xs font-semibold text-[#D4AF8C] transition hover:bg-[#D4AF8C]/15 disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-3 sm:flex-row sm:items-center">
        <label className="relative block min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/35" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, creator ID, or platformPid…"
            className="w-full rounded-xl border border-white/10 bg-black/30 py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-[#FF1493]/50 focus:ring-1 focus:ring-[#FF1493]/20"
          />
        </label>
      </div>

      {error ? (
        <p className="mx-4 my-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
          {error.toLowerCase().includes("not configured") || error.toLowerCase().includes("api key") ? (
            <span className="mt-1 block text-red-200/70">
              Set INFLOWW_API_KEY and INFLOWW_AGENCY_OID in Vercel env.
            </span>
          ) : null}
        </p>
      ) : null}

      {loading && creators.length === 0 && !error ? (
        <p className="px-4 py-10 text-center text-sm text-white/40">Loading creators from Infloww…</p>
      ) : null}

      {!loading && !error && filtered.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-white/40">
          {creators.length === 0
            ? "No creators returned from Infloww."
            : "No matches for the current search."}
        </p>
      ) : null}

      {pageRows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">
                <th className="px-4 py-2.5">
                  <button
                    type="button"
                    onClick={() => toggleSort("id")}
                    className="inline-flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45 transition hover:text-[#D4AF8C]"
                  >
                    Creator ID{sortIndicator("id")}
                  </button>
                </th>
                <th className="px-4 py-2.5">
                  <button
                    type="button"
                    onClick={() => toggleSort("name")}
                    className="inline-flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45 transition hover:text-[#D4AF8C]"
                  >
                    Name{sortIndicator("name")}
                  </button>
                </th>
                <th className="px-4 py-2.5">platformPid</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-white/[0.06] last:border-0 transition hover:bg-white/[0.03]"
                >
                  <td className="px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => void copyId(c.id)}
                      className="inline-flex items-center gap-1.5 font-mono tabular-nums text-[#D4AF8C] transition hover:text-[#FF1493]"
                      title="Copy creator ID"
                    >
                      {c.id}
                      <Copy className="h-3 w-3 opacity-60" />
                      {copiedId === c.id ? (
                        <span className="text-[10px] font-sans text-emerald-300">Copied</span>
                      ) : null}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-white">{c.name}</td>
                  <td className="px-4 py-2.5 font-mono text-xs tabular-nums text-white/55">
                    {c.platformPid || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {!error && creators.length > 0 ? (
        <div className="flex flex-col gap-3 border-t border-white/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-white/35">
            Showing {filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–
            {Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
            {query.trim() ? <span className="text-white/25"> ({creators.length} total)</span> : null}
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
      ) : null}
    </div>
  );
}
