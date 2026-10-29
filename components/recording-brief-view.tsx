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
  BriefSectionNav,
  CopyField,
  LocalChecklist,
  ModelChip,
  PathBreadcrumb,
  PriorityPill,
  SectionCard,
  StatusBadge,
  StatusStepper,
  RECORDING_STATUS_STEPS,
} from "@/components/briefs/shared";
import { cn } from "@/lib/utils";

type Props = {
  brief: RecordingBrief;
  modelName?: string;
  className?: string;
  /** Creator read-only layout (section order). */
  viewerMode?: boolean;
  showStickyMeta?: boolean;
  /** Wardrobe photos for the chosen outfit / location (signed URLs, resolved by the page). */
  wardrobePhotos?: { outfit?: WardrobePhoto | null; location?: WardrobePhoto | null };
};

export type WardrobePhoto = { number: number; name: string; url: string };

function WardrobePhotoCard({ label, photo }: { label: string; photo: WardrobePhoto }) {
  return (
    <figure className="overflow-hidden rounded-xl border border-[#D4AF8C]/25 bg-black/30">
      {photo.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo.url} alt="" className="aspect-[3/4] w-full object-cover" />
      ) : null}
      <figcaption className="px-3 py-2 text-[11px] text-white/60">
        <span className="font-semibold uppercase tracking-wider text-[#D4AF8C]/80">{label}</span>{" "}
        · #{photo.number} {photo.name}
      </figcaption>
    </figure>
  );
}

const SECTIONS = [
  { id: "rb-refs", label: "References" },
  { id: "rb-concept", label: "Concept" },
  { id: "rb-setup", label: "Setup" },
  { id: "rb-talk", label: "Talk / Act" },
  { id: "rb-variations", label: "Variations" },
  { id: "rb-props", label: "Props" },
  { id: "rb-checklist", label: "Checklist" },
  { id: "rb-upload", label: "Upload" },
  { id: "rb-naming", label: "Naming" },
];

export function RecordingBriefView({
  brief,
  modelName,
  className,
  viewerMode,
  showStickyMeta = true,
  wardrobePhotos,
}: Props) {
  const checklistLines = (brief.checklist_before_upload || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  return (
    <div className={cn("space-y-4", className)}>
      {showStickyMeta ? (
        <header className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <PriorityPill priority={brief.priority} />
            <StatusBadge status={brief.status} />
            {modelName ? <ModelChip name={modelName} /> : null}
          </div>
          <h2 className="text-xl font-semibold tracking-tight text-white md:text-2xl">
            {brief.title || "Untitled"}
          </h2>
          <StatusStepper steps={RECORDING_STATUS_STEPS} current={brief.status} />
          <BriefDeadlineBanner deadlineAt={brief.deadline_at} />
        </header>
      ) : null}

      <div className="md:flex md:gap-6">
        <BriefSectionNav sections={SECTIONS} />
        <div className="min-w-0 flex-1 space-y-4">
          <SectionCard id="rb-refs" icon={Link2} title="Reference links">
            <BriefReferenceLinks
              links={brief.reference_links}
              note="Watch before filming"
            />
          </SectionCard>

          <SectionCard id="rb-concept" icon={Sparkles} title="Concept & Why">
            <BriefPreText value={brief.concept_why} />
          </SectionCard>

          <SectionCard id="rb-setup" icon={Camera} title="Setup">
            {wardrobePhotos?.outfit || wardrobePhotos?.location ? (
              <div className="mb-4 grid max-w-md grid-cols-2 gap-3">
                {wardrobePhotos.outfit ? (
                  <WardrobePhotoCard label="Outfit" photo={wardrobePhotos.outfit} />
                ) : null}
                {wardrobePhotos.location ? (
                  <WardrobePhotoCard label="Location" photo={wardrobePhotos.location} />
                ) : null}
              </div>
            ) : null}
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
          </SectionCard>

          <SectionCard id="rb-talk" icon={Mic} title="How to talk / How to act">
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
          </SectionCard>

          <SectionCard
            id="rb-variations"
            icon={Clapperboard}
            title="Variations"
            actions={
              brief.variations.some((v) => v.script_shot_list) ? (
                <BriefCopyButton
                  text={brief.variations
                    .map(
                      (v, i) =>
                        `${v.name || `Variation ${i + 1}`}\n${v.script_shot_list}`,
                    )
                    .join("\n\n")}
                  label="all scripts"
                />
              ) : null
            }
          >
            <div className="space-y-3">
              {brief.variations.length === 0 ? (
                <p className="text-sm text-white/35">—</p>
              ) : (
                brief.variations.map((v, i) => (
                  <div
                    key={v.id || i}
                    className="rounded-2xl border border-white/[0.1] bg-gradient-to-b from-white/[0.05] to-transparent p-4"
                  >
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-white/90">
                        {i + 1}. {v.name || `Variation ${i + 1}`}
                      </p>
                      <p className="text-xs text-white/45">{v.takes} takes</p>
                    </div>
                    <CopyField label="Script / shot list" text={v.script_shot_list} />
                    {v.notes ? (
                      <div className="mt-3">
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
          </SectionCard>

          <SectionCard id="rb-props" icon={Package} title="Props">
            <BriefPreText value={brief.props} />
          </SectionCard>

          <SectionCard id="rb-checklist" icon={CheckSquare} title="Checklist before upload">
            {checklistLines.length ? (
              <LocalChecklist
                storageKey={`rb-checklist:${brief.id}`}
                lines={checklistLines}
              />
            ) : (
              <BriefPreText value={brief.checklist_before_upload} />
            )}
          </SectionCard>

          <SectionCard id="rb-upload" icon={FolderOpen} title="Upload path">
            <PathBreadcrumb path={brief.upload_path} />
          </SectionCard>

          <SectionCard
            id="rb-naming"
            icon={ListOrdered}
            title="Clip naming"
            actions={<BriefCopyButton text={brief.clip_naming} label="clip naming" />}
          >
            <BriefPreText value={brief.clip_naming} />
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
