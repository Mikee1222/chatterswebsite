"use client";

import * as React from "react";
import { formatDate } from "@/lib/format-date";

type Creator = { id: string; nickName?: string; name?: string };
type Group = { id: string; name: string; model_ids: string };
type Tx = {
  id: string;
  createdTime?: string;
  fanName?: string;
  creatorName?: string;
  type?: string;
  amount?: string | number;
};

type View = "daily" | "weekly" | "monthly";

export function AdminEarningsClient() {
  const [view, setView] = React.useState<View>("daily");
  const [dateRange, setDateRange] = React.useState(() => ({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    end: new Date().toISOString().slice(0, 10),
  }));
  const [selectedModels, setSelectedModels] = React.useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = React.useState<string | null>(null);
  const [creators, setCreators] = React.useState<Creator[]>([]);
  const [groups, setGroups] = React.useState<Group[]>([]);
  const [transactions, setTransactions] = React.useState<Tx[]>([]);
  const [revenue, setRevenue] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [groupName, setGroupName] = React.useState("");
  const [savingGroup, setSavingGroup] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const groupModelIds = React.useMemo(() => {
    const g = groups.find((x) => x.id === selectedGroup);
    if (!g) return [];
    return g.model_ids.split(",").map((v) => v.trim()).filter(Boolean);
  }, [groups, selectedGroup]);

  React.useEffect(() => {
    async function load() {
      try {
        const [creatorsData, groupsData] = await Promise.all([
          fetch("/api/infloww/creators").then((r) => r.json()),
          fetch("/api/model-groups").then((r) => r.json()),
        ]);
        setCreators((creatorsData?.list ?? []) as Creator[]);
        setGroups((groupsData ?? []) as Group[]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load filters");
      }
    }
    void load();
  }, []);

  React.useEffect(() => {
    const end = new Date();
    if (view === "daily") {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      setDateRange({ start: d.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) });
    } else if (view === "weekly") {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setDateRange({ start: d.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) });
    } else {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      setDateRange({ start: d.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) });
    }
  }, [view]);

  React.useEffect(() => {
    async function loadTransactions() {
      setLoading(true);
      setError(null);
      try {
        const creatorIds = (selectedGroup ? groupModelIds : selectedModels).join(",");
        const params = new URLSearchParams({
          startDate: new Date(dateRange.start).toISOString(),
          endDate: new Date(dateRange.end).toISOString(),
          ...(creatorIds ? { creatorIds } : {}),
        });
        const data = await fetch(`/api/infloww/transactions?${params.toString()}`).then((r) => r.json());
        const list = (data?.list ?? []) as Tx[];
        setTransactions(list);
        setRevenue(
          list.reduce((sum, tx) => {
            const amount = typeof tx.amount === "number" ? tx.amount : Number(tx.amount ?? 0);
            return sum + (Number.isFinite(amount) ? amount : 0);
          }, 0)
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load transactions");
        setTransactions([]);
        setRevenue(0);
      } finally {
        setLoading(false);
      }
    }
    void loadTransactions();
  }, [dateRange, selectedModels, selectedGroup, groupModelIds]);

  async function createGroup() {
    if (!groupName.trim()) return;
    setSavingGroup(true);
    setError(null);
    try {
      const res = await fetch("/api/model-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: groupName.trim(), model_ids: selectedModels }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to create group");
      setGroups((prev) => [...prev, data]);
      setGroupName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create group");
    } finally {
      setSavingGroup(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <h1 className="text-2xl font-bold text-white">Earnings Dashboard</h1>

      <div className="flex gap-2">
        {(["daily", "weekly", "monthly"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`rounded-xl px-4 py-2 ${
              view === v ? "bg-pink-500 text-white" : "bg-white/5 text-white/60 hover:bg-white/10"
            }`}
          >
            {v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm text-white/60">Start Date</label>
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange((d) => ({ ...d, start: e.target.value }))}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm text-white/60">End Date</label>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange((d) => ({ ...d, end: e.target.value }))}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white"
          />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm text-white/60">Filter by Models</label>
        <select
          multiple
          value={selectedModels}
          onChange={(e) => {
            setSelectedGroup(null);
            setSelectedModels(Array.from(e.target.selectedOptions, (opt) => opt.value));
          }}
          className="min-h-[120px] w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white"
        >
          {creators.map((creator) => (
            <option key={creator.id} value={creator.id}>
              {creator.nickName || creator.name || creator.id}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-2 block text-sm text-white/60">Or Select Group</label>
        <select
          value={selectedGroup || ""}
          onChange={(e) => {
            setSelectedModels([]);
            setSelectedGroup(e.target.value || null);
          }}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white"
        >
          <option value="">No group</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-2xl border border-green-500/30 bg-gradient-to-br from-green-500/20 to-emerald-500/20 p-8">
        <p className="mb-2 text-sm text-green-400">Total Revenue</p>
        <p className="text-4xl font-bold text-white">${revenue.toFixed(2)}</p>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 md:flex-row md:items-end">
        <div className="flex-1">
          <label className="mb-2 block text-sm text-white/60">New Group Name</label>
          <input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-white"
            placeholder="Top performers"
          />
        </div>
        <button
          onClick={() => void createGroup()}
          disabled={savingGroup || selectedModels.length === 0}
          className="rounded-xl bg-pink-500 px-6 py-3 text-white hover:bg-pink-600 disabled:opacity-50"
        >
          {savingGroup ? "Creating..." : "+ Create Model Group"}
        </button>
      </div>

      {error ? <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p> : null}

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5">
        <table className="w-full min-w-[640px]">
          <thead className="border-b border-white/10 bg-white/5">
            <tr>
              <th className="p-4 text-left text-sm text-white/60">Date</th>
              <th className="p-4 text-left text-sm text-white/60">Creator</th>
              <th className="p-4 text-left text-sm text-white/60">Type</th>
              <th className="p-4 text-right text-sm text-white/60">Amount</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-white/40">
                  Loading...
                </td>
              </tr>
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-white/40">
                  No transactions
                </td>
              </tr>
            ) : (
              transactions.map((tx) => (
                <tr key={tx.id} className="border-b border-white/5">
                  <td className="p-4 text-sm text-white/80">
                    {tx.createdTime ? formatDate(tx.createdTime) : "—"}
                  </td>
                  <td className="p-4 text-sm text-white">{tx.creatorName || tx.fanName || "—"}</td>
                  <td className="p-4 text-sm text-white/60">{tx.type || "—"}</td>
                  <td className="p-4 text-right font-semibold text-green-400">${Number(tx.amount ?? 0).toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
