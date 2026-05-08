"use client";

import * as React from "react";
import { Search } from "lucide-react";
import type { ModelContentRequest, ModelContentRequestStatus, ModelContentRequestType } from "@/types";

type Props = {
  initialRows: ModelContentRequest[];
  modelNameById: Record<string, string>;
};

function statusBadge(status: ModelContentRequestStatus): string {
  if (status === "pending") return "border-amber-500/30 bg-amber-500/15 text-amber-300";
  if (status === "approved") return "border-green-500/30 bg-green-500/15 text-green-300";
  if (status === "rejected") return "border-red-500/30 bg-red-500/15 text-red-300";
  if (status === "in_progress") return "border-blue-500/30 bg-blue-500/15 text-blue-300";
  return "border-emerald-500/30 bg-emerald-500/15 text-emerald-300";
}

export function AdminModelContentRequestsClient({ initialRows, modelNameById }: Props) {
  const [rows, setRows] = React.useState<ModelContentRequest[]>(initialRows);
  const [selectedId, setSelectedId] = React.useState<string | null>(initialRows[0]?.id ?? null);
  const [search, setSearch] = React.useState("");
  const [modelFilter, setModelFilter] = React.useState("all");
  const [typeFilter, setTypeFilter] = React.useState<"all" | ModelContentRequestType>("all");
  const [statusFilter, setStatusFilter] = React.useState<"all" | ModelContentRequestStatus>("pending");
  const [saving, setSaving] = React.useState(false);
  const [noteDraft, setNoteDraft] = React.useState("");

  const modelOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      if (!r.model_id) continue;
      map.set(r.model_id, modelNameById[r.model_id] || r.model_id);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows, modelNameById]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (modelFilter !== "all" && r.model_id !== modelFilter) return false;
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return `${r.title} ${r.description} ${modelNameById[r.model_id] || ""}`.toLowerCase().includes(q);
    });
  }, [rows, modelFilter, typeFilter, statusFilter, search, modelNameById]);

  const selected = rows.find((r) => r.id === selectedId) ?? null;
  React.useEffect(() => {
    setNoteDraft(selected?.admin_notes ?? "");
  }, [selectedId, selected?.admin_notes]);

  async function changeStatus(status: ModelContentRequestStatus) {
    if (!selected) return;
    setSaving(true);
    const prev = rows;
    setRows((p) => p.map((r) => (r.id === selected.id ? { ...r, status, admin_notes: noteDraft } : r)));
    try {
      const res = await fetch(`/api/admin/content-requests/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          admin_notes: noteDraft,
          title: selected.title,
          model_id: selected.model_id,
        }),
      });
      if (!res.ok) throw new Error("Failed to update request");
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
          <h1 className="text-2xl font-semibold text-white">Model content requests</h1>
          <p className="mt-1 text-sm text-white/55">Review and approve content requests from models.</p>
        </header>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="relative xl:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search title, model, description..."
                className="w-full rounded-xl border border-white/10 bg-black/40 py-2 pl-9 pr-3 text-sm text-white"
              />
            </div>
            <select value={modelFilter} onChange={(e) => setModelFilter(e.target.value)} className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white">
              <option value="all">All models</option>
              {modelOptions.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)} className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white">
              <option value="all">All types</option>
              <option value="script">Script</option>
              <option value="mass">Mass</option>
              <option value="photo_set">Photo set</option>
              <option value="video">Video</option>
              <option value="other">Other</option>
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white">
              <option value="all">All status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <p className="mt-3 text-xs text-white/50">Showing {filtered.length} of {rows.length} requests</p>
        </div>
        <div className="space-y-2">
          {filtered.map((r) => (
            <article
              key={r.id}
              onClick={() => setSelectedId(r.id)}
              className={`cursor-pointer rounded-2xl border p-4 ${selectedId === r.id ? "border-pink-500/40 bg-pink-500/5" : "border-white/10 bg-white/5 hover:bg-white/[0.08]"}`}
            >
              <div className="flex items-center gap-2 text-xs">
                <span className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-white/75">{r.type.replace("_", " ")}</span>
                <span className={`rounded-full border px-2 py-0.5 ${statusBadge(r.status)}`}>{r.status}</span>
                <span className="ml-auto text-white/35">{(r.created_at || "").slice(0, 16).replace("T", " ")}</span>
              </div>
              <p className="mt-2 text-sm font-semibold text-white">{r.title || "(untitled)"}</p>
              <p className="mt-1 line-clamp-2 text-sm text-white/65">{r.description}</p>
              <p className="mt-2 text-xs text-white/45">Model: {modelNameById[r.model_id] || r.model_id}</p>
            </article>
          ))}
        </div>
      </section>
      {selected ? (
        <aside className="sticky top-4 h-fit w-full rounded-2xl border border-white/10 bg-[#0f1018] p-4 lg:w-96">
          <h2 className="text-lg font-semibold text-white">{selected.title || "(untitled)"}</h2>
          <p className="mt-1 text-xs text-white/45">Model: {modelNameById[selected.model_id] || selected.model_id}</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-white/75">{selected.description}</p>
          <div className="mt-3">
            <label className="text-xs uppercase tracking-wide text-white/45">Admin notes</label>
            <textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} rows={4} className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button disabled={saving} onClick={() => void changeStatus("approved")} className="rounded-lg border border-green-500/30 bg-green-500/15 px-3 py-1 text-xs text-green-300">Approve</button>
            <button disabled={saving} onClick={() => void changeStatus("rejected")} className="rounded-lg border border-red-500/30 bg-red-500/15 px-3 py-1 text-xs text-red-300">Reject</button>
            <button disabled={saving} onClick={() => void changeStatus("in_progress")} className="rounded-lg border border-blue-500/30 bg-blue-500/15 px-3 py-1 text-xs text-blue-300">In progress</button>
            <button disabled={saving} onClick={() => void changeStatus("completed")} className="rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-3 py-1 text-xs text-emerald-300">Completed</button>
          </div>
        </aside>
      ) : null}
    </div>
  );
}
