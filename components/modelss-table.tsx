"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ModelRecord } from "@/types";
import { ROUTES } from "@/lib/routes";
import { toggleModelStatus, deleteModelAction } from "@/app/actions/modelss";

export function ModelssTable({ modelss }: { modelss: ModelRecord[] }) {
  const router = useRouter();
  const [togglingId, setTogglingId] = React.useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  async function handleToggle(e: React.FormEvent<HTMLFormElement>, recordId: string) {
    e.preventDefault();
    if (!recordId) return;
    setTogglingId(recordId);
    try {
      await toggleModelStatus(recordId);
      router.refresh();
    } finally {
      setTogglingId(null);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteConfirmId) return;
    setDeletingId(deleteConfirmId);
    try {
      await deleteModelAction(deleteConfirmId);
    } finally {
      setDeletingId(null);
      setDeleteConfirmId(null);
    }
  }

  return (
    <>
      {/* Delete confirmation modal */}
      {deleteConfirmId != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-model-title">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0f0f0f] p-6 shadow-xl" style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.06)" }}>
            <h2 id="delete-model-title" className="text-lg font-semibold text-white">Delete model?</h2>
            <p className="mt-2 text-sm text-white/70">This action cannot be undone.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                disabled={deletingId !== null}
                className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/80 hover:bg-white/10 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deletingId !== null}
                className="rounded-xl bg-red-600/90 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
              >
                {deletingId ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile: stacked cards */}
      <div className="space-y-4 md:hidden">
        {modelss.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-white/50">No modelss yet. Create one below.</p>
        ) : (
          modelss.map((m) => (
            <div
              key={m.id}
              className="rounded-2xl border border-white/10 bg-white/[0.06] p-4"
              style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.04)" }}
            >
              <p className="text-base font-semibold text-white/95">{m.model_name}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-sm">
                <span className="capitalize text-white/80">Platform: {m.platform}</span>
                <span className="text-white/60">·</span>
                <span className={m.status === "active" ? "text-[hsl(330,90%,65%)]" : "text-white/60"}>{m.status || "—"}</span>
                <span className="text-white/60">·</span>
                <span className={m.current_status === "occupied" ? "text-amber-300" : "text-white/80"}>{m.current_status}</span>
                {m.current_status === "occupied" && m.current_chatter_name && (
                  <>
                    <span className="text-white/60">·</span>
                    <span className="text-white/80">Chatter: {m.current_chatter_name}</span>
                  </>
                )}
              </div>
              {m.priority && <p className="mt-1 text-sm text-white/60">Priority: {m.priority}</p>}
              {m.notes && <p className="mt-1 text-sm text-white/60 line-clamp-2">{m.notes}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={ROUTES.modelEdit(m.id)} className="min-h-[44px] rounded-xl bg-[hsl(330,80%,55%)]/20 px-4 py-2.5 text-sm font-medium text-[hsl(330,90%,65%)] hover:bg-[hsl(330,80%,55%)]/30">
                  Edit
                </Link>
                <form onSubmit={(e) => handleToggle(e, m.id)} className="inline-block">
                  <button
                    type="submit"
                    disabled={togglingId === m.id}
                    className="min-h-[44px] rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/70 hover:bg-white/10 disabled:opacity-50"
                  >
                    {togglingId === m.id ? "…" : m.status === "active" ? "Deactivate" : "Activate"}
                  </button>
                </form>
                <button
                  type="button"
                  onClick={() => setDeleteConfirmId(m.id)}
                  disabled={deletingId !== null}
                  className="min-h-[44px] rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-300 hover:bg-red-500/20 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      {/* Desktop: table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-white/60">
              <th className="p-3 font-medium">Model name</th>
              <th className="p-3 font-medium">Platform</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">Current status</th>
              <th className="p-3 font-medium">Current chatter</th>
              <th className="p-3 font-medium">Priority</th>
              <th className="max-w-[180px] p-3 font-medium">Notes</th>
              <th className="p-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {modelss.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-white/50">
                  No modelss yet. Create one below.
                </td>
              </tr>
            ) : (
              modelss.map((m) => (
                <tr key={m.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-3 font-medium text-white/90">{m.model_name}</td>
                  <td className="p-3 capitalize text-white/80">{m.platform}</td>
                  <td className="p-3">
                    <span className={m.status === "active" ? "text-[hsl(330,90%,65%)]" : "text-white/60"}>
                      {m.status || "—"}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={m.current_status === "occupied" ? "text-amber-300" : "text-white/80"}>
                      {m.current_status}
                    </span>
                  </td>
                  <td className="p-3 text-white/80">
                    {m.current_status === "occupied" && m.current_chatter_name
                      ? m.current_chatter_name
                      : "—"}
                  </td>
                  <td className="p-3 capitalize text-white/80">{m.priority || "—"}</td>
                  <td className="max-w-[180px] truncate p-3 text-white/60" title={m.notes || undefined}>
                    {m.notes || "—"}
                  </td>
                  <td className="p-3 text-right">
                    <span className="flex items-center justify-end gap-2">
                      <Link
                        href={ROUTES.modelEdit(m.id)}
                        className="rounded-lg px-2 py-1.5 text-xs font-medium text-[hsl(330,90%,65%)] hover:bg-white/10"
                      >
                        Edit
                      </Link>
                      <form onSubmit={(e) => handleToggle(e, m.id)} className="inline-block">
                        <button
                          type="submit"
                          disabled={togglingId === m.id}
                          className="rounded-lg px-2 py-1.5 text-xs font-medium text-white/70 hover:bg-white/10 disabled:opacity-50"
                        >
                          {togglingId === m.id ? "…" : m.status === "active" ? "Deactivate" : "Activate"}
                        </button>
                      </form>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(m.id)}
                        disabled={deletingId !== null}
                        className="rounded-lg px-2 py-1.5 text-xs font-medium text-red-300/90 hover:bg-red-500/20 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
