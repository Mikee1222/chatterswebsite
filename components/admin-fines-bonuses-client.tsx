"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { formatDateTimeEuropean, formatMonthYyyyMm, formatRelativeTime } from "@/lib/format";
import { usePagination } from "@/lib/use-pagination";
import { FormInput } from "@/components/ui/form-input";
import {
  isSpinWheelFineBonus,
  type FineBonusRecord,
  type FineBonusType,
  type FineBonusUserRole,
} from "@/services/fines-bonuses";

type UserOpt = { id: string; name: string; user_role: FineBonusUserRole };

type Props = {
  initialEntries: FineBonusRecord[];
  userOptions: UserOpt[];
};

function RoleBadge({ role }: { role: FineBonusUserRole }) {
  const isVa = role === "va";
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${
        isVa ? "border-purple-500/30 bg-purple-500/15 text-purple-300" : "border-sky-500/30 bg-sky-500/15 text-sky-300"
      }`}
    >
      {isVa ? "VA" : "Chatter"}
    </span>
  );
}

function TypeBadge({ type }: { type: FineBonusType }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${
        type === "bonus" ? "border-green-500/30 bg-green-500/15 text-green-400" : "border-red-500/30 bg-red-500/15 text-red-400"
      }`}
    >
      {type}
    </span>
  );
}

function SpinWheelBadge() {
  return (
    <span className="inline-flex rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-300">
      Spin Wheel
    </span>
  );
}

function ManualBadge() {
  return (
    <span className="inline-flex rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-xs font-medium text-white/50">
      Manual
    </span>
  );
}

type SourceFilter = "all" | "manual" | "spin_wheel";

type MonthGroup = {
  month: string;
  entries: FineBonusRecord[];
};

function groupByMonth(entries: FineBonusRecord[]): MonthGroup[] {
  const map = new Map<string, FineBonusRecord[]>();
  for (const e of entries) {
    const m = e.month && /^\d{4}-\d{2}$/.test(e.month) ? e.month : "unknown";
    if (!map.has(m)) map.set(m, []);
    map.get(m)!.push(e);
  }
  return [...map.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, items]) => ({
      month,
      entries: items.sort((a, b) => b.created_at.localeCompare(a.created_at)),
    }));
}

