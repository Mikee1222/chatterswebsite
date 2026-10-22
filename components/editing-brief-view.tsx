"use client";

import * as React from "react";
import Link from "next/link";
import {
  Ban,
  CheckSquare,
  Film,
  FolderOpen,
  Link2,
  ListOrdered,
  Music,
  Scissors,
  Sparkles,
  Type,
} from "lucide-react";
import type { EditingBrief } from "@/services/editing-briefs";
import {
  BriefCopyButton,
  BriefDeadlineBanner,
  BriefFlowStrip,
  BriefPreText,
  BriefReferenceLinks,
  BriefSectionNav,
  CopyField,
  DoNotAddBlock,
  LocalChecklist,
  ModelChip,
  PathBreadcrumb,
  PriorityPill,
  SectionCard,
  StatusBadge,
  StatusStepper,
  EDITING_STATUS_STEPS,
} from "@/components/briefs/shared";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { VA_CARD } from "@/lib/va-tasks-tokens";

type Props = {
  brief: EditingBrief;
  modelName?: string;
  editorName?: string;
  className?: string;
  recordingBriefTitle?: string;
};

const AUDIO_LABELS: Record<string, string> = {
  keep_voice: "Keep voice",
  mute_original: "Mute original",
  clean_up: "Clean up",
};

const SECTIONS = [
  { id: "eb-refs", label: "References" },
  { id: "eb-concept", label: "Concept" },
  { id: "eb-raw", label: "Raw footage" },
  { id: "eb-cut", label: "Cut rules" },
  { id: "eb-audio", label: "Audio" },
  { id: "eb-text", label: "Text" },
  { id: "eb-videos", label: "Videos" },
  { id: "eb-donot", label: "Do NOT" },
  { id: "eb-export", label: "Export" },
  { id: "eb-upload", label: "Upload" },
  { id: "eb-check", label: "Final check" },
];

