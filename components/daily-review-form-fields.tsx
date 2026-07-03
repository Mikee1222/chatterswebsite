"use client";

import { Check } from "lucide-react";
import { COMPLIANCE_VS_MASTER, DAILY_REVIEW_KPIS } from "@/lib/marketing-reviews-helpers";
import { VA_CHAMPAGNE_DIVIDER, VA_FILTER_INPUT, VA_MODEL_TAG } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";
import type { UserRecord } from "@/types";

export type DailyReviewFormState = {
  kpis: string[];
  compliance: string[];
  topPerformerId: string;
  issues: string;
  actions: string;
  timeSpent: string;
};

type Props = {
  state: DailyReviewFormState;
  marketingVas: UserRecord[];
  managerName?: string;
  reviewLabel?: string;
  readOnly?: boolean;
  showAttachments?: boolean;
  attachFiles?: File[];
  onToggleKpi?: (kpi: string) => void;
  onToggleCompliance?: (item: string) => void;
  onChange?: (patch: Partial<DailyReviewFormState>) => void;
  onAttachFiles?: (files: File[]) => void;
};

export function DailyReviewFormFields({
  state,
  marketingVas,
  managerName,
  reviewLabel,
  readOnly,
  showAttachments,
  attachFiles = [],
  onToggleKpi,
  onToggleCompliance,
  onChange,
  onAttachFiles,
}: Props) {
  return (
    <div className="space-y-5">
      {reviewLabel ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-white">{reviewLabel}</h2>
            {managerName ? <span className={VA_MODEL_TAG}>{managerName}</span> : null}
          </div>
          <div className={VA_CHAMPAGNE_DIVIDER} />
        </>
      ) : null}

      <div>
        <p className="mb-3 text-sm font-medium text-[#D4AF8C]">KPIs reviewed</p>
        <div className="flex flex-wrap gap-2">
          {DAILY_REVIEW_KPIS.map((kpi) => {
            const on = state.kpis.includes(kpi);
            if (readOnly) {
              if (!on) return null;
              return (
                <span
                  key={kpi}
                  className="rounded-lg border border-[#FF1493]/40 bg-[#FF1493]/15 px-3 py-2 text-xs text-[#FFB3D9]"
                >
                  <Check className="mb-0.5 inline h-3 w-3" aria-hidden /> {kpi}
                </span>
              );
            }
            return (
              <button
                key={kpi}
                type="button"
                onClick={() => onToggleKpi?.(kpi)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left text-xs transition",
                  on
                    ? "border-[#FF1493]/40 bg-[#FF1493]/15 text-[#FFB3D9] shadow-[0_0_10px_rgba(255,20,147,0.2)]"
                    : "border-white/8 bg-white/3 text-[#B8B4B8]/60 hover:border-[#D4AF8C]/30",
                )}
              >
                {on ? <Check className="mb-0.5 inline h-3 w-3" aria-hidden /> : null} {kpi}
              </button>
            );
          })}
          {readOnly && state.kpis.length === 0 ? (
            <p className="text-sm text-[#B8B4B8]/50">None selected</p>
          ) : null}
        </div>
      </div>

      <div>
        <p className="mb-3 text-sm font-medium text-[#D4AF8C]">Account compliance vs master</p>
        <div className="flex flex-wrap gap-2">
          {COMPLIANCE_VS_MASTER.map((item) => {
            const on = state.compliance.includes(item);
            if (readOnly) {
              if (!on) return null;
              return (
                <span
                  key={item}
                  className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300"
                >
                  <Check className="mb-0.5 inline h-3 w-3" aria-hidden /> {item}
                </span>
              );
            }
            return (
              <button
                key={item}
                type="button"
                onClick={() => onToggleCompliance?.(item)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left text-xs transition",
                  on
                    ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                    : "border-white/8 bg-white/3 text-[#B8B4B8]/60 hover:border-[#D4AF8C]/30",
                )}
              >
                {on ? <Check className="mb-0.5 inline h-3 w-3" aria-hidden /> : null} {item}
              </button>
            );
          })}
          {readOnly && state.compliance.length === 0 ? (
            <p className="text-sm text-[#B8B4B8]/50">None selected</p>
          ) : null}
        </div>
      </div>

      {readOnly ? (
        <>
          {state.topPerformerId ? (
            <p className="text-sm text-[#B8B4B8]/70">
              <span className="text-[#B8B4B8]/45">Top performer: </span>
              {marketingVas.find((v) => v.id === state.topPerformerId)?.full_name ?? "—"}
            </p>
          ) : null}
          {state.issues ? (
            <p className="text-sm text-[#B8B4B8]/70">
              <span className="text-[#B8B4B8]/45">Issues: </span>
              {state.issues}
            </p>
          ) : null}
          {state.actions ? (
            <p className="text-sm text-[#D4AF8C]/70">
              <span className="text-[#B8B4B8]/45">Actions: </span>
              {state.actions}
            </p>
          ) : null}
          {state.timeSpent ? (
            <p className="text-sm text-[#B8B4B8]/50">{state.timeSpent} min spent</p>
          ) : null}
        </>
      ) : (
        <>
          <label className="block space-y-1.5 text-sm">
            <span className="text-[#B8B4B8]/60">Top performer VA</span>
            <select
              value={state.topPerformerId}
              onChange={(e) => onChange?.({ topPerformerId: e.target.value })}
              className={cn(VA_FILTER_INPUT, "w-full max-w-md")}
            >
              <option value="">—</option>
              {marketingVas.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.full_name || v.email}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="text-[#B8B4B8]/60">Issues found</span>
            <textarea
              value={state.issues}
              onChange={(e) => onChange?.({ issues: e.target.value })}
              rows={3}
              className={cn(VA_FILTER_INPUT, "w-full resize-y py-2")}
            />
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="text-[#B8B4B8]/60">Actions assigned</span>
            <textarea
              value={state.actions}
              onChange={(e) => onChange?.({ actions: e.target.value })}
              rows={2}
              className={cn(VA_FILTER_INPUT, "w-full resize-y py-2")}
            />
          </label>
          <label className="block max-w-xs space-y-1.5 text-sm">
            <span className="text-[#B8B4B8]/60">Time spent (minutes)</span>
            <input
              type="number"
              min={0}
              value={state.timeSpent}
              onChange={(e) => onChange?.({ timeSpent: e.target.value })}
              className={VA_FILTER_INPUT}
            />
          </label>
          {showAttachments ? (
            <label className="block space-y-1.5 text-sm">
              <span className="text-[#B8B4B8]/60">Attachments</span>
              <input
                type="file"
                multiple
                accept="image/*,.pdf"
                onChange={(e) => onAttachFiles?.(Array.from(e.target.files ?? []))}
                className="block w-full text-sm text-[#B8B4B8]/60 file:mr-3 file:rounded-lg file:border-0 file:bg-[#FF1493]/20 file:px-3 file:py-1.5 file:text-sm file:text-[#FFB3D9]"
              />
              {attachFiles.length > 0 ? (
                <p className="text-xs text-[#B8B4B8]/45">{attachFiles.length} file(s) selected</p>
              ) : null}
            </label>
          ) : null}
        </>
      )}
    </div>
  );
}
