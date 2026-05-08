"use client";

import * as React from "react";
import { CheckCircle2, Search, X } from "lucide-react";
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

function statusColor(status: string): string {
  if (status === "new") return "border-blue-500/25 bg-blue-500/15 text-blue-300";
  if (status === "in_review") return "border-amber-500/25 bg-amber-500/15 text-amber-300";
  if (status === "resolved") return "border-green-500/25 bg-green-500/15 text-green-300";
  return "border-white/20 bg-white/10 text-white/70";
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

  const selected = rows.find((r) => r.id === selectedId) ?? null;
  const hasActiveFilters = Boolean(search || type !== "all" || status !== "all" || role !== "all" || fromDate || toDate);

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

  const total = rows.length;
  const totalNew = rows.filter((r) => r.status === "new").length;
  const totalBug = rows.filter((r) => r.type === "bug").length;
  const totalSuggestion = rows.filter((r) => r.type === "suggestion").length;

  return (
    <div className="flex gap-6 max-lg:flex-col">
      <section className="min-w-0 flex-1 space-y-4">
        <header>
          <h1 className="text-2xl font-semibold text-white">Feedback</h1>
          <p className="mt-1 text-sm text-white/55">Bug reports and suggestions from your team</p>
        </header>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Total", total],
            ["New", totalNew],
            ["Bugs", totalBug],
            ["Suggestions", totalSuggestion],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs text-white/50">{label}</p>
              <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div className="relative xl:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search feedback..."
                className="w-full rounded-xl border border-white/10 bg-black/40 py-2 pl-9 pr-3 text-sm text-white"
              />
            </div>
            <select value={type} onChange={(e) => setType(e.target.value as "all" | Type)} className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white">
              <option value="all">All types</option>
              <option value="bug">Bug</option>
              <option value="suggestion">Suggestion</option>
              <option value="other">Other</option>
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value as "all" | Status)} className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white">
              <option value="all">All status</option>
              <option value="new">New</option>
              <option value="in_review">In review</option>
              <option value="resolved">Resolved</option>
              <option value="wont_fix">Won't fix</option>
            </select>
            <select value={role} onChange={(e) => setRole(e.target.value as typeof role)} className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white">
              <option value="all">All roles</option>
              <option value="chatter">Chatter</option>
              <option value="virtual_assistant">VA</option>
              <option value="model">Model</option>
              <option value="admin">Admin</option>
            </select>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white" />
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white" />
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setType("all");
                  setStatus("all");
                  setRole("all");
                  setFromDate("");
                  setToDate("");
                }}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10"
              >
                Clear filters
              </button>
            ) : <span />}
            <p className="text-xs text-white/50">Showing {filtered.length} of {rows.length}</p>
          </div>
        </div>

        <div className="space-y-2">
          {filtered.map((r) => (
            <article
              key={r.id}
              className={`cursor-pointer rounded-2xl border p-4 transition ${
                selectedId === r.id ? "border-pink-500/40 bg-pink-500/5" : "border-white/10 bg-white/5 hover:bg-white/[0.08]"
              }`}
              onClick={() => setSelectedId(r.id)}
            >
              <div className="flex items-center gap-2 text-xs">
                <span className={`rounded-full border px-2 py-0.5 ${typeColor(r.type)}`}>{r.type}</span>
                <span className={`rounded-full border px-2 py-0.5 ${statusColor(r.status)}`}>{r.status}</span>
                <span className="ml-auto text-white/30">{timeAgo(r.created_at)}</span>
              </div>
              <p className="mt-2 text-sm font-semibold text-white">{r.title || "(untitled)"}</p>
              <div className="mt-2 flex items-center gap-2 text-xs">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-[10px] font-semibold text-white/70">
                  {(r.user_name || "U").slice(0, 2).toUpperCase()}
                </div>
                <span className="text-white/75">{r.user_name}</span>
                <span className={`rounded-full border px-2 py-0.5 ${roleColor(r.user_role)}`}>{r.user_role}</span>
                <span className="truncate text-white/40">{r.page || "—"}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      {selected ? (
        <>
          <button
            type="button"
            aria-label="Close details"
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setSelectedId(null)}
          />
          <aside className="fixed inset-x-3 bottom-3 top-20 z-50 overflow-y-auto rounded-2xl border border-white/10 bg-[#0f1018] p-4 lg:sticky lg:inset-auto lg:z-auto lg:w-96 lg:self-start lg:overflow-visible">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className={`rounded-full border px-2 py-0.5 text-xs ${typeColor(selected.type)}`}>{selected.type}</span>
              <select
                value={selected.status}
                onChange={(e) => void patchFeedback(selected.id, { status: e.target.value as Status })}
                className="rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-xs text-white"
              >
                <option value="new">new</option>
                <option value="in_review">in_review</option>
                <option value="resolved">resolved</option>
                <option value="wont_fix">wont_fix</option>
              </select>
            </div>
            <button type="button" onClick={() => setSelectedId(null)} className="rounded-lg border border-white/10 bg-white/5 p-1 text-white/60 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>

          <h2 className="text-xl font-bold text-white">{selected.title || "(untitled)"}</h2>
          <div className="mt-3 flex items-center gap-2 text-xs text-white/60">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold text-white/75">
              {(selected.user_name || "U").slice(0, 2).toUpperCase()}
            </div>
            <span>{selected.user_name}</span>
            <span className={`rounded-full border px-2 py-0.5 ${roleColor(selected.user_role)}`}>{selected.user_role}</span>
          </div>
          <p className="mt-2 text-xs text-white/40">{formatDateTimeEuropean(selected.created_at)}</p>
          <p className="mt-1 text-xs text-white/45">Page: {selected.page || "—"}</p>

          <hr className="my-4 border-white/10" />
          <p className="text-[11px] uppercase tracking-wide text-white/45">Description</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-white/80">{selected.description || "—"}</p>

          {selected.screenshots.length > 0 ? (
            <div className="mt-4">
              <p className="text-[11px] uppercase tracking-wide text-white/45">Screenshots</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {selected.screenshots.map((s, i) => (
                  <a
                    key={`${s.id ?? i}`}
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="overflow-hidden rounded-xl border border-white/10 bg-white/5"
                  >
                    {s.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.url} alt={s.filename || "screenshot"} className="h-24 w-full object-cover" />
                    ) : (
                      <div className="flex h-24 items-center justify-center text-xs text-white/40">No preview</div>
                    )}
                  </a>
                ))}
              </div>
            </div>
          ) : null}

          <hr className="my-4 border-white/10" />
          <p className="text-[11px] uppercase tracking-wide text-white/45">Admin notes</p>
          <textarea
            value={selected.admin_notes}
            onChange={(e) => setRows((prev) => prev.map((r) => (r.id === selected.id ? { ...r, admin_notes: e.target.value } : r)))}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
            rows={4}
          />
          <button
            type="button"
            disabled={saving}
            onClick={() => void patchFeedback(selected.id, { admin_notes: selected.admin_notes })}
            className="mt-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save notes"}
          </button>

          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => void patchFeedback(selected.id, { status: "in_review" })} className="rounded-lg border border-amber-500/30 bg-amber-500/15 px-3 py-1 text-xs text-amber-300">Mark in review</button>
            <button type="button" onClick={() => void patchFeedback(selected.id, { status: "resolved" })} className="rounded-lg border border-green-500/30 bg-green-500/15 px-3 py-1 text-xs text-green-300">Mark resolved</button>
            <button type="button" onClick={() => void patchFeedback(selected.id, { status: "wont_fix" })} className="rounded-lg border border-white/25 bg-white/10 px-3 py-1 text-xs text-white/75">Won't fix</button>
          </div>

          {selected.status === "resolved" ? (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-green-500/25 bg-green-500/10 px-3 py-2 text-xs text-green-300">
              <CheckCircle2 className="h-4 w-4" />
              Marked as resolved
            </div>
          ) : null}
          </aside>
        </>
      ) : null}
    </div>
  );
}

