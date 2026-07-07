"use client";

import { Trash2 } from "lucide-react";
import {
  DashPlaceholder,
  FindingCard,
  ManagerReviewTextarea,
  ReviewFieldLabel,
  TogglePill,
} from "@/components/manager-review-ui";
import { StaffAssigneePicker, staffDisplayName, type StaffUserOption } from "@/components/staff-assignee-picker";
import * as React from "react";

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
  staffUsers: StaffUserOption[];
  roleLabels: Record<string, string>;
  readOnly?: boolean;
  onChange?: (patch: Partial<ExecAuditDraft>) => void;
  onDelete?: () => void;
};

export function ExecAuditCard({ audit, index, staffUsers, roleLabels, readOnly, onChange, onDelete }: Props) {
  return (
    <FindingCard className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        {readOnly ? (
          <p className="font-medium text-white">{audit.exec_va_name?.trim() ? audit.exec_va_name : <DashPlaceholder />}</p>
        ) : (
          <div className="w-full space-y-1.5">
            <ReviewFieldLabel className="text-xs">Exec / VA</ReviewFieldLabel>
            <StaffAssigneePicker
              users={staffUsers}
              roleLabels={roleLabels}
              selectedIds={audit.exec_va_id ? [audit.exec_va_id] : []}
              onChange={(ids) => {
                const id = ids[0] ?? "";
                const member = staffUsers.find((u) => u.id === id);
                onChange?.({ exec_va_id: id, exec_va_name: member ? staffDisplayName(member) : "" });
              }}
              singleSelect
            />
          </div>
        )}
        {!readOnly && onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg border border-white/10 p-2 text-red-400/55 transition hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-300"
            aria-label={`Remove audit ${index + 1}`}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {EXEC_AUDIT_COMPLIANCE_FIELDS.map(({ key, label }) => {
          const selected = Boolean(audit[key]);
          if (readOnly && !selected) return null;
          return (
            <TogglePill
              key={key}
              label={label}
              variant="compliance"
              selected={selected}
              readOnly={readOnly}
              onClick={() => onChange?.({ [key]: !selected })}
            />
          );
        })}
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
          <ManagerReviewTextarea
            placeholder="Issues found"
            value={audit.issues_found}
            onChange={(e) => onChange?.({ issues_found: e.target.value })}
            rows={2}
          />
          <ManagerReviewTextarea
            placeholder="Actions taken"
            value={audit.actions_taken}
            onChange={(e) => onChange?.({ actions_taken: e.target.value })}
            rows={2}
          />
        </>
      )}
    </FindingCard>
  );
}
