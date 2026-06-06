"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { updateCustomStatusAction } from "@/app/actions/customs";
import { ConfirmDeleteModal } from "@/components/confirm-delete-modal";
import { useToast } from "@/contexts/toast-context";
import { formatDateTimeEuropean } from "@/lib/format";
import { Select, selectOptionClass } from "@/components/ui/form";
import type { AppNotification, CustomRequest, CustomRequestAdminStatus } from "@/types";

function localToast(id: string, title: string, body: string, priority: "normal" | "high"): AppNotification {
  return {
    id,
    notification_id: id,
    user_id: "local",
    category: "system",
    event_type: "system_alert",
    priority,
    title,
    body,
    entity_type: "system",
    entity_id: "",
    read_at: null,
    created_at: new Date().toISOString(),
  };
}

const STATUS_OPTIONS: CustomRequestAdminStatus[] = [
  "pending",
  "accepted",
  "rejected",
];

type Props = {
  requests: CustomRequest[];
};

function copyFormattedBlock(req: CustomRequest): string {
  const lines = [
    `Model: ${req.model_name || "—"}`,
    `Fan: ${req.whale_username || req.fan_username || "—"}`,
    `Type: ${req.custom_type || "—"}`,
    `Price: ${req.price || "—"}`,
    `Priority: ${req.priority || "—"}`,
    `Status: ${req.status || "—"}`,
    "",
    req.description?.trim() || "(no description)",
  ];
  return lines.join("\n");
}

