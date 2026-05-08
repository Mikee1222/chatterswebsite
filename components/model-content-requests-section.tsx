"use client";

import * as React from "react";
import { AnimatePresence } from "framer-motion";
import { FilePlus2, Loader2 } from "lucide-react";
import { GlassModal } from "@/components/ui/glass-modal";
import type { ModelContentRequest, ModelContentRequestType } from "@/types";

type Props = {
  initialRequests: ModelContentRequest[];
};

const TYPE_OPTIONS: { value: ModelContentRequestType; label: string }[] = [
  { value: "script", label: "Script" },
  { value: "mass", label: "Mass" },
  { value: "photo_set", label: "Photo set" },
  { value: "video", label: "Video" },
  { value: "other", label: "Other" },
];

function statusUi(status: ModelContentRequest["status"]) {
  if (status === "pending") return { label: "Waiting for review", cls: "border-amber-500/30 bg-amber-500/15 text-amber-300" };
  if (status === "approved") return { label: "Approved", cls: "border-green-500/30 bg-green-500/15 text-green-300" };
  if (status === "rejected") return { label: "Declined", cls: "border-red-500/30 bg-red-500/15 text-red-300" };
  if (status === "in_progress") return { label: "In progress", cls: "border-blue-500/30 bg-blue-500/15 text-blue-300" };
  return { label: "Completed", cls: "border-green-500/30 bg-green-500/15 text-green-300" };
}

export function ModelContentRequestsSection({ initialRequests }: Props) {
  const [rows, setRows] = React.useState<ModelContentRequest[]>(initialRequests);
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [type, setType] = React.useState<ModelContentRequestType>("script");
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError("Title and description are required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/model/content-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, title: title.trim(), description: description.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; record?: ModelContentRequest };
      if (!res.ok || !data.record) {
        setError(data.error ?? "Failed to submit request.");
        return;
      }
      setRows((prev) => [data.record!, ...prev]);
      setOpen(false);
      setTitle("");
      setDescription("");
      setType("script");
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-white/10 bg-black/35 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white/70">My requests</h2>
          <p className="mt-1 text-xs text-white/45">Request scripts or mass content and track status.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-pink-500/30 bg-pink-500/15 px-3 py-2 text-sm font-medium text-pink-200 hover:bg-pink-500/20"
        >
          <FilePlus2 className="h-4 w-4" />
          Request content
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/50">
          No content requests yet.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const ui = statusUi(r.status);
            return (
              <article key={r.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[11px] text-white/70">
                    {r.type.replace("_", " ")}
                  </span>
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] ${ui.cls}`}>{ui.label}</span>
                  <span className="ml-auto text-[11px] text-white/35">{(r.created_at || "").slice(0, 16).replace("T", " ")}</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-white">{r.title || "(untitled)"}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-white/70">{r.description}</p>
                {r.admin_notes ? (
                  <p className="mt-2 rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs text-white/60">
                    Admin note: {r.admin_notes}
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {open ? (
          <GlassModal onClose={() => (busy ? undefined : setOpen(false))} title="Request content">
            <form onSubmit={onSubmit} className="space-y-3 p-4">
              <label className="block text-xs font-semibold uppercase tracking-widest text-white/40">
                Type
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as ModelContentRequestType)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                >
                  {TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-semibold uppercase tracking-widest text-white/40">
                Title
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-widest text-white/40">
                Description
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                />
              </label>
              {error ? <p className="text-sm text-red-300">{error}</p> : null}
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/70"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-lg border border-pink-500/30 bg-pink-500/20 px-3 py-2 text-sm font-medium text-pink-100 disabled:opacity-60"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Submit request
                </button>
              </div>
            </form>
          </GlassModal>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
