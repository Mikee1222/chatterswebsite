"use client";

import * as React from "react";
import { CalendarClock, Inbox, MessageSquare } from "lucide-react";
import { formatDateTimeEuropean, displayName } from "@/lib/format";
import { listAllModelss } from "@/services/modelss";
import { CustomRequestDetailModal } from "@/components/custom-request-detail-modal";
import {
  CustomRequestStatusBadge,
  customRequestTypeBadgeClass,
  customRequestTypeLabel,
  displayCustomRequestDeadline,
  displayCustomRequestDescription,
  displayCustomRequestPrice,
  displayCustomRequestTitle,
  resolveCustomRequestType,
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

function formatCardDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return formatDateTimeEuropean(iso) || "—";
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${date} at ${time}`;
}

const cardClass = cn(
  "rounded-xl border border-white/[0.08] bg-zinc-950/80",
  "shadow-[0_4px_24px_-8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)]"
);

/**
 * Chatter-facing history: same fields/detail as the admin Custom Requests cards,
 * strictly read-only (no accept/reject/edit/delete controls).
 */
export function CustomRequestHistory({ requests }: { requests: CustomRequest[] }) {
  const [modelIdToName, setModelIdToName] = React.useState<Record<string, string>>({});
  const [detail, setDetail] = React.useState<CustomRequest | null>(null);

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
        <p className="mt-0.5 text-xs text-white/50">
          Same detail as admin — status, description, deadline, and notes. Read-only.
        </p>
      </div>
      {requests.length === 0 ? (
        <ReviewEmptyState
          icon={Inbox}
          title="No requests yet"
          description="Submit a custom and it will appear here as Pending until the agency accepts it."
          className="border-0 shadow-none"
        />
      ) : (
        <ul className="space-y-3 p-4">
          {requests.map((req) => {
            const desc = displayCustomRequestDescription(req);
            const type = resolveCustomRequestType(req);
            const isRejected = req.admin_status === "rejected";
            const hasAdminNote = Boolean(req.admin_notes?.trim());
            const modelName = displayModelName(req, modelIdToName);

            return (
              <li key={req.id}>
                <article
                  className={cn(cardClass, "cursor-pointer p-4 transition-all duration-200 hover:border-white/15")}
                  onClick={() => setDetail(req)}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
                          customRequestTypeBadgeClass(type)
                        )}
                      >
                        {customRequestTypeLabel(type)}
                      </span>
                      <CustomRequestStatusBadge request={req} />
                    </div>
                    <span className="text-sm font-medium tabular-nums text-white/90">
                      {displayCustomRequestPrice(req)}
                    </span>
                  </div>

                  <div className="mt-3 min-w-0">
                    <p className="truncate text-sm font-semibold text-white" title={displayCustomRequestTitle(req)}>
                      {displayCustomRequestTitle(req)}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <p className="text-sm font-medium text-white/90">@{displayWhale(req)}</p>
                      <span className="inline-flex rounded-full border border-pink-500/30 bg-pink-500/10 px-2 py-0.5 text-[11px] font-medium text-pink-200">
                        {modelName}
                      </span>
                    </div>
                  </div>

                  {desc ? (
                    <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-white/60">{desc}</p>
                  ) : null}

                  {isRejected && req.decline_reason?.trim() ? (
                    <div className="mt-3 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2">
                      <p className="text-[11px] font-medium text-rose-300">Decline reason</p>
                      <p className="mt-0.5 text-xs text-white/55">{req.decline_reason}</p>
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/[0.06] pt-3 text-[11px] text-white/45">
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="h-3 w-3 shrink-0" aria-hidden />
                      Due {displayCustomRequestDeadline(req)}
                    </span>
                    <span>{formatCardDateTime(req.created_at)}</span>
                    {hasAdminNote ? (
                      <span className="inline-flex items-center gap-1 text-amber-300/80" title={req.admin_notes}>
                        <MessageSquare className="h-3 w-3 shrink-0" aria-hidden />
                        Admin note
                      </span>
                    ) : null}
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}

      <CustomRequestDetailModal
        open={detail != null}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
        request={detail}
        language="en"
        variant="agency"
        modelById={modelIdToName}
      >
        {detail?.decline_reason?.trim() ? (
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs font-medium text-white/45">Decline reason</p>
            <p className="mt-2 text-sm text-white/80">{detail.decline_reason}</p>
          </section>
        ) : null}
        {detail?.admin_notes?.trim() ? (
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs font-medium text-white/45">Admin note</p>
            <p className="mt-2 text-sm text-white/80">{detail.admin_notes}</p>
          </section>
        ) : null}
        {detail?.model_notes?.trim() ? (
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs font-medium text-white/45">Model note</p>
            <p className="mt-2 text-sm text-white/80">{detail.model_notes}</p>
          </section>
        ) : null}
      </CustomRequestDetailModal>
    </div>
  );
}
