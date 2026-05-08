"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Power, Trash2 } from "lucide-react";
import type { ModelRecord } from "@/types";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AdminRowAvatar, RecordStatusBadge } from "@/components/admin-list-primitives";
import { toggleModelStatus, deleteModelAction } from "@/app/actions/modelss";

export function ModelssTable({ modelss }: { modelss: ModelRecord[] }) {
  const router = useRouter();
  const [togglingId, setTogglingId] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<{ id: string; name: string } | null>(null);
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
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.id);
    try {
      await deleteModelAction(deleteTarget.id);
    } finally {
      setDeletingId(null);
      setDeleteTarget(null);
    }
  }

  return (
    <>
      <ConfirmDialog
        open={deleteTarget != null}
        onClose={() => deletingId == null && setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Delete model?"
        description={`This will permanently delete "${deleteTarget?.name ?? ""}" and all linked data. This cannot be undone.`}
        confirmLabel="Delete permanently"
        confirmVariant="danger"
        loading={deletingId !== null}
        requireNameConfirmation
        nameToConfirm={deleteTarget?.name ?? ""}
      />

      {/* Mobile: stacked cards */}
      <div className="space-y-4 md:hidden">
        {modelss.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-white/50">No modelss yet. Create one below.</p>
        ) : (
          modelss.map((m) => (
            <div
              key={m.id}
              className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 transition-[border-color,box-shadow] hover:border-pink-500/20 hover:shadow-[0_12px_40px_-28px_rgba(236,72,153,0.18)]"
              style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.04)" }}
            >
              <div className="flex items-start gap-3">
                <AdminRowAvatar name={m.model_name || "?"} />
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-white/95">{m.model_name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/55">
                      {m.platform}
                    </span>
                    <RecordStatusBadge status={m.status} />
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                <span className={m.current_status === "occupied" ? "text-amber-300" : "text-emerald-300/90"}>{m.current_status}</span>
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
                <Link
                  href={ROUTES.modelEdit(m.id)}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[hsl(330,80%,55%)]/20 px-4 py-2.5 text-sm font-medium text-[hsl(330,90%,65%)] hover:bg-[hsl(330,80%,55%)]/30"
                >
                  <Pencil className="h-4 w-4" aria-hidden />
                  Edit
                </Link>
                <form onSubmit={(e) => handleToggle(e, m.id)} className="inline-block">
                  <button
                    type="submit"
                    disabled={togglingId === m.id}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/70 hover:bg-white/10 disabled:opacity-50"
                  >
                    <Power className="h-4 w-4" aria-hidden />
                    {togglingId === m.id ? "…" : m.status === "active" ? "Deactivate" : "Activate"}
                  </button>
                </form>
                <button
                  type="button"
                  onClick={() =>
                    setDeleteTarget({
                      id: m.id,
                      name: m.model_name?.trim() || m.model_id?.trim() || "Model",
                    })
                  }
                  disabled={deletingId !== null}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-300 hover:bg-red-500/20 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      {/* Desktop: table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-gradient-to-r from-black/55 via-black/45 to-pink-950/15 text-left text-xs font-medium uppercase tracking-wider text-white/50">
              <th className="p-3.5 font-medium">Model name</th>
              <th className="p-3.5 font-medium">Platform</th>
              <th className="p-3.5 font-medium">Status</th>
              <th className="p-3.5 font-medium">Current status</th>
              <th className="p-3.5 font-medium">Current chatter</th>
              <th className="p-3.5 font-medium">Priority</th>
              <th className="max-w-[180px] p-3.5 font-medium">Notes</th>
              <th className="p-3.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {modelss.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-white/50">
                  No modelss yet. Create one below.
                </td>
              </tr>
            ) : (
              modelss.map((m) => (
                <tr
                  key={m.id}
                  className={cn(
                    "group transition-[background-color,box-shadow] duration-200",
                    "hover:bg-gradient-to-r hover:from-white/[0.04] hover:to-pink-500/[0.03] hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
                  )}
                >
                  <td className="p-3.5">
                    <div className="flex items-center gap-3">
                      <AdminRowAvatar name={m.model_name || "?"} size="sm" className="ring-1 ring-white/10" />
                      <span className="font-semibold text-white/92">{m.model_name}</span>
                    </div>
                  </td>
                  <td className="p-3.5 capitalize text-white/80">{m.platform}</td>
                  <td className="p-3.5">
                    <RecordStatusBadge status={m.status} />
                  </td>
                  <td className="p-3.5">
                    <span
                      className={cn(
                        "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize",
                        m.current_status === "occupied"
                          ? "border-amber-500/30 bg-amber-500/12 text-amber-200"
                          : "border-emerald-500/30 bg-emerald-500/12 text-emerald-200"
                      )}
                    >
                      {m.current_status}
                    </span>
                  </td>
                  <td className="p-3.5 text-white/80">
                    {m.current_status === "occupied" && m.current_chatter_name
                      ? m.current_chatter_name
                      : "—"}
                  </td>
                  <td className="p-3.5 capitalize text-white/80">{m.priority || "—"}</td>
                  <td className="max-w-[180px] truncate p-3.5 text-white/60" title={m.notes || undefined}>
                    {m.notes || "—"}
                  </td>
                  <td className="p-3.5 text-right">
                    <div className="inline-flex items-center justify-end gap-0.5 rounded-xl border border-white/[0.08] bg-black/25 p-0.5 opacity-90 transition-opacity group-hover:opacity-100">
                      <Link
                        href={ROUTES.modelEdit(m.id)}
                        className="rounded-lg p-2 text-white/55 hover:bg-pink-500/15 hover:text-pink-200"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" aria-hidden />
                      </Link>
                      <form onSubmit={(e) => handleToggle(e, m.id)} className="inline-flex">
                        <button
                          type="submit"
                          disabled={togglingId === m.id}
                          className="rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white/85 disabled:opacity-50"
                          title={m.status === "active" ? "Deactivate" : "Activate"}
                        >
                          <Power className="h-4 w-4" aria-hidden />
                        </button>
                      </form>
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteTarget({
                            id: m.id,
                            name: m.model_name?.trim() || m.model_id?.trim() || "Model",
                          })
                        }
                        disabled={deletingId !== null}
                        className="rounded-lg p-2 text-white/45 hover:bg-red-500/15 hover:text-red-300 disabled:opacity-50"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
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
