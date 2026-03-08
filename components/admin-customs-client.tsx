"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { updateCustomStatusAction } from "@/app/actions/customs";
import { formatDateTimeEuropean } from "@/lib/format";
import { Select, selectOptionClass } from "@/components/ui/form";
import type { CustomRequest, CustomRequestStatus } from "@/types";

const STATUS_OPTIONS: CustomRequestStatus[] = [
  "pending",
  "accepted",
  "recording",
  "completed",
  "delivered",
  "cancelled",
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
  const [requests, setRequests] = React.useState(initialRequests);
  const [updatingId, setUpdatingId] = React.useState<string | null>(null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  React.useEffect(() => setRequests(initialRequests), [initialRequests]);

  const handleStatusChange = async (recordId: string, status: CustomRequestStatus) => {
    setUpdatingId(recordId);
    try {
      const res = await updateCustomStatusAction(recordId, status);
      if (res.success) {
        setRequests((prev) => prev.map((r) => (r.id === recordId ? { ...r, status } : r)));
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
                  onChange={(e) => handleStatusChange(req.id, e.target.value as CustomRequestStatus)}
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
              <th className="p-3 font-medium w-24">Copy</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {requests.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-white/50">No custom requests</td>
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
                      onChange={(e) => handleStatusChange(req.id, e.target.value as CustomRequestStatus)}
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
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
