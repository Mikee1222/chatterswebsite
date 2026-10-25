"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import {
  approvalLanguageLabel,
  buildApplicationApprovalMessage,
  shouldShowApprovalMessage,
  type ApprovalMessageStatus,
} from "@/lib/application-approval-messages";
import type {
  ApplicationResponseStatus,
  ApprovalMessageTemplates,
} from "@/lib/application-forms-types";
import type { PipelineLanguage } from "@/lib/application-pipeline-i18n";
import { cn } from "@/lib/utils";

type Props = {
  fullName: string;
  formTitle: string;
  positionTitle: string | null | undefined;
  templates: ApprovalMessageTemplates | null | undefined;
  preferredLanguage: PipelineLanguage | null | undefined;
  status: ApplicationResponseStatus;
  /** Compact = icon + short label for list/kanban. */
  variant?: "full" | "compact";
  className?: string;
};

export function ApplicationCopyApprovalButton({
  fullName,
  formTitle,
  positionTitle,
  templates,
  preferredLanguage,
  status,
  variant = "compact",
  className,
}: Props) {
  const [copied, setCopied] = useState(false);

  if (!shouldShowApprovalMessage(status)) return null;

  const message = buildApplicationApprovalMessage({
    fullName,
    formTitle,
    preferredLanguage,
    status: status as ApprovalMessageStatus,
    positionTitle,
    templates,
  });

  const positionLabel = (positionTitle ?? "").trim() || "no position";
  const langLabel = approvalLanguageLabel(preferredLanguage);

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      toast.success("Approval message copied");
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy message");
    }
  }

  if (variant === "full") {
    return (
      <div className={cn("rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-4", className)}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-300/90">
            Copy approval message
          </label>
          <button
            type="button"
            onClick={() => void copy()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-white/75 transition hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
            ) : (
              <Copy className="h-3.5 w-3.5" aria-hidden />
            )}
            {copied ? "Copied" : "Copy message"}
          </button>
        </div>
        <p className="mt-1 text-xs text-white/45">
          {langLabel} · position: {positionLabel} — personalized for {fullName}.
        </p>
        <textarea
          readOnly
          value={message}
          rows={8}
          className="mt-3 min-h-[180px] w-full resize-y rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm leading-relaxed text-white/85 outline-none"
          onFocus={(e) => e.currentTarget.select()}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void copy();
      }}
      title={`Copy approval message (${langLabel} · ${positionLabel})`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-200/90 transition hover:bg-emerald-500/20",
        className,
      )}
    >
      {copied ? (
        <Check className="h-3 w-3 text-emerald-400" aria-hidden />
      ) : (
        <Copy className="h-3 w-3" aria-hidden />
      )}
      {copied ? "Copied" : "Copy Approval Message"}
      <span className="font-normal text-emerald-200/55">
        · {positionLabel} · {preferredLanguage === "el" ? "EL" : "EN"}
      </span>
    </button>
  );
}
