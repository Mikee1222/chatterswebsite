"use client";

import * as React from "react";
import { Copy, RefreshCw, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { VA_CARD } from "@/lib/va-tasks-tokens";
import type { InflowwEmployee } from "@/types/infloww";

export function AdminInflowwEmployeesLookup() {
  const [employees, setEmployees] = React.useState<InflowwEmployee[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [copiedId, setCopiedId] = React.useState<number | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/infloww-employees");
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        employees?: InflowwEmployee[];
      };
      if (!res.ok) {
        throw new Error(body.error || `Failed to load employees (${res.status})`);
      }
      setEmployees(Array.isArray(body.employees) ? body.employees : []);
    } catch (e) {
      setEmployees([]);
      setError(e instanceof Error ? e.message : "Failed to load employees");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) => {
      const hay = [e.name, e.email, e.username, e.status, e.role, String(e.employeeId)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [employees, query]);

  async function copyId(id: number) {
    try {
      await navigator.clipboard.writeText(String(id));
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1500);
    } catch {
      setError("Could not copy to clipboard");
    }
  }

  return (
    <div className={cn(VA_CARD, "overflow-hidden")}>
      <div className="flex flex-col gap-3 border-b border-white/8 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
            Employee ID lookup
          </p>
          <p className="mt-1 text-sm text-white/55">
            Live Infloww employee list — copy the ID into Accounts → Infloww employee ID.
          </p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 self-start rounded-lg border border-[#D4AF8C]/40 bg-[#D4AF8C]/10 px-3 py-1.5 text-xs font-semibold text-[#D4AF8C] disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      <div className="border-b border-white/8 px-4 py-3">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/35" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email, or ID…"
            className="w-full rounded-lg border border-white/10 bg-black/30 py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/30"
          />
        </label>
      </div>

      {error ? (
        <p className="mx-4 my-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
          {error.toLowerCase().includes("not configured") ? (
            <span className="mt-1 block text-red-200/70">
              Set INFLOWW_API_KEY and INFLOWW_AGENCY_OID in Vercel env.
            </span>
          ) : null}
        </p>
      ) : null}

      {loading && employees.length === 0 && !error ? (
        <p className="px-4 py-10 text-center text-sm text-white/40">Loading employees from Infloww…</p>
      ) : null}

      {!loading && !error && filtered.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-white/40">
          {employees.length === 0 ? "No employees returned from Infloww." : "No matches for that search."}
        </p>
      ) : null}

      {filtered.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead>
              <tr className="border-b border-white/8 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">
                <th className="px-4 py-2.5">Employee ID</th>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Email</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Role</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.employeeId} className="border-b border-white/6 last:border-0 hover:bg-white/[0.03]">
                  <td className="px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => void copyId(e.employeeId)}
                      className="inline-flex items-center gap-1.5 font-mono tabular-nums text-[#D4AF8C] hover:text-[#FF1493]"
                      title="Copy employee ID"
                    >
                      {e.employeeId}
                      <Copy className="h-3 w-3 opacity-60" />
                      {copiedId === e.employeeId ? (
                        <span className="text-[10px] font-sans text-emerald-300">Copied</span>
                      ) : null}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-white">
                    {e.name}
                    {e.username ? (
                      <span className="mt-0.5 block text-xs text-white/35">@{e.username}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5 text-white/60">{e.email || "—"}</td>
                  <td className="px-4 py-2.5 text-white/60">{e.status || "—"}</td>
                  <td className="px-4 py-2.5 text-white/60">{e.role || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {!error && employees.length > 0 ? (
        <p className="border-t border-white/8 px-4 py-2 text-xs text-white/35">
          Showing {filtered.length} of {employees.length} employees
        </p>
      ) : null}
    </div>
  );
}
