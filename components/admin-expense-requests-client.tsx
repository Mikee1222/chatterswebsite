"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import type { ModelExpenseRequest } from "@/types";
import { formatDateTimeEuropean } from "@/lib/format";

type Props = {
  initialRows: ModelExpenseRequest[];
  modelNameById: Record<string, string>;
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

function listStatusBadge(status: ModelExpenseRequest["status"]): string {
  if (status === "pending") return "bg-amber-500/15 border-amber-500/25 text-amber-400";
  if (status === "approved") return "bg-green-500/15 border-green-500/25 text-green-400";
  return "bg-red-500/15 border-red-500/25 text-red-400";
}

function readOnlyStatusClass(status: string): string {
  if (status === "approved") return "text-green-400";
  if (status === "rejected") return "text-red-400";
  return "text-amber-400";
}

export function AdminExpenseRequestsClient({ initialRows, modelNameById }: Props) {
  const [rows, setRows] = React.useState(initialRows);
  const [selectedId, setSelectedId] = React.useState<string | null>(initialRows[0]?.id ?? null);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"all" | "pending" | "approved" | "rejected">("all");
  const [modelFilter, setModelFilter] = React.useState("all");
  const [fromDate, setFromDate] = React.useState("");
  const [toDate, setToDate] = React.useState("");
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const selected = rows.find((r) => r.id === selectedId) ?? null;
  React.useEffect(() => setNote(selected?.admin_notes ?? ""), [selectedId, selected?.admin_notes]);

  const modelOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => map.set(r.model_id, modelNameById[r.model_id] || r.model_id));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows, modelNameById]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (modelFilter !== "all" && r.model_id !== modelFilter) return false;
      if (fromDate) {
        const d = (r.created_at || "").slice(0, 10);
        if (!d || d < fromDate) return false;
      }
      if (toDate) {
        const d = (r.created_at || "").slice(0, 10);
        if (!d || d > toDate) return false;
      }
      if (!q) return true;
      return `${r.assignment_title} ${r.airbnb_link} ${r.notes}`.toLowerCase().includes(q);
    });
  }, [rows, statusFilter, modelFilter, search, fromDate, toDate]);

  const stats = React.useMemo(() => {
    const pending = rows.filter((r) => r.status === "pending").length;
    const approved = rows.filter((r) => r.status === "approved").length;
    const rejected = rows.filter((r) => r.status === "rejected").length;
    return { total: rows.length, pending, approved, rejected };
  }, [rows]);

  async function patch(next: "approved" | "rejected") {
    if (!selected) return;
    setSaving(true);
    const prev = rows;
    setRows((p) => p.map((r) => (r.id === selected.id ? { ...r, status: next, admin_notes: note } : r)));
    try {
      const res = await fetch(`/api/admin/expense-requests/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: next,
          admin_notes: note,
          model_id: selected.model_id,
        }),
      });
      if (!res.ok) throw new Error("Failed");
    } catch {
      setRows(prev);
    } finally {
      setSaving(false);
    }
  }

  async function saveNotesOnly() {
    if (!selected) return;
    setSaving(true);
    const prev = rows;
    setRows((p) => p.map((r) => (r.id === selected.id ? { ...r, admin_notes: note } : r)));
    try {
      const res = await fetch(`/api/admin/expense-requests/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_notes: note, model_id: selected.model_id }),
      });
      if (!res.ok) throw new Error("Failed");
    } catch {
      setRows(prev);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-white/40">Administration</p>
        <h1 className="text-3xl font-bold text-white">Expense requests</h1>
        <p className="mt-1 text-sm text-white/50">Airbnb requests from model VA content assignments</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total", value: stats.total, color: "text-white" },
          { label: "Pending", value: stats.pending, color: "text-amber-400" },
          { label: "Approved", value: stats.approved, color: "text-green-400" },
          { label: "Rejected", value: stats.rejected, color: "text-red-400" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-widest text-white/40">{stat.label}</p>
            <p className={`mt-1 text-3xl font-bold tabular-nums ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-[12rem] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search assignment, link, notes..."
              className="min-h-[40px] w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-4 text-sm text-white placeholder:text-white/30 focus:border-pink-500/50 focus:outline-none"
            />
          </div>
          <select
            value={modelFilter}
            onChange={(e) => setModelFilter(e.target.value)}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-pink-500/50 focus:outline-none"
          >
            <option value="all">All models</option>
            {modelOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-pink-500/50 focus:outline-none"
          >
            <option value="all">All status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-pink-500/50 focus:outline-none"
            aria-label="From date"
          />
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-pink-500/50 focus:outline-none"
            aria-label="To date"
          />
        </div>
        <p className="mt-2 text-xs text-white/30">
          Showing {filtered.length} of {rows.length}
        </p>
      </div>

      <div className="grid min-h-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-h-0 min-w-0 space-y-2 overflow-y-auto">
          {filtered.map((r) => (
            <button
              type="button"
              key={r.id}
              onClick={() => setSelectedId(r.id)}
              className={`w-full cursor-pointer rounded-2xl border p-4 text-left transition-all hover:bg-white/[0.08] ${
                selectedId === r.id ? "border-pink-500/40 bg-pink-500/5" : "border-white/10 bg-white/5"
              }`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-xs font-medium uppercase text-white/60">
                    Expense
                  </span>
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${listStatusBadge(r.status)}`}>
                    {r.status}
                  </span>
                </div>
                <span className="shrink-0 text-xs text-white/30">{timeAgo(r.created_at)}</span>
              </div>
              <p className="text-sm font-semibold text-white">{r.assignment_title || "Assignment"}</p>
              <p className="mt-1 truncate text-xs text-white/40">
                {modelNameById[r.model_id] || r.model_id} · {r.airbnb_link || "—"}
              </p>
            </button>
          ))}
          {filtered.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-white/15 py-12 text-center text-sm text-white/45">No matching requests.</p>
          ) : null}
        </div>

        {selected ? (
          <aside className="sticky top-4 max-h-[calc(100vh-200px)] min-h-0 min-w-0 w-full self-start overflow-y-auto rounded-2xl border border-white/10 bg-white/5">
            <div className="p-5">
            <div className="mb-4 flex items-start justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-xs font-medium uppercase text-white/60">
                  Expense
                </span>
                <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${listStatusBadge(selected.status)}`}>
                  {selected.status}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="text-white/30 transition hover:text-white"
                aria-label="Close panel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <h2 className="mb-1 text-lg font-bold text-white">{selected.assignment_title || "Assignment"}</h2>

            <div className="mb-4 flex flex-wrap items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-pink-500/20 text-xs font-bold text-pink-400">
                {(modelNameById[selected.model_id] || "M").slice(0, 1).toUpperCase()}
              </div>
              <span className="text-sm text-white/60">{modelNameById[selected.model_id] || selected.model_id}</span>
              <span className="text-xs text-white/30">{formatDateTimeEuropean(selected.created_at)}</span>
            </div>

            <div className="mb-4 space-y-3">
              <div className="min-w-0 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
                <p className="mb-1 text-xs uppercase tracking-widest text-white/40">Link</p>
                <a
                  href={selected.airbnb_link}
                  target="_blank"
                  rel="noreferrer"
                  className="block max-w-full min-w-0 break-all text-sm text-blue-400 underline-offset-2 hover:text-blue-300 hover:underline"
                >
                  {selected.airbnb_link}
                </a>
              </div>
              {selected.notes ? (
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
                  <p className="mb-1 text-xs uppercase tracking-widest text-white/40">Model notes</p>
                  <p className="whitespace-pre-wrap text-sm text-white/80">{selected.notes}</p>
                </div>
              ) : null}
            </div>

            <div className="mb-4">
              <p className="mb-2 text-xs uppercase tracking-widest text-white/40">Admin notes</p>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Add internal note…"
                className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/20 focus:border-pink-500/50 focus:outline-none"
              />
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveNotesOnly()}
                className="mt-2 text-xs font-medium text-pink-400 hover:text-pink-300 disabled:opacity-50"
              >
                Save notes
              </button>
            </div>

            {selected.status === "pending" ? (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void patch("approved")}
                  className="w-full rounded-xl border border-green-500/30 bg-green-500/20 py-2.5 text-sm font-semibold text-green-400 hover:bg-green-500/30 disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void patch("rejected")}
                  className="w-full rounded-xl border border-red-500/30 bg-red-500/20 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-500/30 disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <span className="text-xs text-white/40">Status:</span>
                <span className={`text-sm font-semibold capitalize ${readOnlyStatusClass(selected.status)}`}>
                  {selected.status}
                </span>
              </div>
            )}
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