export function AdminFinesBonusesClient({ initialEntries, userOptions }: Props) {
  const [rows] = React.useState(initialEntries);
  const [userFilter, setUserFilter] = React.useState("all");
  const [roleFilter, setRoleFilter] = React.useState<"all" | FineBonusUserRole>("all");
  const [typeFilter, setTypeFilter] = React.useState<"all" | FineBonusType>("all");
  const [sourceFilter, setSourceFilter] = React.useState<SourceFilter>("all");
  const [monthFilter, setMonthFilter] = React.useState("");
  const [search, setSearch] = React.useState("");

  const monthOptions = React.useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => {
      if (r.month && /^\d{4}-\d{2}$/.test(r.month)) s.add(r.month);
    });
    return [...s].sort((a, b) => b.localeCompare(a));
  }, [rows]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (userFilter !== "all" && r.user_id !== userFilter) return false;
        if (roleFilter !== "all" && r.user_role !== roleFilter) return false;
        if (typeFilter !== "all" && r.type !== typeFilter) return false;
        if (sourceFilter === "spin_wheel" && !isSpinWheelFineBonus(r)) return false;
        if (sourceFilter === "manual" && isSpinWheelFineBonus(r)) return false;
        if (monthFilter && r.month !== monthFilter) return false;
        if (q && !r.reason.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [rows, userFilter, roleFilter, typeFilter, sourceFilter, monthFilter, search]);

  const {
    page,
    setPage,
    totalPages,
    paginated: paginatedEntries,
    reset,
  } = usePagination(filtered, 20);

  React.useEffect(() => {
    reset();
  }, [userFilter, roleFilter, typeFilter, sourceFilter, monthFilter, search, reset]);

  const groupedPage = React.useMemo(() => groupByMonth(paginatedEntries), [paginatedEntries]);

  const stats = React.useMemo(() => {
    let bonuses = 0;
    let fines = 0;
    const people = new Set<string>();
    for (const r of filtered) {
      people.add(r.user_id);
      if (r.type === "bonus") bonuses += r.amount;
      else fines += r.amount;
    }
    return {
      bonuses,
      fines,
      net: bonuses - fines,
      people: people.size,
    };
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Fines &amp; bonuses</h1>
        <p className="mt-1 text-sm text-white/50">All issued entries.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Total bonuses issued", v: `€${stats.bonuses.toFixed(2)}`, cls: "text-green-400" },
          { label: "Total fines issued", v: `€${stats.fines.toFixed(2)}`, cls: "text-red-400" },
          { label: "Net (filtered)", v: `€${stats.net.toFixed(2)}`, cls: stats.net >= 0 ? "text-green-400" : "text-red-400" },
          { label: "People affected", v: String(stats.people), cls: "text-white" },
        ].map((s) => (
          <div key={s.label} className="glass-card p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">{s.label}</p>
            <p className={`mt-1 text-xl font-bold ${s.cls}`}>{s.v}</p>
          </div>
        ))}
      </div>

      <div className="glass-card flex flex-wrap gap-2 p-3">
        <select
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
          className="min-h-10 min-w-[140px] rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white"
        >
          <option value="all">All users</option>
          {userOptions.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}
          className="min-h-10 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white"
        >
          <option value="all">All roles</option>
          <option value="chatter">Chatter</option>
          <option value="va">VA</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
          className="min-h-10 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white"
        >
          <option value="all">All types</option>
          <option value="bonus">Bonus</option>
          <option value="fine">Fine</option>
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
          className="min-h-10 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white"
        >
          <option value="all">All sources</option>
          <option value="manual">Manual</option>
          <option value="spin_wheel">Spin Wheel</option>
        </select>
        <select
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          className="min-h-10 min-w-[140px] rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white"
        >
          <option value="">All months</option>
          {monthOptions.map((m) => (
            <option key={m} value={m}>
              {formatMonthYyyyMm(m)}
            </option>
          ))}
        </select>
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <FormInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reason…"
            className="!h-10 !pl-9"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="glass-card border-dashed py-12 text-center text-sm text-white/40">No entries match filters.</p>
      ) : (
        <>
          <div className="glass-card overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-white/10 bg-zinc-950/95 backdrop-blur-md">
                <tr className="text-xs uppercase tracking-wider text-white/45">
                  <th className="px-4 py-3.5 font-semibold">User</th>
                  <th className="px-4 py-3.5 font-semibold">Role</th>
                  <th className="px-4 py-3.5 font-semibold">Type</th>
                  <th className="px-4 py-3.5 text-right font-semibold">Amount</th>
                  <th className="px-4 py-3.5 font-semibold">Reason</th>
                  <th className="px-4 py-3.5 font-semibold">Source</th>
                  <th className="px-4 py-3.5 font-semibold">Date</th>
                </tr>
              </thead>
              <tbody>
                {groupedPage.map(({ month, entries }) => (
                  <React.Fragment key={month}>
                    <tr className="sticky top-[41px] z-[5] bg-zinc-900/95 backdrop-blur-sm">
                      <td colSpan={7} className="border-b border-pink-500/20 px-4 py-2">
                        <span className="text-xs font-semibold uppercase tracking-widest text-pink-300/80">
                          {month === "unknown" ? "Unknown month" : formatMonthYyyyMm(month)}
                        </span>
                      </td>
                    </tr>
                    {entries.map((e, idx) => (
                      <tr
                        key={e.id}
                        className={`border-b border-white/[0.06] transition-colors last:border-0 hover:bg-white/[0.04] ${
                          idx % 2 === 1 ? "bg-white/[0.02]" : ""
                        }`}
                      >
                        <td className="px-4 py-3 font-medium text-white">{e.user_name}</td>
                        <td className="px-4 py-3">
                          <RoleBadge role={e.user_role} />
                        </td>
                        <td className="px-4 py-3">
                          <TypeBadge type={e.type} />
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-bold tabular-nums ${
                            e.type === "bonus" ? "text-green-400" : "text-red-400"
                          }`}
                        >
                          {e.type === "bonus" ? "+" : "-"}€{e.amount.toFixed(2)}
                        </td>
                        <td className="max-w-[220px] truncate px-4 py-3 text-white/80" title={e.reason}>
                          {e.reason}
                        </td>
                        <td className="px-4 py-3">
                          {isSpinWheelFineBonus(e) ? <SpinWheelBadge /> : <ManualBadge />}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className="text-xs text-white/40"
                            title={formatDateTimeEuropean(e.created_at) || undefined}
                          >
                            {formatRelativeTime(e.created_at)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <PaginationControls page={page} totalPages={totalPages} onPage={setPage} totalItems={filtered.length} />
        </>
      )}
    </div>
  );
}
