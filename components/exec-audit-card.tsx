"use client";

import { Trash2 } from "lucide-react";
import { VA_CARD, VA_FILTER_INPUT } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";
import type { UserRecord } from "@/types";

export type ExecAuditDraft = {
  id?: string;
  exec_va_id: string;
  exec_va_name: string;
  phase1_on_time: boolean;
  phase2_on_time: boolean;
  screenshots_authentic: boolean;
  posting_compliance: boolean;
  engagement_looks_real: boolean;
  issues_found: string;
  actions_taken: string;
};

export const EXEC_AUDIT_COMPLIANCE_FIELDS: Array<{ key: keyof ExecAuditDraft; label: string }> = [
  { key: "phase1_on_time", label: "Phase 1 on time" },
  { key: "phase2_on_time", label: "Phase 2 on time" },
  { key: "screenshots_authentic", label: "Screenshots authentic" },
  { key: "posting_compliance", label: "Posting compliance" },
  { key: "engagement_looks_real", label: "Engagement looks real" },
];

export function emptyExecAuditDraft(): ExecAuditDraft {
  return {
    exec_va_id: "",
    exec_va_name: "",
    phase1_on_time: false,
    phase2_on_time: false,
    screenshots_authentic: false,
    posting_compliance: false,
    engagement_looks_real: false,
    issues_found: "",
    actions_taken: "",
  };
}

type Props = {
  audit: ExecAuditDraft;
  index: number;
  marketingVas: UserRecord[];
  readOnly?: boolean;
  onChange?: (patch: Partial<ExecAuditDraft>) => void;
  onDelete?: () => void;
};

export function ExecAuditCard({ audit, index, marketingVas, readOnly, onChange, onDelete }: Props) {
  return (
    <div className={cn(VA_CARD, "space-y-4 p-4")}>
      <div className="flex items-start justify-between gap-2">
        {readOnly ? (
          <p className="font-medium text-white">{audit.exec_va_name || "—"}</p>
        ) : (
          <select
            value={audit.exec_va_id}
            onChange={(e) => {
              const va = marketingVas.find((v) => v.id === e.target.value);
              onChange?.({ exec_va_id: e.target.value, exec_va_name: va?.full_name ?? "" });
            }}
            className={cn(VA_FILTER_INPUT, "w-full max-w-sm")}
          >
            <option value="">Select VA</option>
            {marketingVas.map((v) => (
              <option key={v.id} value={v.id}>
                {v.full_name || v.email}
              </option>
            ))}
          </select>
        )}
        {!readOnly && onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg border border-red-500/30 p-2 text-red-400 hover:bg-red-500/10"
            aria-label={`Remove audit ${index + 1}`}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-3">
        {EXEC_AUDIT_COMPLIANCE_FIELDS.map(({ key, label }) => (
          <label key={key} className="inline-flex cursor-pointer items-center gap-2 text-sm text-[#B8B4B8]/80">
            <input
              type="checkbox"
              checked={Boolean(audit[key])}
              disabled={readOnly}
              onChange={(e) => onChange?.({ [key]: e.target.checked })}
              className="rounded border-white/20 bg-transparent text-[#FF1493] focus:ring-[#FF1493]/30 disabled:opacity-60"
            />
            {label}
          </label>
        ))}
      </div>
      {readOnly ? (
        <>
          {audit.issues_found ? (
            <p className="text-sm text-[#B8B4B8]/70">
              <span className="text-[#B8B4B8]/45">Issues: </span>
              {audit.issues_found}
            </p>
          ) : null}
          {audit.actions_taken ? (
            <p className="text-sm text-[#D4AF8C]/70">
              <span className="text-[#B8B4B8]/45">Actions: </span>
              {audit.actions_taken}
            </p>
          ) : null}
        </>
      ) : (
        <>
          <textarea
            placeholder="Issues found"
            value={audit.issues_found}
            onChange={(e) => onChange?.({ issues_found: e.target.value })}
            rows={2}
            className={cn(VA_FILTER_INPUT, "w-full resize-y py-2")}
          />
          <textarea
            placeholder="Actions taken"
            value={audit.actions_taken}
            onChange={(e) => onChange?.({ actions_taken: e.target.value })}
            rows={2}
            className={cn(VA_FILTER_INPUT, "w-full resize-y py-2")}
          />
        </>
      )}
    </div>
  );
}
