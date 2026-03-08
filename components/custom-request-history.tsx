"use client";

import { formatDateTimeEuropean, displayName } from "@/lib/format";
import type { CustomRequest } from "@/types";

function label(value: string): string {
  return value.replace(/_/g, " ");
}

/** Display whale name: prefer whale_username, then whale_name, then fan_username; never show raw ids. */
function displayWhale(req: CustomRequest): string {
  const a = displayName(req.whale_username, "");
  const b = displayName(req.whale_name, "");
  const c = displayName(req.fan_username, "");
  return a || b || c || "Unknown whale";
}

export function CustomRequestHistory({ requests }: { requests: CustomRequest[] }) {
  return (
    <div className="glass-card overflow-hidden">
      <div className="border-b border-white/10 px-5 py-4">
        <h2 className="text-base font-semibold text-white">Previous requests</h2>
        <p className="mt-0.5 text-xs text-white/50">Your custom requests</p>
      </div>
      <div className="max-h-[480px] overflow-y-auto">
        {requests.length === 0 ? (
          <div className="p-8 text-center text-sm text-white/50">No requests yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 border-b border-white/10 bg-black/60 text-left text-xs font-medium uppercase tracking-wider text-white/50">
              <tr>
                <th className="p-3">Whale</th>
                <th className="p-3">Model</th>
                <th className="p-3">Custom type</th>
                <th className="p-3">Price</th>
                <th className="p-3">Priority</th>
                <th className="p-3">Status</th>
                <th className="p-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {requests.map((req) => (
                <tr key={req.id} className="hover:bg-white/[0.03]">
                  <td className="p-3 font-medium text-white/90">{displayWhale(req)}</td>
                  <td className="p-3 text-white/80">{displayName(req.model_name)}</td>
                  <td className="p-3 text-white/75">{label(req.custom_type)}</td>
                  <td className="p-3 text-white/80">{req.price || "—"}</td>
                  <td className="p-3 text-white/75">{label(req.priority)}</td>
                  <td className="p-3 text-white/75">{label(req.status)}</td>
                  <td className="p-3 text-white/60">{formatDateTimeEuropean(req.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