export function EditingBriefView({
  brief,
  modelName,
  editorName,
  className,
  recordingBriefTitle,
}: Props) {
  const finalCheckLines = (brief.final_check || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  return (
    <div className={cn("space-y-4", className)}>
      {brief.status === "changes_needed" && brief.reviewer_comment ? (
        <div className="rounded-2xl border border-amber-400/40 bg-amber-500/15 px-4 py-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-200">
            Changes needed
          </p>
          <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-amber-50">
            {brief.reviewer_comment}
          </pre>
        </div>
      ) : null}

      <BriefFlowStrip
        current="editing"
        recordingHref={
          brief.recording_brief_id
            ? ROUTES.recordingBrief(brief.recording_brief_id)
            : null
        }
        editingHref={ROUTES.editingBrief(brief.id)}
        postingHref={
          brief.status === "approved"
            ? `${ROUTES.postingBriefNew}?from_editing=${encodeURIComponent(brief.id)}`
            : null
        }
      />

      {brief.recording_brief_id ? (
        <Link
          href={ROUTES.recordingBrief(brief.recording_brief_id)}
          className={cn(
            VA_CARD,
            "flex min-h-12 items-center justify-between gap-3 px-4 py-3 transition hover:border-[#D4AF8C]/35",
          )}
        >
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
              Linked Recording Brief
            </p>
            <p className="mt-0.5 text-sm font-medium text-white/85">
              {recordingBriefTitle || "Open recording brief"}
            </p>
          </div>
          <span className="text-xs text-[#D4AF8C]">Open →</span>
        </Link>
      ) : null}

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <PriorityPill priority={brief.priority} />
          <StatusBadge status={brief.status} />
          {modelName ? <ModelChip name={modelName} /> : null}
        </div>
        <h2 className="text-xl font-semibold tracking-tight text-white md:text-2xl">
          {brief.title || "Untitled"}
        </h2>
        <p className="text-sm text-white/50">
          {editorName ? `Editor: ${editorName}` : null}
          {brief.deliverables_count
            ? `${editorName ? " · " : ""}${brief.deliverables_count} video${brief.deliverables_count === 1 ? "" : "s"}`
            : null}
        </p>
        <StatusStepper steps={EDITING_STATUS_STEPS} current={brief.status} />
        <BriefDeadlineBanner deadlineAt={brief.deadline_at} />
      </header>

      <div className="md:flex md:gap-6">
        <BriefSectionNav sections={SECTIONS} />
        <div className="min-w-0 flex-1 space-y-4">
          <SectionCard id="eb-refs" icon={Link2} title="Reference links">
            <BriefReferenceLinks
              links={brief.reference_links}
              note="Watch first, copy the style"
            />
          </SectionCard>

          <SectionCard id="eb-concept" icon={Sparkles} title="Concept">
            <BriefPreText value={brief.concept} />
          </SectionCard>

          <SectionCard id="eb-raw" icon={FolderOpen} title="Raw footage">
            <PathBreadcrumb path={brief.raw_footage_path} />
            <div className="mt-4">
              <CopyField label="Files / takes" text={brief.raw_files_takes} />
            </div>
          </SectionCard>

          <SectionCard id="eb-cut" icon={Scissors} title="Cut rules">
            <BriefPreText value={brief.cut_rules} />
          </SectionCard>

          <SectionCard id="eb-audio" icon={Music} title="Audio">
            <p className="text-sm text-white/80">
              Voice: {AUDIO_LABELS[brief.audio_voice] ?? brief.audio_voice}
            </p>
            <p className="mt-1 text-sm text-white/80">
              Music: {brief.audio_music ? "Yes" : "No"}
            </p>
            {brief.audio_notes ? (
              <div className="mt-2">
                <BriefPreText value={brief.audio_notes} />
              </div>
            ) : null}
          </SectionCard>

          <SectionCard id="eb-text" icon={Type} title="Text & graphics">
            {brief.text_graphics.length === 0 ? (
              <p className="text-sm text-white/35">—</p>
            ) : (
              <div className="space-y-3">
                {brief.text_graphics.map((tg, i) => (
                  <div
                    key={i}
                    className="space-y-3 rounded-2xl border border-white/[0.1] bg-white/[0.03] p-4"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
                      Block {i + 1}
                    </p>
                    <CopyField label="Title on top" text={tg.title_on_top_text} />
                    {tg.title_on_top_style ? (
                      <p className="text-xs text-white/50">Style: {tg.title_on_top_style}</p>
                    ) : null}
                    <p className="text-sm text-white/70">
                      Subtitles: {tg.subtitles ? "Yes" : "No"}
                      {tg.subtitles && tg.subtitles_style ? ` · ${tg.subtitles_style}` : ""}
                    </p>
                    {tg.subtitles && tg.subtitles_style ? (
                      <BriefCopyButton text={tg.subtitles_style} label="subtitle style" />
                    ) : null}
                    {tg.labels ? <CopyField label="Labels (clip→label)" text={tg.labels} /> : null}
                    {tg.pictures ? (
                      <CopyField label="Pictures (item→image)" text={tg.pictures} />
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard id="eb-videos" icon={Film} title="Per video">
            {brief.videos.length === 0 ? (
              <p className="text-sm text-white/35">—</p>
            ) : (
              <div className="space-y-3">
                {brief.videos.map((v, i) => (
                  <div
                    key={v.id || i}
                    className="rounded-2xl border border-white/[0.1] bg-gradient-to-b from-white/[0.05] to-transparent p-4"
                  >
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-white/90">
                        {i + 1}. {v.output_name || `Video ${i + 1}`}
                      </p>
                      <BriefCopyButton text={v.output_name} label="output name" />
                    </div>
                    {v.raw_take ? <CopyField label="Raw take" text={v.raw_take} /> : null}
                    {v.special_instructions ? (
                      <div className="mt-3">
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
                          Special instructions
                        </p>
                        <BriefPreText value={v.special_instructions} />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard id="eb-donot" icon={Ban} title="Do NOT add">
            <DoNotAddBlock text={brief.do_not_add} />
          </SectionCard>

          <SectionCard id="eb-export" icon={ListOrdered} title="Export">
            <p className="text-sm text-white/80">
              {brief.export_width}×{brief.export_height} · {brief.export_fps}fps ·{" "}
              {brief.export_format}
            </p>
          </SectionCard>

          <SectionCard id="eb-upload" icon={FolderOpen} title="Upload path for finals">
            <PathBreadcrumb path={brief.upload_path_finals} />
          </SectionCard>

          <SectionCard id="eb-check" icon={CheckSquare} title="Final check">
            {finalCheckLines.length ? (
              <LocalChecklist
                storageKey={`eb-checklist:${brief.id}`}
                lines={finalCheckLines}
              />
            ) : (
              <BriefPreText value={brief.final_check} />
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
