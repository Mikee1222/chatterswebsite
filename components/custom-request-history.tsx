"use client";

import * as React from "react";
import { Inbox } from "lucide-react";
import { formatDateTimeEuropean, displayName } from "@/lib/format";
import { listAllModelss } from "@/services/modelss";
import {
  CustomRequestStatusBadge,
  displayCustomRequestPrice,
  displayCustomRequestTitle,
} from "@/components/custom-request-ui";
import { ReviewEmptyState } from "@/components/manager-review-ui";
import { VA_CARD, VA_CARD_GLOW } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";
import type { CustomRequest } from "@/types";

function displayWhale(req: CustomRequest): string {
  const a = displayName(req.whale_username, "");
  const b = displayName(req.whale_name, "");
  const c = displayName(req.fan_username, "");
  return a || b || c || "Unknown fan";
}

function displayModelName(req: CustomRequest, modelIdToName: Record<string, string>): string {
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
    <div className={cn(VA_CARD, VA_CARD_GLOW, "overflow-hidden")}>
      <div className="border-b border-white/10 px-5 py-4">
        <h2 className="text-base font-semibold text-white">Your requests</h2>
        <p className="mt-0.5 text-xs text-white/50">Same status language as admin and model views</p>
      </div>
      {requests.length === 0 ? (
        <ReviewEmptyState
          icon={Inbox}
          title="No requests yet"
          description="Submit a custom and it will appear here as Pending until the agency accepts it."
          className="border-0 shadow-none"
        />
      ) : (
        <ul className="divide-y divide-white/5">
          {requests.map((req) => (
            <li key={req.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white" title={displayCustomRequestTitle(req)}>
                  {displayCustomRequestTitle(req)}
                </p>
                <p className="mt-0.5 truncate text-xs text-white/50">
                  {displayWhale(req)} · {displayModelName(req, modelIdToName)} · {displayCustomRequestPrice(req)}
                </p>
                <p className="mt-0.5 text-[11px] tabular-nums text-white/35">
                  {formatDateTimeEuropean(req.created_at)}
                </p>
              </div>
              <CustomRequestStatusBadge request={req} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
