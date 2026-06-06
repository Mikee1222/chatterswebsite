"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { formatDateTimeEuropean } from "@/lib/format";

export type AdminRebillRow = {
  id: string;
  rebill_id: string;
  chatter_id: string;
  chatter_name: string;
  model_id: string;
  model_name: string;
  sub_username: string;
  sub_type: "paid" | "free" | "free_trial";
  screenshot: Array<{ id?: string; url?: string; filename?: string }>;
  status: "pending" | "verified" | "rejected";
  admin_notes: string;
  created_at: string;
};

export type AdminTipRow = {
  id: string;
  tip_id: string;
  chatter_id: string;
  chatter_name: string;
  model_id: string;
  model_name: string;
  sub_username: string;
  amount_usd: number;
  screenshot: Array<{ id?: string; url?: string; filename?: string }>;
  status: "pending" | "verified" | "rejected";
  admin_notes: string;
  created_at: string;
};

type Tab = "rebills" | "tips" | "standings";
type StandingsDatePreset = "week" | "month" | "last_month" | "all" | "custom";

type StandingRow = {
  rank: number;
  chatter_id: string;
  chatter_name: string;
  approved: number;
  pending: number;
  rejected: number;
  total: number;
};

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getStandingsDateRange(preset: StandingsDatePreset): { from?: string; to?: string } {
  const now = new Date();
  const today = toDateStr(now);

  if (preset === "all" || preset === "custom") return {};

  if (preset === "week") {
    const start = new Date(now);
    const day = start.getDay();
    const diff = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - diff);
    return { from: toDateStr(start), to: today };
  }

  if (preset === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: toDateStr(start), to: today };
  }

  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0);
  return { from: toDateStr(start), to: toDateStr(end) };
}

function filterRebillsForStandings(
  rebills: AdminRebillRow[],
  opts: { from?: string; to?: string; chatterId?: string; modelId?: string }
): AdminRebillRow[] {
  let list = [...rebills];

  if (opts.from) {
    list = list.filter((r) => (r.created_at || "").slice(0, 10) >= opts.from!);
  }
  if (opts.to) {
    list = list.filter((r) => {
      const d = (r.created_at || "").slice(0, 10);
      return d && d <= opts.to!;
    });
  }
  if (opts.chatterId && opts.chatterId !== "all") {
    list = list.filter((r) => r.chatter_id === opts.chatterId);
  }
  if (opts.modelId && opts.modelId !== "all") {
    list = list.filter((r) => r.model_id === opts.modelId);
  }

  return list;
}

function computeStandingsFromRebills(rebills: AdminRebillRow[]): StandingRow[] {
  const map = new Map<
    string,
    { chatter_id: string; chatter_name: string; approved: number; pending: number; rejected: number }
  >();

  for (const r of rebills) {
    const key = r.chatter_id || r.chatter_name;
    if (!key || key === "—") continue;
    const existing = map.get(key) ?? {
      chatter_id: r.chatter_id,
      chatter_name: r.chatter_name,
      approved: 0,
      pending: 0,
      rejected: 0,
    };
    if (r.status === "verified") existing.approved++;
    else if (r.status === "pending") existing.pending++;
    else if (r.status === "rejected") existing.rejected++;
    map.set(key, existing);
  }

  return Array.from(map.values())
    .map((s) => ({ ...s, total: s.approved + s.pending + s.rejected }))
    .sort(
      (a, b) =>
        b.approved - a.approved ||
        b.pending - a.pending ||
        b.total - a.total ||
        a.chatter_name.localeCompare(b.chatter_name)
    )
    .map((s, i) => ({ ...s, rank: i + 1 }));
}

function standingsRowHighlight(rank: number): string {
  if (rank === 1) return "bg-amber-500/10 border-l-2 border-l-amber-400/60";
  if (rank === 2) return "bg-white/[0.07] border-l-2 border-l-white/40";
  if (rank === 3) return "bg-orange-700/10 border-l-2 border-l-orange-500/50";
  if (rank <= 5) return "bg-pink-500/5 border-l-2 border-l-pink-500/20";
  return "";
}

