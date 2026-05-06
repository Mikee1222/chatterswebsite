"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { VaContentAssignmentRecord } from "@/types";
import { cn } from "@/lib/utils";

export type AdminVaContentAssignmentDTO = VaContentAssignmentRecord & {
  va_name: string;
  model_name: string;
};

export type AdminVaContentClientProps = {
  rows: AdminVaContentAssignmentDTO[];
  vaOptions: { id: string; full_name: string; status: string }[];
  modelOptions: { id: string; model_name: string }[];
};

function statusKey(s: string): string {
  return (s || "").trim().toLowerCase();
}

export function AdminVaContentClient({ rows }: AdminVaContentClientProps) {
  const router = useRouter();
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const onRemind = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/va-content/remind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignment_id: id }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        alert(data.error ?? "Remind failed");
        return;
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  const onCancel = async (id: string) => {
    const reason = window.prompt("Cancellation reason (min 3 characters):")?.trim();
    if (!reason || reason.length < 3) return;
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/va-content/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignment_id: id, reason }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        alert(data.error ?? "Cancel failed");
        return;
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  const visible = rows.filter((r) => statusKey(r.status) !== "cancelled");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">VA content assignments</h1>
        <p className="mt-1 text-sm text-white/60">Remind models or cancel assignments from the agency side.</p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-white/10">
        <table className="w-full text-left text-sm text-white/90">
          <thead className="border-b border-white/10 bg-white/[0.04] text-white/65">
            <tr>
              <th className="px-4 py-3 font-medium">VA</th>
              <th className="px-4 py-3 font-medium">Model</th>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-white/55">
                  No active assignments.
                </td>
              </tr>
            ) : (
              visible.map((r) => (
                <tr key={r.id} className="border-b border-white/5">
                  <td className="px-4 py-3">{r.va_name}</td>
                  <td className="px-4 py-3">{r.model_name}</td>
                  <td className="px-4 py-3 font-medium">{r.title || "—"}</td>
                  <td className="px-4 py-3 capitalize">{statusKey(r.status) || "—"}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {(statusKey(r.status) === "pending" || statusKey(r.status) === "scheduled") && (
                      <>
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          className={cn(
                            "rounded-lg border border-white/15 px-3 py-1 text-xs font-medium hover:bg-white/10 disabled:opacity-50"
                          )}
                          onClick={() => void onRemind(r.id)}
                        >
                          Remind
                        </button>
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          className="rounded-lg border border-rose-500/40 px-3 py-1 text-xs font-medium text-rose-200 hover:bg-rose-500/15 disabled:opacity-50"
                          onClick={() => void onCancel(r.id)}
                        >
                          Cancel
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
