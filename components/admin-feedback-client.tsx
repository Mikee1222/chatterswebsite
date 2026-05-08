"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { formatDateTimeEuropean } from "@/lib/format";

export type AdminFeedbackRow = {
  id: string;
  feedback_id: string;
  user_id: string;
  user_name: string;
  user_role: string;
  type: string;
  page: string;
  title: string;
  description: string;
  screenshots: Array<{ id?: string; url?: string; filename?: string }>;
  status: string;
  admin_notes: string;
  created_at: string;
};

type Status = "new" | "in_review" | "resolved" | "wont_fix";
type Type = "bug" | "suggestion" | "other";

function roleColor(role: string): string {
  if (role === "chatter") return "border-pink-500/30 bg-pink-500/15 text-pink-300";
  if (role === "virtual_assistant") return "border-purple-500/30 bg-purple-500/15 text-purple-300";
  if (role === "model") return "border-rose-500/30 bg-rose-500/15 text-rose-300";
  return "border-white/20 bg-white/10 text-white/75";
}

function typeColor(type: string): string {
  if (type === "bug") return "border-red-500/25 bg-red-500/15 text-red-300";
  if (type === "suggestion") return "border-amber-500/25 bg-amber-500/15 text-amber-300";
  return "border-sky-500/25 bg-sky-500/15 text-sky-300";
}

function listFeedbackStatusBadge(status: string): string {
  if (status === "resolved") return "bg-green-500/15 border-green-500/25 text-green-400";
  if (status === "wont_fix") return "bg-red-500/15 border-red-500/25 text-red-400";
  if (status === "in_review") return "bg-blue-500/15 border-blue-500/25 text-blue-400";
  return "bg-amber-500/15 border-amber-500/25 text-amber-400";
}

function readOnlyFeedbackStatusClass(status: string): string {
  if (status === "resolved") return "text-green-400";
  if (status === "wont_fix") return "text-red-400";
  if (status === "in_review") return "text-blue-400";
  return "text-amber-400";
}

function humanStatus(status: string): string {
  if (status === "wont_fix") return "Won't fix";
  return status.replace(/_/g, " ");
}

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "Unknown";
  const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