function rankMedal(rank: number): React.ReactNode {
  if (rank === 1) return <span className="text-2xl">🥇</span>;
  if (rank === 2) return <span className="text-2xl">🥈</span>;
  if (rank === 3) return <span className="text-xl">🥉</span>;
  return <span className="text-sm font-bold text-white/40">#{rank}</span>;
}

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

function normalizeRebillSubType(raw: string): AdminRebillRow["sub_type"] {
  const s = String(raw || "").trim();
  if (s === "paid" || s === "free" || s === "free_trial") return s;
  return "paid";
}

function normalizeRowStatus(raw: string): AdminRebillRow["status"] {
  const s = String(raw || "").trim();
  if (s === "pending" || s === "verified" || s === "rejected") return s;
  return "pending";
}

const usdFmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

export function AdminRebillsTipsClient({
  initialRebills,
  initialTips,
}: {
  initialRebills: AdminRebillRow[];
  initialTips: AdminTipRow[];
}) {
  const [rebills, setRebills] = React.useState(
    initialRebills
      .map((r) => ({
        ...r,
        sub_type: normalizeRebillSubType(r.sub_type),
        status: normalizeRowStatus(r.status),
      }))
      .filter((r) => r.sub_type === "paid")
  );
  const [tips, setTips] = React.useState(
    initialTips.map((r) => ({
      ...r,
      status: normalizeRowStatus(r.status),
    }))
  );

  const [activeTab, setActiveTab] = React.useState<Tab>("rebills");
  const [standingsDatePreset, setStandingsDatePreset] = React.useState<StandingsDatePreset>("month");
  const [standingsFromDate, setStandingsFromDate] = React.useState("");
  const [standingsToDate, setStandingsToDate] = React.useState("");
  const [standingsChatterFilter, setStandingsChatterFilter] = React.useState("all");
  const [standingsChatterQuery, setStandingsChatterQuery] = React.useState("");
  const [standingsChatterOpen, setStandingsChatterOpen] = React.useState(false);
  const [standingsModelFilter, setStandingsModelFilter] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [modelFilter, setModelFilter] = React.useState("all");
  const [chatterFilter, setChatterFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState<"all" | "pending" | "verified" | "rejected">("all");
  const [fromDate, setFromDate] = React.useState("");
  const [toDate, setToDate] = React.useState("");

  const [notesOpenId, setNotesOpenId] = React.useState<string | null>(null);
  const [noteDraft, setNoteDraft] = React.useState("");
  const [patchingId, setPatchingId] = React.useState<string | null>(null);

  const baseList: (AdminRebillRow | AdminTipRow)[] = activeTab === "rebills" ? rebills : tips;

  const modelOptions = React.useMemo(() => {
    const names = new Map<string, string>();
    for (const row of baseList) {
      if (row.model_id) names.set(row.model_id, row.model_name || row.model_id);
    }
    return [...names.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [baseList]);

  const chatterOptions = React.useMemo(() => {
    const names = new Set<string>();
    for (const row of baseList) {
      const n = row.chatter_name.trim();
      if (n && n !== "—") names.add(n);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [baseList]);

  const summarySource = React.useMemo(() => {
    const rows = activeTab === "rebills" ? rebills : tips;
    let list = [...rows];

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const blob = `${r.sub_username} ${r.chatter_name} ${r.model_name}`.toLowerCase();
        const extra =
          activeTab === "rebills"
            ? (r as AdminRebillRow).sub_type
            : String((r as AdminTipRow).amount_usd);
        return blob.includes(q) || extra.includes(q);
      });
    }

    if (modelFilter !== "all") list = list.filter((r) => r.model_id === modelFilter);
    if (chatterFilter !== "all") list = list.filter((r) => r.chatter_name === chatterFilter);

    if (fromDate) {
      list = list.filter((r) => {
        const d = (r.created_at || "").slice(0, 10);
        return d >= fromDate;
      });
    }
    if (toDate) {
      list = list.filter((r) => {
        const d = (r.created_at || "").slice(0, 10);
        return d && d <= toDate;
      });
    }

    return list;
  }, [activeTab, rebills, tips, search, modelFilter, chatterFilter, fromDate, toDate]);

  const summaries = React.useMemo(() => {
    const pending = summarySource.filter((r) => r.status === "pending").length;
    const verified = summarySource.filter((r) => r.status === "verified").length;
    const rejected = summarySource.filter((r) => r.status === "rejected").length;
    return { total: summarySource.length, pending, verified, rejected };
  }, [summarySource]);

  const filtered = React.useMemo(() => {
    if (statusFilter === "all") return summarySource;
    return summarySource.filter((r) => r.status === statusFilter);
  }, [summarySource, statusFilter]);

  const standingsModelOptions = React.useMemo(() => {
    const names = new Map<string, string>();
    for (const row of rebills) {
      if (row.model_id) names.set(row.model_id, row.model_name || row.model_id);
    }
    return [...names.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rebills]);

  const standingsChatterOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const row of rebills) {
      if (row.chatter_id) map.set(row.chatter_id, row.chatter_name || row.chatter_id);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rebills]);

  const filteredStandingsChatterOptions = React.useMemo(() => {
    const q = standingsChatterQuery.trim().toLowerCase();
    if (!q) return standingsChatterOptions;
    return standingsChatterOptions.filter(
      ([id, name]) => name.toLowerCase().includes(q) || id.toLowerCase().includes(q)
    );
  }, [standingsChatterOptions, standingsChatterQuery]);

  const standingsDateRange = React.useMemo(() => {
    if (standingsDatePreset === "custom") {
      return {
        from: standingsFromDate || undefined,
        to: standingsToDate || undefined,
      };
    }
    return getStandingsDateRange(standingsDatePreset);
  }, [standingsDatePreset, standingsFromDate, standingsToDate]);

  const filteredStandingsRebills = React.useMemo(
    () =>
      filterRebillsForStandings(rebills, {
        from: standingsDateRange.from,
        to: standingsDateRange.to,
        chatterId: standingsChatterFilter,
        modelId: standingsModelFilter,
      }),
    [rebills, standingsDateRange, standingsChatterFilter, standingsModelFilter]
  );

  const standings = React.useMemo(
    () => computeStandingsFromRebills(filteredStandingsRebills),
    [filteredStandingsRebills]
  );

  const standingsStats = React.useMemo(() => {
    const approved = filteredStandingsRebills.filter((r) => r.status === "verified").length;
    const pending = filteredStandingsRebills.filter((r) => r.status === "pending").length;
    const rejected = filteredStandingsRebills.filter((r) => r.status === "rejected").length;
    const best = standings[0];
    return {
      approved,
      pending,
      rejected,
      bestName: best?.chatter_name ?? "—",
      bestCount: best?.approved ?? 0,
    };
  }, [filteredStandingsRebills, standings]);

  const topFive = standings.slice(0, 5);
  const podiumTopThree = [topFive[1], topFive[0], topFive[2]].filter(Boolean) as StandingRow[];

  function clearStandingsFilters() {
    setStandingsDatePreset("month");
    setStandingsFromDate("");
    setStandingsToDate("");
    setStandingsChatterFilter("all");
    setStandingsChatterQuery("");
    setStandingsModelFilter("all");
  }

  const hasStandingsFilters =
    standingsDatePreset !== "month" ||
    Boolean(standingsFromDate) ||
    Boolean(standingsToDate) ||
    standingsChatterFilter !== "all" ||
    standingsModelFilter !== "all";

  function clearFilters() {
    setSearch("");
    setModelFilter("all");
    setChatterFilter("all");
    setStatusFilter("all");
    setFromDate("");
    setToDate("");
  }

  const hasFilters =
    Boolean(search) ||
    modelFilter !== "all" ||
    chatterFilter !== "all" ||
    statusFilter !== "all" ||
    Boolean(fromDate) ||
    Boolean(toDate);

  React.useEffect(() => {
    if (!notesOpenId) return;
    const row =
      [...rebills, ...tips].find((r) => r.id === notesOpenId) ??
      null;
    if (row) setNoteDraft(row.admin_notes);
  }, [notesOpenId, rebills, tips]);

  async function patchRecord(
    table: "rebill" | "tip",
    id: string,
    body: { status?: AdminRebillRow["status"]; admin_notes?: string }
  ) {
    const path =
      table === "rebill" ? `/api/admin/rebills/${encodeURIComponent(id)}` : `/api/admin/tips/${encodeURIComponent(id)}`;
    const res = await fetch(path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(j.error || "Update failed");
    }
  }

  async function updateStatus(id: string, status: AdminRebillRow["status"], kind: "rebills" | "tips") {
    setPatchingId(id);
    const prevR = rebills;
    const prevT = tips;
    if (kind === "rebills") {
      setRebills((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));
    } else {
      setTips((ts) => ts.map((t) => (t.id === id ? { ...t, status } : t)));
    }
    try {
      await patchRecord(kind === "rebills" ? "rebill" : "tip", id, { status });
    } catch {
      setRebills(prevR);
      setTips(prevT);
    } finally {
      setPatchingId(null);
    }
  }

  async function saveNotes(id: string, kind: "rebills" | "tips") {
    setPatchingId(id);
    const prevR = rebills;
    const prevT = tips;
    if (kind === "rebills") {
      setRebills((rs) => rs.map((r) => (r.id === id ? { ...r, admin_notes: noteDraft } : r)));
    } else {
      setTips((ts) => ts.map((t) => (t.id === id ? { ...t, admin_notes: noteDraft } : t)));
    }
    try {
      await patchRecord(kind === "rebills" ? "rebill" : "tip", id, { admin_notes: noteDraft });
      setNotesOpenId(null);
    } catch {
      setRebills(prevR);
      setTips(prevT);
    } finally {
      setPatchingId(null);
    }
  }

  function openNotes(row: AdminRebillRow | AdminTipRow) {
    if (notesOpenId === row.id) {
      setNotesOpenId(null);
      return;
    }
    setNotesOpenId(row.id);
    setNoteDraft(row.admin_notes ?? "");
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">Administration</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Rebills &amp; Tips</h1>
        <p className="mt-1 text-sm text-white/55">Review chatter-submitted rebills and missing tips</p>
      </header>

      <div className="flex gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-1">
        <button
          type="button"
          onClick={() => {
            setNotesOpenId(null);
            setActiveTab("rebills");
            clearFilters();
          }}
          className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
            activeTab === "rebills"
              ? "bg-white/10 text-white shadow-sm"
              : "text-white/45 hover:text-white/70"
          }`}
        >
          💳 Rebills
        </button>
        <button
          type="button"
          onClick={() => {
            setNotesOpenId(null);
            setActiveTab("tips");
            clearFilters();
          }}
          className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
            activeTab === "tips" ? "bg-white/10 text-white shadow-sm" : "text-white/45 hover:text-white/70"
          }`}
        >
          💰 Tips
        </button>
        <button
          type="button"
          onClick={() => {
            setNotesOpenId(null);
            setActiveTab("standings");
          }}
          className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
            activeTab === "standings"
              ? "bg-white/10 text-white shadow-sm"
              : "text-white/45 hover:text-white/70"
          }`}
        >
          🏆 Standings
        </button>
      </div>

      {activeTab === "standings" ? (
        <div className="space-y-6">
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="glass-card px-4 py-3 text-center">
              <p className="text-xs uppercase tracking-wide text-white/45">Total Approved</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-400">{standingsStats.approved}</p>
            </div>
            <div className="glass-card px-4 py-3 text-center">
              <p className="text-xs uppercase tracking-wide text-white/45">Total Pending</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-yellow-400">{standingsStats.pending}</p>
            </div>
            <div className="glass-card px-4 py-3 text-center">
              <p className="text-xs uppercase tracking-wide text-white/45">Total Rejected</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-red-400">{standingsStats.rejected}</p>
            </div>
            <div className="glass-card px-4 py-3 text-center">
              <p className="text-xs uppercase tracking-wide text-white/45">Best Performer</p>
              <p className="mt-1 truncate text-lg font-semibold text-pink-300">{standingsStats.bestName}</p>
              <p className="text-sm tabular-nums text-white/50">{standingsStats.bestCount} approved</p>
            </div>
          </section>

          <section className="glass-card space-y-4 p-4">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { key: "week", label: "This week" },
                  { key: "month", label: "This month" },
                  { key: "last_month", label: "Last month" },
                  { key: "all", label: "All time" },
                  { key: "custom", label: "Custom" },
                ] as const
              ).map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => {
                    setStandingsDatePreset(p.key);
                    if (p.key !== "custom") {
                      setStandingsFromDate("");
                      setStandingsToDate("");
                    }
                  }}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    standingsDatePreset === p.key
                      ? "border-pink-500/30 bg-pink-500/20 text-pink-300"
                      : "border-white/10 text-white/50 hover:border-white/20 hover:text-white"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <input
                type="date"
                value={standingsFromDate}
                onChange={(e) => {
                  setStandingsFromDate(e.target.value);
                  setStandingsDatePreset("custom");
                }}
                className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                aria-label="Standings from date"
              />
              <input
                type="date"
                value={standingsToDate}
                onChange={(e) => {
                  setStandingsToDate(e.target.value);
                  setStandingsDatePreset("custom");
                }}
                className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                aria-label="Standings to date"
              />

              <div className="relative md:col-span-1 lg:col-span-1">
                <input
                  value={
                    standingsChatterFilter === "all"
                      ? standingsChatterQuery
                      : standingsChatterQuery ||
                        standingsChatterOptions.find(([id]) => id === standingsChatterFilter)?.[1] ||
                        ""
                  }
                  onChange={(e) => {
                    setStandingsChatterQuery(e.target.value);
                    setStandingsChatterFilter("all");
                    setStandingsChatterOpen(true);
                  }}
                  onFocus={() => setStandingsChatterOpen(true)}
                  onBlur={() => window.setTimeout(() => setStandingsChatterOpen(false), 150)}
                  placeholder="All chatters"
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/35"
                  aria-label="Filter by chatter"
                />
                {standingsChatterOpen ? (
                  <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-white/10 bg-[#1a1020] py-1 shadow-xl">
                    <li>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setStandingsChatterFilter("all");
                          setStandingsChatterQuery("");
                          setStandingsChatterOpen(false);
                        }}
                        className="block w-full px-3 py-2 text-left text-sm text-white/70 hover:bg-white/5"
                      >
                        All chatters
                      </button>
                    </li>
                    {filteredStandingsChatterOptions.map(([id, name]) => (
                      <li key={id}>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setStandingsChatterFilter(id);
                            setStandingsChatterQuery(name);
                            setStandingsChatterOpen(false);
                          }}
                          className={`block w-full px-3 py-2 text-left text-sm hover:bg-white/5 ${
                            standingsChatterFilter === id ? "text-pink-300" : "text-white"
                          }`}
                        >
                          {name}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <select
                value={standingsModelFilter}
                onChange={(e) => setStandingsModelFilter(e.target.value)}
                className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                aria-label="Filter standings by model"
              >
                <option value="all">All models</option>
                {standingsModelOptions.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-white/40">
                {filteredStandingsRebills.length} rebill{filteredStandingsRebills.length === 1 ? "" : "s"} in range
              </p>
              <button
                type="button"
                onClick={clearStandingsFilters}
                disabled={!hasStandingsFilters}
                className="rounded-xl border border-white/15 px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/5 disabled:pointer-events-none disabled:opacity-40"
              >
                Clear filters
              </button>
            </div>
          </section>

          <p className="text-sm text-white/50">Ranked by approved paid rebills (verified status)</p>

          {standings.length === 0 ? (
            <p className="glass-card border-dashed py-12 text-center text-sm text-white/45">
              No rebill standings for this period.
            </p>
          ) : (
            <>
              {topFive.length > 0 ? (
                <section className="space-y-4">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-white/45">Top 5 Podium</h2>

                  {podiumTopThree.length > 0 ? (
                    <div className="grid grid-cols-3 items-end gap-2 md:gap-4">
                      {podiumTopThree.map((s) => {
                        const isFirst = s.rank === 1;
                        const isSecond = s.rank === 2;
                        return (
                          <div
                            key={s.chatter_id || s.chatter_name}
                            className={`glass-card flex flex-col items-center text-center transition ${
                              isFirst
                                ? "order-2 min-h-[220px] border-amber-400/30 bg-gradient-to-b from-amber-500/15 to-transparent p-5 md:min-h-[260px] md:p-6"
                                : isSecond
                                  ? "order-1 min-h-[180px] p-4 md:min-h-[210px]"
                                  : "order-3 min-h-[160px] border-orange-600/20 p-4 md:min-h-[190px]"
                            }`}
                          >
                            <div className="mb-2">{rankMedal(s.rank)}</div>
                            <p className={`truncate font-semibold ${isFirst ? "text-lg text-white" : "text-white/90"}`}>
                              {s.chatter_name}
                            </p>
                            <p
                              className={`mt-2 font-bold tabular-nums text-emerald-400 ${
                                isFirst ? "text-4xl md:text-5xl" : isSecond ? "text-3xl" : "text-2xl"
                              }`}
                            >
                              {s.approved}
                            </p>
                            <p className="text-xs text-white/45">Approved</p>
                            <div className="mt-2 flex flex-wrap justify-center gap-2 text-xs">
                              {s.pending > 0 ? (
                                <span className="text-yellow-400">{s.pending} pending</span>
                              ) : null}
                              {s.rejected > 0 ? (
                                <span className="text-red-400">{s.rejected} rejected</span>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}

                  {topFive.length > 3 ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {topFive.slice(3).map((s) => (
                        <div
                          key={s.chatter_id || s.chatter_name}
                          className="glass-card flex items-center gap-4 p-4"
                        >
                          <div className="w-10 flex-shrink-0 text-center">{rankMedal(s.rank)}</div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-white">{s.chatter_name}</p>
                            <div className="mt-1 flex flex-wrap gap-2 text-xs">
                              <span className="text-emerald-400">{s.approved} approved</span>
                              {s.pending > 0 ? <span className="text-yellow-400">{s.pending} pending</span> : null}
                              {s.rejected > 0 ? <span className="text-red-400">{s.rejected} rejected</span> : null}
                            </div>
                          </div>
                          <p className="text-2xl font-bold tabular-nums text-emerald-400">{s.approved}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </section>
              ) : null}

              <section className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-white/45">Full Leaderboard</h2>
                <div className="glass-card overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-white/45">
                        <th className="px-4 py-3 font-medium">Rank</th>
                        <th className="px-4 py-3 font-medium">Chatter</th>
                        <th className="px-4 py-3 text-right font-medium">Approved</th>
                        <th className="px-4 py-3 text-right font-medium">Pending</th>
                        <th className="px-4 py-3 text-right font-medium">Rejected</th>
                        <th className="px-4 py-3 text-right font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.map((s) => (
                        <tr
                          key={s.chatter_id || s.chatter_name}
                          className={`border-b border-white/5 last:border-0 ${standingsRowHighlight(s.rank)}`}
                        >
                          <td className="px-4 py-3">{rankMedal(s.rank)}</td>
                          <td className="px-4 py-3 font-medium text-white">{s.chatter_name}</td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums text-emerald-400">
                            {s.approved}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-yellow-400">{s.pending}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-red-400">{s.rejected}</td>
                          <td className="px-4 py-3 text-right font-medium tabular-nums text-white">{s.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </div>
      ) : (
        <>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Total", summaries.total],
          ["Pending", summaries.pending],
          ["Verified", summaries.verified],
          ["Rejected", summaries.rejected],
        ].map(([label, count]) => (
          <div
            key={String(label)}
            className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-center"
          >
            <p className="text-xs uppercase tracking-wide text-white/45">{label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{count}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
        <div className="grid gap-3 md:grid-cols-6 lg:grid-cols-12">
          <div className="relative md:col-span-3 lg:col-span-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search username..."
              className="w-full rounded-xl border border-white/10 bg-black/40 py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/35"
              aria-label="Search"
            />
          </div>
          <select
            value={modelFilter}
            onChange={(e) => setModelFilter(e.target.value)}
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white md:col-span-2 lg:col-span-2"
            aria-label="Filter by model"
          >
            <option value="all">All models</option>
            {modelOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <select
            value={chatterFilter}
            onChange={(e) => setChatterFilter(e.target.value)}
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white md:col-span-2 lg:col-span-2"
            aria-label="Filter by chatter"
          >
            <option value="all">All chatters</option>
            {chatterOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white md:col-span-2 lg:col-span-2"
            aria-label="Filter by status"
          >
            <option value="all">All status</option>
            <option value="pending">Pending</option>
            <option value="verified">Verified</option>
            <option value="rejected">Rejected</option>
          </select>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white md:col-span-2 lg:col-span-2"
            aria-label="From date"
          />
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white md:col-span-2 lg:col-span-2"
            aria-label="To date"
          />
          <div className="flex items-center md:col-span-3 lg:col-span-12">
            <button
              type="button"
              onClick={clearFilters}
              disabled={!hasFilters}
              className="rounded-xl border border-white/15 px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/5 disabled:pointer-events-none disabled:opacity-40"
            >
              Clear filters
            </button>
          </div>
        </div>
      </section>

      <p className="text-sm text-white/50">
        Results: Showing {filtered.length} of{" "}
        {activeTab === "rebills" ? rebills.length : tips.length} total in{" "}
        {activeTab === "rebills" ? "rebills" : "tips"}
      </p>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/15 py-12 text-center text-sm text-white/45">
          No records match your filters.
        </p>
      ) : (
        <ul className="space-y-3">
        {activeTab === "rebills"
          ? filtered.map((item) => {
              const r = item as AdminRebillRow;
              const shot = r.screenshot?.[0]?.url;
              const dt = formatDateTimeEuropean(r.created_at);
              const subLabel = r.sub_type.replace(/_/g, " ").toUpperCase();
              return (
                <li
                  key={r.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 transition hover:bg-white/[0.08]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                          r.sub_type === "paid"
                            ? "border-green-500/25 bg-green-500/15 text-green-400"
                            : r.sub_type === "free"
                              ? "border-blue-500/25 bg-blue-500/15 text-blue-400"
                              : "border-amber-500/25 bg-amber-500/15 text-amber-400"
                        }`}
                      >
                        💳 {subLabel}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs ${
                          r.status === "verified"
                            ? "border-green-500/25 bg-green-500/15 text-green-400"
                            : r.status === "rejected"
                              ? "border-red-500/25 bg-red-500/15 text-red-400"
                              : "border-amber-500/25 bg-amber-500/15 text-amber-400"
                        }`}
                      >
                        {r.status === "verified" ? "✅" : r.status === "rejected" ? "❌" : "⏳"} {r.status}
                      </span>
                    </div>
                    <span className="text-xs text-white/30">{timeAgo(r.created_at)}</span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold text-white">@{r.sub_username}</span>
                    <span className="text-white/30">•</span>
                    <span className="text-white/60">{r.chatter_name}</span>
                    <span className="text-white/30">→</span>
                    <span className="text-white/60">{r.model_name}</span>
                  </div>
                  {dt ? <p className="mt-1 text-xs text-white/35">{dt}</p> : null}

                  {shot ? (
                    <a
                      href={shot}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                    >
                      🖼 View screenshot
                    </a>
                  ) : null}

                  {r.status === "pending" ? (
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        disabled={patchingId === r.id}
                        onClick={() => void updateStatus(r.id, "verified", "rebills")}
                        className="flex-1 rounded-xl border border-green-500/30 bg-green-500/20 py-2 text-sm font-medium text-green-400 hover:bg-green-500/30 disabled:opacity-50"
                      >
                        ✅ Verify
                      </button>
                      <button
                        type="button"
                        disabled={patchingId === r.id}
                        onClick={() => void updateStatus(r.id, "rejected", "rebills")}
                        className="flex-1 rounded-xl border border-red-500/30 bg-red-500/20 py-2 text-sm font-medium text-red-400 hover:bg-red-500/30 disabled:opacity-50"
                      >
                        ❌ Reject
                      </button>
                    </div>
                  ) : null}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openNotes(r)}
                      className="rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/10"
                    >
                      📝 Notes
                    </button>
                  </div>

                  {notesOpenId === r.id ? (
                    <div className="mt-2 rounded-xl border border-white/10 bg-black/30 p-3">
                      <textarea
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        placeholder="Add note..."
                        rows={3}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/35"
                      />
                      <button
                        type="button"
                        disabled={patchingId === r.id}
                        onClick={() => void saveNotes(r.id, "rebills")}
                        className="mt-2 text-xs font-medium text-pink-400 hover:text-pink-300 disabled:opacity-50"
                      >
                        Save note
                      </button>
                    </div>
                  ) : r.admin_notes ? (
                    <p className="mt-2 whitespace-pre-wrap text-xs text-white/50">{r.admin_notes}</p>
                  ) : null}
                </li>
              );
            })
          : filtered.map((item) => {
              const t = item as AdminTipRow;
              const shot = t.screenshot?.[0]?.url;
              const dt = formatDateTimeEuropean(t.created_at);
              return (
                <li
                  key={t.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 transition hover:bg-white/[0.08]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-lg font-bold text-amber-400">💰 {usdFmt.format(t.amount_usd)}</span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs ${
                          t.status === "verified"
                            ? "border-green-500/25 bg-green-500/15 text-green-400"
                            : t.status === "rejected"
                              ? "border-red-500/25 bg-red-500/15 text-red-400"
                              : "border-amber-500/25 bg-amber-500/15 text-amber-400"
                        }`}
                      >
                        {t.status === "verified" ? "✅" : t.status === "rejected" ? "❌" : "⏳"} {t.status}
                      </span>
                    </div>
                    <span className="text-xs text-white/30">{timeAgo(t.created_at)}</span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold text-white">@{t.sub_username}</span>
                    <span className="text-white/30">•</span>
                    <span className="text-white/60">{t.chatter_name}</span>
                    <span className="text-white/30">→</span>
                    <span className="text-white/60">{t.model_name}</span>
                  </div>
                  {dt ? <p className="mt-1 text-xs text-white/35">{dt}</p> : null}

                  {shot ? (
                    <a
                      href={shot}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                    >
                      🖼 View screenshot
                    </a>
                  ) : null}

                  {t.status === "pending" ? (
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        disabled={patchingId === t.id}
                        onClick={() => void updateStatus(t.id, "verified", "tips")}
                        className="flex-1 rounded-xl border border-green-500/30 bg-green-500/20 py-2 text-sm font-medium text-green-400 hover:bg-green-500/30 disabled:opacity-50"
                      >
                        ✅ Verify
                      </button>
                      <button
                        type="button"
                        disabled={patchingId === t.id}
                        onClick={() => void updateStatus(t.id, "rejected", "tips")}
                        className="flex-1 rounded-xl border border-red-500/30 bg-red-500/20 py-2 text-sm font-medium text-red-400 hover:bg-red-500/30 disabled:opacity-50"
                      >
                        ❌ Reject
                      </button>
                    </div>
                  ) : null}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openNotes(t)}
                      className="rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/10"
                    >
                      📝 Notes
                    </button>
                  </div>

                  {notesOpenId === t.id ? (
                    <div className="mt-2 rounded-xl border border-white/10 bg-black/30 p-3">
                      <textarea
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        placeholder="Add note..."
                        rows={3}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/35"
                      />
                      <button
                        type="button"
                        disabled={patchingId === t.id}
                        onClick={() => void saveNotes(t.id, "tips")}
                        className="mt-2 text-xs font-medium text-pink-400 hover:text-pink-300 disabled:opacity-50"
                      >
                        Save note
                      </button>
                    </div>
                  ) : t.admin_notes ? (
                    <p className="mt-2 whitespace-pre-wrap text-xs text-white/50">{t.admin_notes}</p>
                  ) : null}
                </li>
              );
            })}
        </ul>
      )}
        </>
      )}
    </div>
  );
}