export function AdminCustomsClient({ requests: initialRequests }: Props) {
  const router = useRouter();
  const { addToast } = useToast();
  const [requests, setRequests] = React.useState(initialRequests);
  const [updatingId, setUpdatingId] = React.useState<string | null>(null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<CustomRequest | null>(null);
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);

  React.useEffect(() => setRequests(initialRequests), [initialRequests]);

  const handleStatusChange = async (recordId: string, status: CustomRequestAdminStatus) => {
    setUpdatingId(recordId);
    try {
      const res = await updateCustomStatusAction(recordId, status);
      if (res.success) {
        setRequests((prev) => prev.map((r) => (r.id === recordId ? { ...r, admin_status: status } : r)));
        router.refresh();
      }
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCopy = async (req: CustomRequest) => {
    const text = copyFormattedBlock(req);
    await navigator.clipboard.writeText(text);
    setCopiedId(req.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const confirmDeleteRequest = React.useCallback(async () => {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    setConfirmingDelete(true);
    try {
      const res = await fetch(`/api/custom-requests/${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        addToast(localToast(`ac-del-err-${Date.now()}`, "Could not delete", data.error ?? "Delete failed.", "high"));
        return;
      }
      setRequests((prev) => prev.filter((r) => r.id !== id));
      setPendingDelete(null);
      addToast(localToast(`ac-del-ok-${Date.now()}`, "Deleted", "Custom request removed.", "normal"));
      router.refresh();
    } catch {
      addToast(localToast(`ac-del-err-${Date.now()}`, "Could not delete", "Network error.", "high"));
    } finally {
      setConfirmingDelete(false);
    }
  }, [pendingDelete, addToast, router]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Customs</h1>
        <p className="mt-1 text-sm text-white/60">All custom requests. Change status inline. Copy formatted block.</p>
      </div>

      {/* Mobile: stacked cards */}
      <div className="space-y-4 md:hidden">
        {requests.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-white/50">No custom requests</p>
        ) : (
          requests.map((req) => (
            <div
              key={req.id}
              className="rounded-2xl border border-white/10 bg-white/[0.06] p-4"
              style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.04)" }}
            >
              <p className="text-base font-semibold text-white/95">{req.model_name || "—"}</p>
              <p className="mt-0.5 text-sm text-white/70">Whale / fan: {req.whale_username || req.fan_username || "—"}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-sm text-white/70">
                <span>Type: {req.custom_type || "—"}</span>
                <span className="text-white/50">·</span>
                <span>Price: {req.price || "—"}</span>
                <span className="text-white/50">·</span>
                <span>Priority: {req.priority || "—"}</span>
              </div>
              {req.description && <p className="mt-2 text-sm text-white/60 line-clamp-3">{req.description}</p>}
              <p className="mt-1 text-xs text-white/50">Created: {formatDateTimeEuropean(req.created_at)}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Select
                  value={req.status}
                  onChange={(e) => handleStatusChange(req.id, e.target.value as CustomRequestAdminStatus)}
                  disabled={updatingId === req.id}
                  className="min-h-[44px] min-w-[140px] flex-1 text-base"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s} className={selectOptionClass}>{s}</option>
                  ))}
                </Select>
                <button
                  type="button"
                  onClick={() => handleCopy(req)}
                  className="min-h-[44px] rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/90 hover:bg-white/10"
                >
                  {copiedId === req.id ? "Copied" : "Copy"}
                </button>
                <button
                  type="button"
                  disabled={confirmingDelete && pendingDelete?.id === req.id}
                  onClick={() => setPendingDelete(req)}
                  className="min-h-[44px] rounded-xl border border-red-500/35 px-4 py-2.5 text-sm font-medium text-red-300/90 hover:bg-red-500/10 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      {/* Desktop: table */}
      <div className="glass-card overflow-x-auto hidden md:block">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="border-b border-white/10 bg-black/40 text-left text-xs font-medium uppercase tracking-wider text-white/50">
            <tr>
              <th className="p-3 font-medium">Model</th>
              <th className="p-3 font-medium">Whale / fan</th>
              <th className="p-3 font-medium">Type</th>
              <th className="p-3 font-medium">Description</th>
              <th className="p-3 font-medium">Price</th>
              <th className="p-3 font-medium">Priority</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">Created</th>
              <th className="p-3 font-medium w-28">Copy</th>
              <th className="p-3 w-12"> </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {requests.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-8 text-center text-white/50">No custom requests</td>
              </tr>
            ) : (
              requests.map((req) => (
                <tr key={req.id} className="hover:bg-white/[0.03]">
                  <td className="p-3 font-medium text-white/90">{req.model_name || "—"}</td>
                  <td className="p-3 text-white/80">{req.whale_username || req.fan_username || "—"}</td>
                  <td className="p-3 text-white/70">{req.custom_type || "—"}</td>
                  <td className="p-3 text-white/70 max-w-[200px] truncate" title={req.description}>{req.description?.slice(0, 60) || "—"}{req.description && req.description.length > 60 ? "…" : ""}</td>
                  <td className="p-3 text-white/80">{req.price || "—"}</td>
                  <td className="p-3 text-white/70">{req.priority || "—"}</td>
                  <td className="p-3">
                    <Select
                      value={req.status}
                      onChange={(e) => handleStatusChange(req.id, e.target.value as CustomRequestAdminStatus)}
                      disabled={updatingId === req.id}
                      className="min-w-[120px] py-2 text-sm"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s} className={selectOptionClass}>{s}</option>
                      ))}
                    </Select>
                  </td>
                  <td className="p-3 text-white/60">{formatDateTimeEuropean(req.created_at)}</td>
                  <td className="p-3">
                    <button
                      type="button"
                      onClick={() => handleCopy(req)}
                      className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/90 hover:bg-white/10"
                    >
                      {copiedId === req.id ? "Copied" : "Copy"}
                    </button>
                  </td>
                  <td className="p-3">
                    <button
                      type="button"
                      disabled={confirmingDelete && pendingDelete?.id === req.id}
                      onClick={() => setPendingDelete(req)}
                      className="rounded-lg p-2 text-white/45 transition-colors hover:bg-red-500/15 hover:text-red-300 disabled:opacity-50"
                      title="Delete request"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDeleteModal
        open={pendingDelete != null}
        title="Delete custom request?"
        description={
          pendingDelete ? (
            <>
              Delete the request for{""}
              <span className="font-medium text-white">{pendingDelete.model_name || "—"}</span>? This action cannot be
              undone.
            </>
          ) : null
        }
        onClose={() => {
          if (!confirmingDelete) setPendingDelete(null);
        }}
        onConfirm={confirmDeleteRequest}
        confirming={confirmingDelete}
      />
    </div>
  );
}
