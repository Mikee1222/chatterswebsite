"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Copy, ExternalLink, RefreshCw, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClarioSuiteIgProfile } from "@/types/clariosuite";

const PAGE_SIZE = 25;

type SortKey = "username" | "igUserId" | "followers";
type SortDir = "asc" | "desc";
type EmptyReason = "missing_api_key" | "no_ig_accounts" | "api_error" | null;

export function AdminClarioSuiteAccountsLookup({
  linkMode = false,
  onLinkPrimary,
  onLinkSecondary,
}: {
  linkMode?: boolean;
  onLinkPrimary?: (account: ClarioSuiteIgProfile) => void;
  onLinkSecondary?: (account: ClarioSuiteIgProfile) => void;
} = {}) {
  const [accounts, setAccounts] = React.useState<ClarioSuiteIgProfile[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [emptyReason, setEmptyReason] = React.useState<EmptyReason>(null);
  const [hint, setHint] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [sortKey, setSortKey] = React.useState<SortKey>("username");
  const [sortDir, setSortDir] = React.useState<SortDir>("asc");
  const [page, setPage] = React.useState(1);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    setEmptyReason(null);
    setHint(null);
    try {
      const res = await fetch("/api/admin/clariosuite-accounts");
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string | null;
        emptyReason?: EmptyReason;
        accounts?: ClarioSuiteIgProfile[];
      };
      if (!res.ok) {
        const reason =
          body.emptyReason ??
          (res.status === 503 ||
          (body.error || "").toLowerCase().includes("not configured") ||
          (body.error || "").toLowerCase().includes("api key")
            ? "missing_api_key"
            : "api_error");
        setEmptyReason(reason);
        setAccounts([]);
        throw new Error(
          body.message ||
            body.error ||
            (reason === "missing_api_key"
              ? "API key not configured"
              : `Failed to load accounts (${res.status})`)
        );
      }
      const rows = Array.isArray(body.accounts) ? body.accounts : [];
      setAccounts(rows);
      setEmptyReason(rows.length === 0 ? body.emptyReason ?? "no_ig_accounts" : null);
      setHint(typeof body.message === "string" ? body.message : null);
    } catch (e) {
      setAccounts([]);
      setError(e instanceof Error ? e.message : "Failed to load accounts");
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
    let rows = accounts;
    if (q) {
      rows = rows.filter(
        (a) =>
          a.username.toLowerCase().includes(q) ||
          a.igUserId.toLowerCase().includes(q) ||
          (a.name ?? "").toLowerCase().includes(q)
      );
    }
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (sortKey === "followers") {
        const av = a.followersCount ?? -1;
        const bv = b.followersCount ?? -1;
        return (av - bv) * dir;
      }
      const av = sortKey === "username" ? a.username.toLowerCase() : a.igUserId;
      const bv = sortKey === "username" ? b.username.toLowerCase() : b.igUserId;
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return a.username.toLowerCase().localeCompare(b.username.toLowerCase());
    });
  }, [accounts, query, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const hasSearch = query.trim().length > 0;

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
            IG account lookup
          </p>
          <p className="mt-1 text-sm text-white/55">
            {linkMode
              ? "Pick an account to link as primary or secondary on this model."
              : "Live ClarioSuite accounts — copy the IG user ID or link from Accounts → Edit Model."}
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
            placeholder="Search by username, name, or IG user ID…"
            className="w-full rounded-xl border border-white/10 bg-black/30 py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-[#FF1493]/50 focus:ring-1 focus:ring-[#FF1493]/20"
          />
        </label>
      </div>

      {error ? (
        <div className="mx-4 my-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <p>{error}</p>
          {emptyReason === "missing_api_key" ? (
            <p className="mt-1 text-red-200/70">
              Set <code className="text-red-100">CLARIOSUITE_API_KEY</code> in Vercel Production env
              and redeploy.
            </p>
          ) : null}
        </div>
      ) : null}

      {loading && accounts.length === 0 && !error ? (
        <p className="px-4 py-10 text-center text-sm text-white/40">
          Loading Instagram accounts from ClarioSuite…
        </p>
      ) : null}

      {!loading && !error && accounts.length === 0 ? (
        <div className="mx-4 my-4 space-y-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-5 text-center">
          <p className="text-sm font-medium text-amber-100">
            {emptyReason === "missing_api_key"
              ? "API key not configured"
              : "No IG accounts — connect in ClarioSuite dashboard first"}
          </p>
          <p className="text-xs text-amber-100/70">
            {hint ||
              (emptyReason === "missing_api_key"
                ? "Set CLARIOSUITE_API_KEY in Vercel Production and redeploy."
                : "Your ClarioSuite API key is valid, but this key has access to zero Instagram accounts. Connect accounts in ClarioSuite (Settings / Accounts), then refresh.")}
          </p>
          <a
            href="https://clariosuite.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 pt-1 text-xs font-semibold text-[#D4AF8C] hover:underline"
          >
            Open ClarioSuite <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      ) : null}

      {!loading && !error && accounts.length > 0 && filtered.length === 0 && hasSearch ? (
        <p className="px-4 py-10 text-center text-sm text-white/40">No accounts match your search.</p>
      ) : null}

      {pageRows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-white/10 text-[11px] uppercase tracking-wider text-white/40">
              <tr>
                <th className="px-4 py-3 font-medium">
                  <button type="button" onClick={() => toggleSort("username")}>
                    Username{sortIndicator("username")}
                  </button>
                </th>
                <th className="px-4 py-3 font-medium">
                  <button type="button" onClick={() => toggleSort("igUserId")}>
                    IG user ID{sortIndicator("igUserId")}
                  </button>
                </th>
                <th className="px-4 py-3 font-medium">
                  <button type="button" onClick={() => toggleSort("followers")}>
                    Followers{sortIndicator("followers")}
                  </button>
                </th>
                <th className="px-4 py-3 font-medium">Copy</th>
                {linkMode ? <th className="px-4 py-3 font-medium">Link</th> : null}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((a) => (
                <tr key={a.igUserId} className="border-b border-white/5 hover:bg-white/[0.03]">
                  <td className="px-4 py-3">
                    <p className="font-medium text-white">@{a.username}</p>
                    {a.name ? <p className="text-xs text-white/40">{a.name}</p> : null}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-white/70">{a.igUserId}</td>
                  <td className="px-4 py-3 text-white/70">
                    {a.followersCount != null ? a.followersCount.toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => void copyId(a.igUserId)}
                      className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-xs text-white/70 hover:bg-white/5"
                    >
                      <Copy className="h-3 w-3" />
                      {copiedId === a.igUserId ? "Copied" : "Copy"}
                    </button>
                  </td>
                  {linkMode ? (
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => onLinkPrimary?.(a)}
                          className="rounded-lg border border-[#D4AF8C]/40 bg-[#D4AF8C]/10 px-2 py-1 text-[10px] font-semibold text-[#D4AF8C] hover:bg-[#D4AF8C]/15"
                        >
                          Primary
                        </button>
                        <button
                          type="button"
                          onClick={() => onLinkSecondary?.(a)}
                          className="rounded-lg border border-white/10 px-2 py-1 text-[10px] font-semibold text-white/60 hover:bg-white/5"
                        >
                          Secondary
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {filtered.length > PAGE_SIZE ? (
        <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-3 text-xs text-white/45">
          <span>
            {filtered.length} accounts · page {safePage}/{totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-white/10 p-1.5 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-lg border border-white/10 p-1.5 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