export function AdminFeedbackClient({ initialRows }: { initialRows: AdminFeedbackRow[] }) {
  const [rows, setRows] = React.useState<AdminFeedbackRow[]>(initialRows);
  const [selectedId, setSelectedId] = React.useState<string | null>(initialRows[0]?.id ?? null);
  const [search, setSearch] = React.useState("");
  const [type, setType] = React.useState<"all" | Type>("all");
  const [status, setStatus] = React.useState<"all" | Status>("all");
  const [role, setRole] = React.useState<"all" | "chatter" | "virtual_assistant" | "model" | "admin">("all");
  const [fromDate, setFromDate] = React.useState("");
  const [toDate, setToDate] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (type !== "all" && r.type !== type) return false;
      if (status !== "all" && r.status !== status) return false;
      if (role !== "all" && r.user_role !== role) return false;
      if (fromDate) {
        const d = (r.created_at || "").slice(0, 10);
        if (!d || d < fromDate) return false;
      }
      if (toDate) {
        const d = (r.created_at || "").slice(0, 10);
        if (!d || d > toDate) return false;
      }
      if (!q) return true;
      return `${r.title} ${r.user_name} ${r.description}`.toLowerCase().includes(q);
    });
  }, [rows, search, type, status, role, fromDate, toDate]);

  const stats = React.useMemo(() => {
    const pending = rows.filter((r) => r.status === "new" || r.status === "in_review").length;
    const resolved = rows.filter((r) => r.status === "resolved").length;
    const rejected = rows.filter((r) => r.status === "wont_fix").length;
    return { total: rows.length, pending, resolved, rejected };
  }, [rows]);

  const selected = rows.find((r) => r.id === selectedId) ?? null;

  async function patchFeedback(id: string, payload: Partial<Pick<AdminFeedbackRow, "status" | "admin_notes">>) {
    setSaving(true);
    const previous = rows;
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...payload } : r)));
    try {
      const res = await fetch(`/api/feedback/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to update feedback");
    } catch {
      setRows(previous);
    } finally {
      setSaving(false);
    }
  }

  const hasActiveFilters = Boolean(
    search || type !== "all" || status !== "all" || role !== "all" || fromDate || toDate
  );

  function clearFilters() {
    setSearch("");
    setType("all");
    setStatus("all");
    setRole("all");
    setFromDate("");
    setToDate("");
  }

  const isPendingNewActions = selected?.status === "new";

  return (
    <div>
      <div className="mb-6">
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-white/40">Administration</p>
        <h1 className="text-3xl font-bold text-white">Feedback</h1>
        <p className="mt-1 text-sm text-white/50">Bug reports and suggestions from your team</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total", value: stats.total, color: "text-white" },
          { label: "Pending", value: stats.pending, color: "text-amber-400" },
          { label: "Resolved", value: stats.resolved, color: "text-green-400" },
          { label: "Won't fix", value: stats.rejected, color: "text-red-400" },
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
              placeholder="Search…"
              className="min-h-[40px] w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-4 text-sm text-white placeholder:text-white/30 focus:border-pink-500/50 focus:outline-none"
            />
          </div>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as "all" | Type)}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-pink-500/50 focus:outline-none"
          >
            <option value="all">All types</option>
            <option value="bug">Bug</option>
            <option value="suggestion">Suggestion</option>
            <option value="other">Other</option>
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as "all" | Status)}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-pink-500/50 focus:outline-none"
          >
            <option value="all">All status</option>
            <option value="new">New</option>
            <option value="in_review">In review</option>
            <option value="resolved">Resolved</option>
            <option value="wont_fix">Won't fix</option>
          </select>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as typeof role)}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-pink-500/50 focus:outline-none"
          >
            <option value="all">All roles</option>
            <option value="chatter">Chatter</option>
            <option value="virtual_assistant">VA</option>
            <option value="model">Model</option>
            <option value="admin">Admin</option>
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
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-white/30">
            Showing {filtered.length} of {rows.length}
          </p>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10"
            >
              Clear filters
            </button>
          ) : (
            <span />
          )}
        </div>
      </div>

      <div className="relative">
        {selected ? (
          <button
            type="button"
            aria-label="Close details"
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setSelectedId(null)}
          />
        ) : null}
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
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium uppercase ${typeColor(r.type)}`}>
                    {r.type}
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs font-medium ${listFeedbackStatusBadge(r.status)}`}
                  >
                    {humanStatus(r.status)}
                  </span>
                </div>
                <span className="shrink-0 text-xs text-white/30">{timeAgo(r.created_at)}</span>
              </div>
              <p className="text-sm font-semibold text-white">{r.title || "(untitled)"}</p>
              <p className="mt-1 text-xs text-white/40">
                {r.user_name} · {(r.page || "—").slice(0, 80)}
              </p>
            </button>
          ))}
          {filtered.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-white/15 py-12 text-center text-sm text-white/45">
              No matching feedback.
            </p>
          ) : null}
        </div>

        {selected ? (
            <aside className="fixed inset-x-3 bottom-3 top-20 z-50 max-h-[calc(100vh-200px)] min-h-0 min-w-0 overflow-y-auto rounded-2xl border border-white/10 bg-white/5 lg:sticky lg:inset-auto lg:top-4 lg:z-auto lg:h-auto lg:w-full lg:max-w-none lg:self-start">
              <div className="p-5">
              <div className="mb-4 flex items-start justify-between gap-2">
                <div className="flex flex-wrap gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium uppercase ${typeColor(selected.type)}`}>
                    {selected.type}
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs font-medium ${listFeedbackStatusBadge(selected.status)}`}
                  >
                    {humanStatus(selected.status)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="text-white/30 hover:text-white"
                  aria-label="Close panel"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <h2 className="mb-1 text-lg font-bold text-white">{selected.title || "(untitled)"}</h2>

              <div className="mb-4 flex flex-wrap items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-pink-500/20 text-xs font-bold text-pink-400">
                  {(selected.user_name?.trim() || "U").slice(0, 1).toUpperCase()}
                </div>
                <span className="text-sm text-white/60">{selected.user_name}</span>
                <span className={`rounded-full border px-2 py-0.5 text-xs ${roleColor(selected.user_role)}`}>
                  {selected.user_role}
                </span>
                <span className="text-xs text-white/30">{formatDateTimeEuropean(selected.created_at)}</span>
              </div>

              <div className="mb-4 space-y-3">
                <div className="min-w-0 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
                  <p className="mb-1 text-xs uppercase tracking-widest text-white/40">Page</p>
                  <p className="break-all text-sm text-white/80">{selected.page || "—"}</p>
                </div>
                <div className="min-w-0 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
                  <p className="mb-1 text-xs uppercase tracking-widest text-white/40">Details</p>
                  <p className="break-words whitespace-pre-wrap text-sm text-white/80">{selected.description || "—"}</p>
                </div>
                {selected.screenshots.length > 0 ? (
                  <div>
                    <p className="mb-2 text-xs uppercase tracking-widest text-white/40">Screenshot</p>
                    <div className="grid gap-2">
                      {selected.screenshots.map((s, i) =>
                        s.url ? (
                          <a
                            key={`${s.id ?? i}`}
                            href={s.url}
                            target="_blank"
                            rel="noreferrer"
                            className="block overflow-hidden rounded-xl border border-white/10"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={s.url} alt={s.filename || "screenshot"} className="max-h-48 w-full object-cover" />
                          </a>
                        ) : null
                      )}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="mb-4">
                <p className="mb-2 text-xs uppercase tracking-widest text-white/40">Admin notes</p>
                <textarea
                  value={selected.admin_notes}
                  onChange={(e) =>
                    setRows((prev) => prev.map((r) => (r.id === selected.id ? { ...r, admin_notes: e.target.value } : r)))
                  }
                  rows={3}
                  placeholder="Add internal note…"
                  className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/20 focus:border-pink-500/50 focus:outline-none"
                />
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void patchFeedback(selected.id, { admin_notes: selected.admin_notes })}
                  className="mt-2 text-xs font-medium text-pink-400 hover:text-pink-300 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save notes"}
                </button>
              </div>

              {isPendingNewActions ? (
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void patchFeedback(selected.id, { status: "in_review" })}
                    className="w-full rounded-xl border border-blue-500/30 bg-blue-500/20 py-2.5 text-sm font-semibold text-blue-400 hover:bg-blue-500/30 disabled:opacity-50"
                  >
                    Mark in review
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void patchFeedback(selected.id, { status: "resolved" })}
                    className="w-full rounded-xl border border-green-500/30 bg-green-500/20 py-2.5 text-sm font-semibold text-green-400 hover:bg-green-500/30 disabled:opacity-50"
                  >
                    Mark resolved
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void patchFeedback(selected.id, { status: "wont_fix" })}
                    className="w-full rounded-xl border border-white/25 bg-white/10 py-2.5 text-sm font-semibold text-white/80 hover:bg-white/15 disabled:opacity-50"
                  >
                    Won't fix
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <span className="text-xs text-white/40">Status:</span>
                  <span className={`text-sm font-semibold capitalize ${readOnlyFeedbackStatusClass(selected.status)}`}>
                    {humanStatus(selected.status)}
                  </span>
                </div>
              )}
              </div>
            </aside>
        ) : null}
        </div>
      </div>
    </div>
  );
}
