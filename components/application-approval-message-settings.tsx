"use client";

import { useMemo, useState } from "react";
import {
  APPROVAL_TEMPLATE_PLACEHOLDERS,
  approvalLanguageLabel,
  buildApplicationApprovalMessage,
  defaultApprovalTemplateForPosition,
  type ApprovalMessageStatus,
} from "@/lib/application-approval-messages";
import type { ApprovalMessageTemplates } from "@/lib/application-forms-types";
import { APPLY_INPUT, APPLY_SECTION } from "@/lib/application-ui-tokens";
import type { PipelineLanguage } from "@/lib/application-pipeline-i18n";
import { cn } from "@/lib/utils";

type Props = {
  formTitle: string;
  positionTitle: string;
  templates: ApprovalMessageTemplates;
  canManage: boolean;
  onPositionChange: (value: string) => void;
  onTemplatesChange: (next: ApprovalMessageTemplates) => void;
  /** Persist current (or overridden) position + templates. */
  onSave: (override?: {
    positionTitle?: string;
    templates?: ApprovalMessageTemplates;
  }) => void;
};

const SAMPLE_NAME = "Alex Candidate";

function StatusEditor({
  status,
  label,
  formTitle,
  positionTitle,
  templates,
  canManage,
  onChange,
  onSave,
}: {
  status: ApprovalMessageStatus;
  label: string;
  formTitle: string;
  positionTitle: string;
  templates: ApprovalMessageTemplates;
  canManage: boolean;
  onChange: (lang: PipelineLanguage, value: string) => ApprovalMessageTemplates;
  onSave: (override?: { templates?: ApprovalMessageTemplates }) => void;
}) {
  const [langTab, setLangTab] = useState<PipelineLanguage>("en");
  const value = templates[status][langTab];

  const preview = useMemo(
    () =>
      buildApplicationApprovalMessage({
        fullName: SAMPLE_NAME,
        formTitle,
        preferredLanguage: langTab,
        status,
        positionTitle: positionTitle.trim() || null,
        templates,
      }),
    [formTitle, langTab, positionTitle, status, templates],
  );

  function resetToDefault() {
    const nextText = defaultApprovalTemplateForPosition(status, langTab);
    const next = onChange(langTab, nextText);
    onSave({ templates: next });
  }

  return (
    <div className={cn(APPLY_SECTION, "space-y-3 p-4")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white/90">{label}</h3>
        <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.03] p-0.5 text-[11px]">
          {(["en", "el"] as const).map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => setLangTab(lang)}
              className={cn(
                "rounded-lg px-2.5 py-1.5 font-semibold uppercase transition",
                langTab === lang
                  ? "bg-gradient-to-br from-[#FF1493] to-[#DB2777] text-white shadow-[0_4px_12px_-4px_rgba(255,20,147,0.5)]"
                  : "text-white/45 hover:text-white/70",
              )}
            >
              {lang}
            </button>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-white/40">
        Placeholders: {APPROVAL_TEMPLATE_PLACEHOLDERS.join(" · ")}. Empty = neutral default (no
        role name). Language at copy time follows the candidate&apos;s preferred language.
      </p>
      <textarea
        value={value}
        disabled={!canManage}
        rows={10}
        onChange={(e) => onChange(langTab, e.target.value)}
        onBlur={(e) => {
          if (!canManage) return;
          const next = onChange(langTab, e.target.value);
          onSave({ templates: next });
        }}
        placeholder={defaultApprovalTemplateForPosition(status, langTab)}
        className={cn(APPLY_INPUT, "min-h-[200px] resize-y py-3 font-mono text-[12px] leading-relaxed disabled:opacity-60")}
      />
      <div className="flex flex-wrap gap-2">
        {canManage ? (
          <button
            type="button"
            onClick={() => resetToDefault()}
            className="rounded-lg border border-white/12 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-white/70 transition hover:bg-white/[0.07]"
          >
            Reset to default ({langTab.toUpperCase()})
          </button>
        ) : null}
      </div>
      <div className="rounded-lg border border-white/[0.06] bg-black/20 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
          Live preview · {approvalLanguageLabel(langTab)} · sample {SAMPLE_NAME}
          {positionTitle.trim() ? ` · ${positionTitle.trim()}` : " · (no position)"}
        </p>
        <pre className="mt-2 whitespace-pre-wrap font-sans text-[12px] leading-relaxed text-white/70">
          {preview}
        </pre>
      </div>
    </div>
  );
}

export function ApplicationApprovalMessageSettings({
  formTitle,
  positionTitle,
  templates,
  canManage,
  onPositionChange,
  onTemplatesChange,
  onSave,
}: Props) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-white/90">Approval messages</h2>
        <p className="mt-1 text-xs text-white/40">
          Shortlisted and Hired copy for &quot;Copy Approval Message&quot;. Position title drives{" "}
          <code className="text-white/55">{"{position}"}</code>; leave blank for neutral wording
          with no role name.
        </p>
      </div>
      <div className={cn(APPLY_SECTION, "space-y-2 p-4")}>
        <label className="block text-[11px] uppercase tracking-wider text-white/35">
          Position title
        </label>
        <input
          value={positionTitle}
          disabled={!canManage}
          onChange={(e) => onPositionChange(e.target.value)}
          onBlur={(e) => canManage && onSave({ positionTitle: e.target.value })}
          placeholder='e.g. Chatter, Marketing Executive (blank = "the role")'
          className={cn(APPLY_INPUT, "h-11 min-h-0 py-2.5 disabled:opacity-60")}
        />
      </div>
      <StatusEditor
        status="shortlisted"
        label="Shortlisted message"
        formTitle={formTitle}
        positionTitle={positionTitle}
        templates={templates}
        canManage={canManage}
        onChange={(lang, value) => {
          const next = {
            ...templates,
            shortlisted: { ...templates.shortlisted, [lang]: value },
          };
          onTemplatesChange(next);
          return next;
        }}
        onSave={(override) => onSave(override)}
      />
      <StatusEditor
        status="hired"
        label="Hired message"
        formTitle={formTitle}
        positionTitle={positionTitle}
        templates={templates}
        canManage={canManage}
        onChange={(lang, value) => {
          const next = {
            ...templates,
            hired: { ...templates.hired, [lang]: value },
          };
          onTemplatesChange(next);
          return next;
        }}
        onSave={(override) => onSave(override)}
      />
    </div>
  );
}
