"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { formatMonthYyyyMm } from "@/lib/format";
import { FormInput } from "@/components/ui/form-input";
import type { FineBonusRecord, FineBonusType, FineBonusUserRole } from "@/services/fines-bonuses";

type UserOpt = { id: string; name: string; user_role: FineBonusUserRole };

type Props = {
  initialEntries: FineBonusRecord[];
  userOptions: UserOpt[];
};

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

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

export function AdminFinesBonusesClient({ initialEntries, userOptions }: Props) {
  const [rows] = React.useState(initialEntries);
  const [userFilter, setUserFilter] = React.useState("all");
  const [roleFilter, setRoleFilter] = React.useState<"all" | FineBonusUserRole>("all");
  const [typeFilter, setTypeFilter] = React.useState<"all" | FineBonusType>("all");
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
    return rows.filter((r) => {
      if (userFilter !== "all" && r.user_id !== userFilter) return false;
      if (roleFilter !== "all" && r.user_role !== roleFilter) return false;
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      if (monthFilter && r.month !== monthFilter) return false;
      if (q && !r.reason.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, userFilter, roleFilter, typeFilter, monthFilter, search]);

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
          <div key={s.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">{s.label}</p>
            <p className={`mt-1 text-xl font-bold ${s.cls}`}>{s.v}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
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
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <FormInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reason…"
            className="!pl-9"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.04] text-xs uppercase tracking-wider text-white/45">
              <th className="px-4 py-3 font-semibold">User</th>
              <th className="px-4 py-3 font-semibold">Role</th>
              <th className="px-4 py-3 font-semibold">Type</th>
              <th className="px-4 py-3 font-semibold">Amount</th>
              <th className="px-4 py-3 font-semibold">Reason</th>
              <th className="px-4 py-3 font-semibold">Month</th>
              <th className="px-4 py-3 font-semibold">Date</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-white/40">
                  No entries match filters.
                </td>
              </tr>
            ) : (
              filtered.map((e) => (
                <tr key={e.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                  <td className="px-4 py-3 font-medium text-white">{e.user_name}</td>
                  <td className="px-4 py-3">
                    <RoleBadge role={e.user_role} />
                  </td>
                  <td className="px-4 py-3">
                    <TypeBadge type={e.type} />
                  </td>
                  <td className={`px-4 py-3 font-semibold ${e.type === "bonus" ? "text-green-400" : "text-red-400"}`}>
                    {e.type === "bonus" ? "+" : "-"}€{e.amount.toFixed(2)}
                  </td>
                  <td className="max-w-[220px] truncate px-4 py-3 text-white/80" title={e.reason}>
                    {e.reason}
                  </td>
                  <td className="px-4 py-3 text-white/60">{formatMonthYyyyMm(e.month)}</td>
                  <td className="px-4 py-3 text-xs text-white/40">{timeAgo(e.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
