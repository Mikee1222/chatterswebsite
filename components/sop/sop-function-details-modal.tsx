"use client";

import { Download, ExternalLink, FileText, Layers, Video } from "lucide-react";
import { SopModalShell } from "@/components/sop/sop-modal-shell";
import { SopModalFooter } from "@/components/sop/sop-modal-footer";
import { SopFunctionInfoCard } from "@/components/sop/sop-function-info-card";
import { SopGlowBadge } from "@/components/sop/sop-glow-badge";
import {
  CADENCE_LABELS,
  CADENCE_STYLES,
  CADENCE_TYPES,
  SOP_COLOR_STYLES,
  cadenceHasFixedSchedule,
} from "@/components/sop/sop-colors";
import { FilePreview, isPdfFile } from "@/components/ui/file-preview";
import { Markdown } from "@/components/ui/markdown";
import { LoomEmbed } from "@/components/ui/loom-embed";
import { ButtonSecondary } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import type { CadenceType, SopDepartment, SopFunction, SopRole } from "@/types";

export function SopFunctionDetailsModal({
  fn,
  role,
  department,
  onClose,
  onEdit,
}: {
  fn: SopFunction;
  role: SopRole | null;
  department: SopDepartment | undefined;
  onClose: () => void;
  onEdit?: (fn: SopFunction) => void;
}) {
  const roleStyle = role ? SOP_COLOR_STYLES[role.color] : SOP_COLOR_STYLES.gray;
  const cadence: CadenceType = CADENCE_TYPES.includes(fn.cadence_type) ? fn.cadence_type : "weekly";
  const cadenceStyle = CADENCE_STYLES[cadence];
  const fileUrl = fn.sop_file_url.trim();
  const fileName = fn.sop_file_name.trim() || "Attached file";
  const isPdf = Boolean(fileUrl) && isPdfFile(fileName, fileUrl);
  const showFile = fn.standard_type === "file" && Boolean(fileUrl);
  const showText = fn.standard_type !== "file";

  return (
    <SopModalShell
      onClose={onClose}
      title={fn.name}
      subtitle="Function details"
      size="xl"
      className="sop-modal-panel md:rounded-2xl md:max-w-3xl"
      footer={
        <SopModalFooter>
          <ButtonSecondary type="button" onClick={onClose}>
            Close
          </ButtonSecondary>
          {onEdit ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(fn);
              }}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-pink-500/35 bg-pink-500/15 px-4 text-sm font-semibold text-pink-100 transition hover:border-pink-400/50 hover:bg-pink-500/25"
            >
              Edit function
            </button>
          ) : null}
        </SopModalFooter>
      }
    >
      <div className="space-y-6 px-4 py-5 md:px-5 md:py-6">
        <section className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-white/40">Metadata</p>
          <div className="flex flex-wrap items-center gap-2">
            {role ? (
              <SopGlowBadge className={roleStyle.badge} glowClassName={roleStyle.glow}>
                <Layers className="mr-1 inline h-3 w-3" />
                {role.name}
              </SopGlowBadge>
            ) : null}
            <SopGlowBadge className={cadenceStyle.badge} glowClassName={cadenceStyle.glow}>
              {CADENCE_LABELS[cadence]}
            </SopGlowBadge>
            {!cadenceHasFixedSchedule(cadence) ? (
              <span className="text-xs text-white/45">Completed when a triggering event occurs</span>
            ) : null}
            {fn.loom_url.trim() ? (
              <SopGlowBadge
                className="border-violet-500/30 bg-violet-500/12 text-violet-200"
                glowClassName="shadow-[0_0_14px_-5px_rgba(139,92,246,0.35)]"
              >
                <Video className="mr-1 inline h-3 w-3" />
                Loom
              </SopGlowBadge>
            ) : null}
            {!fn.is_active ? (
              <SopGlowBadge className="border-white/15 bg-white/10 text-white/55">Inactive</SopGlowBadge>
            ) : null}
          </div>
          <SopFunctionInfoCard fn={fn} department={department} compact />
        </section>

        <section className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-white/40">
            {showFile ? "Attached standard" : "SOP instructions"}
          </p>

          {showFile ? (
            <div
              className={cn(
                "overflow-hidden rounded-2xl border border-white/12 bg-gradient-to-b from-white/[0.06] to-white/[0.02]",
                "shadow-[0_0_40px_-16px_rgba(14,165,233,0.25)]"
              )}
            >
              <div className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-500/25 bg-sky-500/10 text-sky-200">
                  <FileText className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white/90">{fileName}</p>
                  <p className="text-xs text-white/45">
                    {isPdf ? "PDF preview · signed link" : "Attachment · signed link"}
                  </p>
                </div>
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/70 transition hover:border-sky-400/30 hover:bg-white/[0.07] hover:text-white"
                >
                  {isPdf ? <ExternalLink className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
                  {isPdf ? "Open" : "Download"}
                </a>
              </div>
              <div className="p-3 sm:p-4">
                <FilePreview url={fileUrl} name={fileName} className="border-0 shadow-none" />
              </div>
            </div>
          ) : showText ? (
            <div className="sop-glass-panel rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
              <Markdown emptyFallback="No SOP content yet." className="max-w-none text-[15px] leading-relaxed">
                {fn.sop_content}
              </Markdown>
            </div>
          ) : (
            <p className="text-sm text-white/45">No file uploaded yet.</p>
          )}
        </section>

        {fn.loom_url.trim() ? (
          <section className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/40">Loom</p>
            <LoomEmbed url={fn.loom_url} title={`${fn.name} — Loom`} />
          </section>
        ) : null}

        {fn.kpi.trim() ? (
          <section className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/40">KPI</p>
            <p className="text-sm leading-relaxed text-white/75 whitespace-pre-wrap">{fn.kpi}</p>
          </section>
        ) : null}
      </div>
    </SopModalShell>
  );
}
