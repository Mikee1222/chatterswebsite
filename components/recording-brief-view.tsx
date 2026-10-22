"use client";

import * as React from "react";
import {
  Camera,
  CheckSquare,
  Clapperboard,
  FolderOpen,
  Link2,
  ListOrdered,
  Mic,
  Package,
  Sparkles,
} from "lucide-react";
import type { RecordingBrief } from "@/services/recording-briefs";
import {
  BriefCopyButton,
  BriefDeadlineBanner,
  BriefPreText,
  BriefReferenceLinks,
  BriefSection,
} from "@/components/brief-shared-ui";
import { cn } from "@/lib/utils";

type Props = {
  brief: RecordingBrief;
  modelName?: string;
  className?: string;
  /** Creator read-only layout (section order). */
  viewerMode?: boolean;
};

export function RecordingBriefView({ brief, modelName, className, viewerMode }: Props) {
  return (
    <div className={cn("space-y-4", className)}>
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {brief.priority === "urgent" ? (
            <span className="rounded-lg bg-rose-500/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-rose-200">
              Urgent
            </span>
          ) : null}
          <span className="rounded-lg bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white/60">
            {brief.status}
          </span>
        </div>
        <h2 className="text-xl font-semibold tracking-tight text-white md:text-2xl">
          {brief.title || "Untitled"}
        </h2>
        <p className="text-sm text-white/50">{modelName || brief.model_id || "Model"}</p>
      </header>

      <BriefDeadlineBanner deadlineAt={brief.deadline_at} />

      <BriefSection icon={Link2} title="Reference links">
        <BriefReferenceLinks
          links={brief.reference_links}
          note="Watch before filming"
        />
      </BriefSection>

      <BriefSection icon={Sparkles} title="Concept & Why">
        <BriefPreText value={brief.concept_why} />
      </BriefSection>

      <BriefSection icon={Camera} title="Setup">
        <dl className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["Camera", brief.setup_camera],
              ["Framing", brief.setup_framing],
              ["Location", brief.setup_location],
              ["Outfit", brief.setup_outfit],
              ["Light", brief.setup_light],
              ["Sound", brief.setup_sound],
            ] as const
          ).map(([label, val]) => (
            <div key={label}>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
                {label}
              </dt>
              <dd className="mt-1">
                <BriefPreText value={val} />
              </dd>
            </div>
          ))}
        </dl>
        {brief.setup_notes ? (
          <div className="mt-3 border-t border-white/10 pt-3">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
              Notes
            </p>
            <BriefPreText value={brief.setup_notes} />
          </div>
        ) : null}
      </BriefSection>

      <BriefSection icon={Mic} title="How to talk / How to act">
        <div className="space-y-4">
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
              How to talk
            </p>
            <BriefPreText value={brief.how_to_talk} />
          </div>
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
              How to act
            </p>
            <BriefPreText value={brief.how_to_act} />
          </div>
        </div>
      </BriefSection>

      <BriefSection icon={Clapperboard} title="Variations">
        <div className="space-y-3">
          {brief.variations.length === 0 ? (
            <p className="text-sm text-white/35">—</p>
          ) : (
            brief.variations.map((v, i) => (
              <div
                key={v.id || i}
                className="rounded-2xl border border-white/[0.1] bg-gradient-to-b from-white/[0.05] to-transparent p-4"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white/90">
                    {v.name || `Variation ${i + 1}`}
                  </p>
                  <p className="text-xs text-white/45">{v.takes} takes</p>
                </div>
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
                      Script / shot list
                    </p>
                    <BriefPreText value={v.script_shot_list} />
                  </div>
                  <BriefCopyButton text={v.script_shot_list} label="script" />
                </div>
                {v.notes ? (
                  <div>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
                      Notes
                    </p>
                    <BriefPreText value={v.notes} />
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </BriefSection>

      <BriefSection icon={Package} title="Props">
        <BriefPreText value={brief.props} />
      </BriefSection>

      <BriefSection icon={CheckSquare} title="Checklist before upload">
        <BriefPreText value={brief.checklist_before_upload} />
      </BriefSection>

      <BriefSection
        icon={FolderOpen}
        title="Upload path"
        actions={<BriefCopyButton text={brief.upload_path} label="upload path" />}
      >
        <BriefPreText value={brief.upload_path} />
      </BriefSection>

      <BriefSection
        icon={ListOrdered}
        title="Clip naming"
        actions={<BriefCopyButton text={brief.clip_naming} label="clip naming" />}
      >
        <BriefPreText value={brief.clip_naming} />
      </BriefSection>

      {viewerMode ? null : null}
    </div>
  );
}
