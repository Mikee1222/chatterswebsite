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

type Tab = "rebills" | "tips";

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

  async function updateStatus(id: string, status: AdminRebillRow["status"], kind: Tab) {
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

  async function saveNotes(id: string, kind: Tab) {
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
      </div>

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
    </div>
  );
}
