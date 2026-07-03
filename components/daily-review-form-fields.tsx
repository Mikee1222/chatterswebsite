"use client";

import * as React from "react";
import {
  DashPlaceholder,
  ManagerReviewFileDropzone,
  ManagerReviewSelect,
  ManagerReviewTextarea,
  ReviewFieldLabel,
  ReviewSectionHeader,
  TogglePill,
  VA_CHAMPAGNE_DIVIDER,
  VA_MODEL_TAG,
  type CustomSelectOption,
} from "@/components/manager-review-ui";
import { COMPLIANCE_VS_MASTER, DAILY_REVIEW_KPIS } from "@/lib/marketing-reviews-helpers";
import { VA_FILTER_INPUT } from "@/lib/va-tasks-tokens";
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
  const vaOptions = React.useMemo<CustomSelectOption[]>(
    () => [
      { value: "", label: "—" },
      ...marketingVas.map((v) => ({ value: v.id, label: v.full_name || v.email || "—" })),
    ],
    [marketingVas],
  );

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
        <ReviewSectionHeader className="mb-3">KPIs reviewed</ReviewSectionHeader>
        <div className="flex flex-wrap gap-2">
          {DAILY_REVIEW_KPIS.map((kpi) => (
            <TogglePill
              key={kpi}
              label={kpi}
              variant="kpi"
              selected={state.kpis.includes(kpi)}
              readOnly={readOnly}
              onClick={() => onToggleKpi?.(kpi)}
            />
          ))}
          {readOnly && state.kpis.length === 0 ? (
            <p className="text-sm text-[#B8B4B8]/45">None selected</p>
          ) : null}
        </div>
      </div>

      <div>
        <ReviewSectionHeader className="mb-3">Account compliance vs master</ReviewSectionHeader>
        <div className="flex flex-wrap gap-2">
          {COMPLIANCE_VS_MASTER.map((item) => (
            <TogglePill
              key={item}
              label={item}
              variant="compliance"
              selected={state.compliance.includes(item)}
              readOnly={readOnly}
              onClick={() => onToggleCompliance?.(item)}
            />
          ))}
          {readOnly && state.compliance.length === 0 ? (
            <p className="text-sm text-[#B8B4B8]/45">None selected</p>
          ) : null}
        </div>
      </div>

      {readOnly ? (
        <>
          {state.topPerformerId ? (
            <p className="text-sm text-[#B8B4B8]/70">
              <span className="text-[#B8B4B8]/45">Top performer: </span>
              {marketingVas.find((v) => v.id === state.topPerformerId)?.full_name ?? <DashPlaceholder />}
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
            <ReviewFieldLabel>Top performer VA</ReviewFieldLabel>
            <ManagerReviewSelect
              value={state.topPerformerId}
              onChange={(v) => onChange?.({ topPerformerId: v })}
              options={vaOptions}
              className="w-full max-w-md"
            />
          </label>
          <label className="block space-y-1.5 text-sm">
            <ReviewFieldLabel>Issues found</ReviewFieldLabel>
            <ManagerReviewTextarea
              value={state.issues}
              onChange={(e) => onChange?.({ issues: e.target.value })}
              rows={3}
            />
          </label>
          <label className="block space-y-1.5 text-sm">
            <ReviewFieldLabel>Actions assigned</ReviewFieldLabel>
            <ManagerReviewTextarea
              value={state.actions}
              onChange={(e) => onChange?.({ actions: e.target.value })}
              rows={2}
            />
          </label>
          <label className="block max-w-xs space-y-1.5 text-sm">
            <ReviewFieldLabel>Time spent (minutes)</ReviewFieldLabel>
            <input
              type="number"
              min={0}
              value={state.timeSpent}
              onChange={(e) => onChange?.({ timeSpent: e.target.value })}
              className={VA_FILTER_INPUT}
            />
          </label>
          {showAttachments ? (
            <div className="block space-y-1.5 text-sm">
              <ReviewFieldLabel>Attachments</ReviewFieldLabel>
              <ManagerReviewFileDropzone files={attachFiles} onChange={(files) => onAttachFiles?.(files)} />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
