"use client";

import * as React from "react";
import { formatDateTimeEuropean, displayName } from "@/lib/format";
import { CUSTOM_REQUEST_PRIORITY_OPTIONS, CUSTOM_REQUEST_TYPE_OPTIONS } from "@/lib/airtable-options";
import { listAllModelss } from "@/services/modelss";
import type { CustomRequest } from "@/types";

function label(value: string | undefined): string {
  return value ? value.replace(/_/g, "") : "—";
}

const TYPE_SET = new Set<string>([...CUSTOM_REQUEST_TYPE_OPTIONS]);
const PRIORITY_SET = new Set<string>([...CUSTOM_REQUEST_PRIORITY_OPTIONS]);

/** Custom type: prefer explicit field; else treat request_title as type when it matches known types (create path stores type there). */
function displayCustomType(req: CustomRequest): string {
  if (req.custom_type) return label(req.custom_type);
  const t = (req.request_title ?? "").trim();
  if (t && TYPE_SET.has(t)) return label(t);
  if (t) return label(t);
  return "—";
}

/** Priority when persisted on the record; otherwise "—" (legacy creates did not write priority to Airtable). */
function displayPriority(req: CustomRequest): string {
  const p = req.priority;
  if (p && PRIORITY_SET.has(p)) return label(p);
  return "—";
}

/** Status: use workflow fields mapped from Airtable (not legacy `status`, which is never set). */
function displayStatus(req: CustomRequest): string {
  const admin = label(req.admin_status);
  const model = label(req.model_status);
  if (admin === "—" && model === "—") return "—";
  if (admin === "—") return model;
  if (model === "—") return admin;
  return `${admin} · ${model}`;
}

/** Display whale name: prefer whale_username, then whale_name, then fan_username; never show raw ids. */
function displayWhale(req: CustomRequest): string {
  const a = displayName(req.whale_username, "");
  const b = displayName(req.whale_name, "");
  const c = displayName(req.fan_username, "");
  return a || b || c || "Unknown whale";
}

function displayModelName(
  req: CustomRequest,
  modelIdToName: Record<string, string>
): string {
  const fromMap = req.assigned_model_id ? modelIdToName[req.assigned_model_id] : "";
  const n = displayName(fromMap || req.assigned_model_name || req.model_name, "");
  return n || "—";
}

export function CustomRequestHistory({ requests }: { requests: CustomRequest[] }) {
  const [modelIdToName, setModelIdToName] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    let cancelled = false;
    listAllModelss()
      .then((models) => {
        if (cancelled) return;
        const map: Record<string, string> = {};
        for (const m of models) {
          if (m.id) map[m.id] = m.model_name ?? "";
        }
        setModelIdToName(map);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="glass-card overflow-hidden">
      <div className="border-b border-white/10 px-5 py-4">
        <h2 className="text-base font-semibold text-white">Previous requests</h2>
        <p className="mt-0.5 text-xs text-white/50">Your custom requests</p>
      </div>
      <div className="max-h-[480px] min-w-0 overflow-y-auto overflow-x-auto">
        {requests.length === 0 ? (
          <div className="p-8 text-center text-sm text-white/50">No requests yet</div>
        ) : (
          <table className="w-full min-w-[760px] table-fixed text-sm">
            <colgroup>
              <col className="w-[14%]" />
              <col className="w-[12%]" />
              <col className="w-[12%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[18%]" />
              <col className="w-[24%]" />
            </colgroup>
            <thead className="sticky top-0 z-10 border-b border-white/10 bg-black/60 text-left text-xs font-medium uppercase tracking-wider text-white/50">
              <tr>
                <th className="p-2 pl-3">Whale</th>
                <th className="p-2">Model</th>
                <th className="p-2">Custom type</th>
                <th className="p-2">Price</th>
                <th className="p-2">Priority</th>
                <th className="p-2">Status</th>
                <th className="p-2 pr-3 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {requests.map((req) => (
                <tr key={req.id} className="hover:bg-white/[0.03]">
                  <td className="truncate p-2 pl-3 font-medium text-white/90" title={displayWhale(req)}>
                    {displayWhale(req)}
                  </td>
                  <td className="truncate p-2 text-white/80" title={displayModelName(req, modelIdToName)}>
                    {displayModelName(req, modelIdToName)}
                  </td>
                  <td className="truncate p-2 text-white/75" title={displayCustomType(req)}>
                    {displayCustomType(req)}
                  </td>
                  <td className="truncate p-2 text-white/80">{req.price || "—"}</td>
                  <td className="truncate p-2 text-white/75">{displayPriority(req)}</td>
                  <td className="truncate p-2 text-white/75" title={displayStatus(req)}>
                    {displayStatus(req)}
                  </td>
                  <td className="whitespace-nowrap p-2 pr-3 text-right text-xs tabular-nums text-white/60">
                    {formatDateTimeEuropean(req.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
