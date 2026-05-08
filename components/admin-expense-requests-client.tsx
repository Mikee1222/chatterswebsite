"use client";

import * as React from "react";
import { Search } from "lucide-react";
import type { ModelExpenseRequest } from "@/types";

type Props = {
  initialRows: ModelExpenseRequest[];
  modelNameById: Record<string, string>;
};

function statusClass(status: ModelExpenseRequest["status"]) {
  if (status === "pending") return "border-amber-500/30 bg-amber-500/15 text-amber-300";
  if (status === "approved") return "border-green-500/30 bg-green-500/15 text-green-300";
  return "border-red-500/30 bg-red-500/15 text-red-300";
}

export function AdminExpenseRequestsClient({ initialRows, modelNameById }: Props) {
  const [rows, setRows] = React.useState(initialRows);
  const [selectedId, setSelectedId] = React.useState<string | null>(initialRows[0]?.id ?? null);
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [modelFilter, setModelFilter] = React.useState("all");
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
      if (status !== "all" && r.status !== status) return false;
      if (modelFilter !== "all" && r.model_id !== modelFilter) return false;
      if (!q) return true;
      return `${r.assignment_title} ${r.airbnb_link} ${r.notes}`.toLowerCase().includes(q);
    });
  }, [rows, status, modelFilter, search]);

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

  return (
    <div className="flex gap-6 max-lg:flex-col">
      <section className="min-w-0 flex-1 space-y-4">
        <header>
          <h1 className="text-2xl font-semibold text-white">Expense requests</h1>
          <p className="mt-1 text-sm text-white/55">Airbnb requests from model VA content assignments.</p>
        </header>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="relative md:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search assignment, link, notes..." className="w-full rounded-xl border border-white/10 bg-black/40 py-2 pl-9 pr-3 text-sm text-white" />
            </div>
            <select value={modelFilter} onChange={(e) => setModelFilter(e.target.value)} className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white">
              <option value="all">All models</option>
              {modelOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white">
              <option value="all">All status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
        <div className="space-y-2">
          {filtered.map((r) => (
            <article key={r.id} onClick={() => setSelectedId(r.id)} className={`cursor-pointer rounded-2xl border p-4 ${selectedId === r.id ? "border-pink-500/40 bg-pink-500/5" : "border-white/10 bg-white/5 hover:bg-white/[0.08]"}`}>
              <div className="flex items-center gap-2 text-xs">
                <span className={`rounded-full border px-2 py-0.5 ${statusClass(r.status)}`}>{r.status}</span>
                <span className="ml-auto text-white/35">{(r.created_at || "").slice(0, 16).replace("T", " ")}</span>
              </div>
              <p className="mt-2 text-sm font-semibold text-white">{r.assignment_title || "Assignment"}</p>
              <a href={r.airbnb_link} target="_blank" rel="noreferrer" className="mt-1 block truncate text-xs text-pink-300 underline-offset-2 hover:underline">{r.airbnb_link}</a>
              <p className="mt-2 text-xs text-white/45">Model: {modelNameById[r.model_id] || r.model_id}</p>
            </article>
          ))}
        </div>
      </section>
      {selected ? (
        <aside className="sticky top-4 h-fit w-full rounded-2xl border border-white/10 bg-[#0f1018] p-4 lg:w-96">
          <h2 className="text-lg font-semibold text-white">{selected.assignment_title || "Assignment"}</h2>
          <p className="mt-1 text-xs text-white/45">Model: {modelNameById[selected.model_id] || selected.model_id}</p>
          <a href={selected.airbnb_link} target="_blank" rel="noreferrer" className="mt-2 block text-sm text-pink-300 underline-offset-2 hover:underline">{selected.airbnb_link}</a>
          {selected.notes ? <p className="mt-2 whitespace-pre-wrap text-sm text-white/70">{selected.notes}</p> : null}
          <div className="mt-3">
            <label className="text-xs uppercase tracking-wide text-white/45">Admin notes</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button disabled={saving} onClick={() => void patch("approved")} className="rounded-lg border border-green-500/30 bg-green-500/15 px-3 py-1 text-xs text-green-300">Approve</button>
            <button disabled={saving} onClick={() => void patch("rejected")} className="rounded-lg border border-red-500/30 bg-red-500/15 px-3 py-1 text-xs text-red-300">Reject</button>
          </div>
        </aside>
      ) : null}
    </div>
  );
}
