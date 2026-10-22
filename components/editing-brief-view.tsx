"use client";

import * as React from "react";
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
  BriefPreText,
  BriefReferenceLinks,
  BriefSection,
} from "@/components/brief-shared-ui";
import { cn } from "@/lib/utils";

type Props = {
  brief: EditingBrief;
  modelName?: string;
  editorName?: string;
  className?: string;
};

const AUDIO_LABELS: Record<string, string> = {
  keep_voice: "Keep voice",
  mute_original: "Mute original",
  clean_up: "Clean up",
};

export function EditingBriefView({ brief, modelName, editorName, className }: Props) {
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

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {brief.priority === "urgent" ? (
            <span className="rounded-lg bg-rose-500/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-rose-200">
              Urgent
            </span>
          ) : null}
          <span className="rounded-lg bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white/60">
            {brief.status.replace(/_/g, " ")}
          </span>
        </div>
        <h2 className="text-xl font-semibold tracking-tight text-white md:text-2xl">
          {brief.title || "Untitled"}
        </h2>
        <p className="text-sm text-white/50">
          {modelName || brief.model_id || "Model"}
          {editorName ? ` · Editor: ${editorName}` : null}
          {brief.deliverables_count
            ? ` · ${brief.deliverables_count} video${brief.deliverables_count === 1 ? "" : "s"}`
            : null}
        </p>
      </header>

      <BriefDeadlineBanner deadlineAt={brief.deadline_at} />

      <BriefSection icon={Link2} title="Reference links">
        <BriefReferenceLinks
          links={brief.reference_links}
          note="Watch first, copy the style"
        />
      </BriefSection>

      <BriefSection icon={Sparkles} title="Concept">
        <BriefPreText value={brief.concept} />
      </BriefSection>

      <BriefSection
        icon={FolderOpen}
        title="Raw footage"
        actions={<BriefCopyButton text={brief.raw_footage_path} label="raw path" />}
      >
        <BriefPreText value={brief.raw_footage_path} />
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
              Files / takes
            </p>
            <BriefCopyButton text={brief.raw_files_takes} label="files list" />
          </div>
          <BriefPreText value={brief.raw_files_takes} />
        </div>
      </BriefSection>

      <BriefSection icon={Scissors} title="Cut rules">
        <BriefPreText value={brief.cut_rules} />
      </BriefSection>

      <BriefSection icon={Music} title="Audio">
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
      </BriefSection>

      <BriefSection icon={Type} title="Text & graphics">
        {brief.text_graphics.length === 0 ? (
          <p className="text-sm text-white/35">—</p>
        ) : (
          <div className="space-y-3">
            {brief.text_graphics.map((tg, i) => (
              <div
                key={i}
                className="rounded-2xl border border-white/[0.1] bg-white/[0.03] p-4 space-y-2"
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
                  Block {i + 1}
                </p>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-white/40">Title on top</p>
                    <BriefPreText value={tg.title_on_top_text} />
                    {tg.title_on_top_style ? (
                      <p className="mt-1 text-xs text-white/50">Style: {tg.title_on_top_style}</p>
                    ) : null}
                  </div>
                  <BriefCopyButton text={tg.title_on_top_text} label="title text" />
                </div>
                <p className="text-sm text-white/70">
                  Subtitles: {tg.subtitles ? "Yes" : "No"}
                  {tg.subtitles && tg.subtitles_style ? ` · ${tg.subtitles_style}` : ""}
                </p>
                {tg.subtitles && tg.subtitles_style ? (
                  <BriefCopyButton text={tg.subtitles_style} label="subtitle style" />
                ) : null}
                {tg.labels ? (
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-white/40">Labels (clip→label)</p>
                      <BriefPreText value={tg.labels} />
                    </div>
                    <BriefCopyButton text={tg.labels} label="labels" />
                  </div>
                ) : null}
                {tg.pictures ? (
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-white/40">Pictures (item→image)</p>
                      <BriefPreText value={tg.pictures} />
                    </div>
                    <BriefCopyButton text={tg.pictures} label="pictures" />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </BriefSection>

      <BriefSection icon={Film} title="Per video">
        {brief.videos.length === 0 ? (
          <p className="text-sm text-white/35">—</p>
        ) : (
          <div className="space-y-3">
            {brief.videos.map((v, i) => (
              <div
                key={v.id || i}
                className="rounded-2xl border border-white/[0.1] bg-gradient-to-b from-white/[0.05] to-transparent p-4"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white/90">
                    {v.output_name || `Video ${i + 1}`}
                  </p>
                  <BriefCopyButton text={v.output_name} label="output name" />
                </div>
                {v.raw_take ? (
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
                        Raw take
                      </p>
                      <BriefPreText value={v.raw_take} />
                    </div>
                    <BriefCopyButton text={v.raw_take} label="raw take" />
                  </div>
                ) : null}
                {v.special_instructions ? (
                  <div>
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
      </BriefSection>

      <BriefSection icon={Ban} title="Do NOT add">
        <BriefPreText value={brief.do_not_add} />
      </BriefSection>

      <BriefSection icon={ListOrdered} title="Export">
        <p className="text-sm text-white/80">
          {brief.export_width}×{brief.export_height} · {brief.export_fps}fps · {brief.export_format}
        </p>
      </BriefSection>

      <BriefSection
        icon={FolderOpen}
        title="Upload path for finals"
        actions={<BriefCopyButton text={brief.upload_path_finals} label="finals path" />}
      >
        <BriefPreText value={brief.upload_path_finals} />
      </BriefSection>

      <BriefSection icon={CheckSquare} title="Final check">
        <BriefPreText value={brief.final_check} />
      </BriefSection>
    </div>
  );
}
