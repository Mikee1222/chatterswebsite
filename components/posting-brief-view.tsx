"use client";

import * as React from "react";
import {
  Clock,
  Film,
  FolderOpen,
  Link2,
  ListChecks,
  Music,
  Type,
} from "lucide-react";
import type { PostingBrief, PostingBriefPost } from "@/services/posting-briefs";
import {
  BriefCopyButton,
  BriefFlowStrip,
  BriefPreText,
  BriefSectionNav,
  CopyField,
  LocalChecklist,
  ModelChip,
  PathBreadcrumb,
  PriorityPill,
  SectionCard,
  StatusBadge,
  StatusStepper,
  POSTING_STATUS_STEPS,
} from "@/components/briefs/shared";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

type Props = {
  brief: PostingBrief;
  modelName?: string;
  className?: string;
  editingBriefId?: string | null;
};

const SECTIONS = [
  { id: "pb-video", label: "Video" },
  { id: "pb-posts", label: "Posts" },
  { id: "pb-sound", label: "Sound" },
  { id: "pb-style", label: "Text style" },
  { id: "pb-timing", label: "Timing" },
  { id: "pb-check", label: "Final check" },
];

function PostCard({ post, index }: { post: PostingBriefPost; index: number }) {
  return (
    <div className="rounded-2xl border border-white/[0.1] bg-gradient-to-b from-white/[0.05] to-transparent p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
          Post {index + 1}
        </p>
        {post.video_name ? (
          <p className="truncate text-xs text-[#D4AF8C]/80">{post.video_name}</p>
        ) : null}
      </div>

      {post.text_on_screen != null && post.text_on_screen !== "" ? (
        <div className="mb-4">
          <CopyField label="Text on screen" text={post.text_on_screen} />
        </div>
      ) : null}

      <div className="mb-3">
        <CopyField label="Caption" text={post.caption} />
      </div>

      {post.pinned_comment != null && post.pinned_comment !== "" ? (
        <div className="mb-3">
          <CopyField label="Pinned comment" text={post.pinned_comment} />
        </div>
      ) : null}

      {post.notes != null && post.notes !== "" ? (
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
            Notes
          </p>
          <BriefPreText value={post.notes} />
        </div>
      ) : null}
    </div>
  );
}

export function PostingBriefView({
  brief,
  modelName,
  className,
  editingBriefId,
}: Props) {
  const allCaptions = brief.posts
    .map((p, i) => `Post ${i + 1}\n${p.caption}`)
    .filter((_, i) => !!brief.posts[i]?.caption)
    .join("\n\n");

  return (
    <div className={cn("space-y-4", className)}>
      <BriefFlowStrip
        current="posting"
        editingHref={editingBriefId ? ROUTES.editingBrief(editingBriefId) : null}
        postingHref={ROUTES.postingBrief(brief.id)}
      />

      <header className="rounded-3xl border border-[#D4AF8C]/15 bg-gradient-to-br from-[#151315] via-[#0D0B0D] to-[#120810] px-5 py-6 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#D4AF8C]/70">
              Posting brief
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
              {brief.title}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              {modelName ? <ModelChip name={modelName} /> : null}
              <PriorityPill priority={brief.priority} />
              <StatusBadge status={brief.status} />
            </div>
            <p className="text-sm text-white/55">
              {brief.account_handle
                ? brief.account_handle.startsWith("@")
                  ? brief.account_handle
                  : `@${brief.account_handle}`
                : ""}
              {` · ${brief.content_type}`}
              {` · ${brief.region}`}
              {` · ${brief.account_type}`}
            </p>
            <StatusStepper steps={POSTING_STATUS_STEPS} current={brief.status} />
          </div>
        </div>
        {brief.instructions_notes ? (
          <div className="mt-4 rounded-2xl border border-white/[0.08] bg-black/25 p-4">
            <BriefPreText value={brief.instructions_notes} />
          </div>
        ) : null}
      </header>

      <div className="md:flex md:gap-6">
        <BriefSectionNav sections={SECTIONS} />
        <div className="min-w-0 flex-1 space-y-4">
          <SectionCard id="pb-video" icon={FolderOpen} title="Video">
            <PathBreadcrumb path={brief.video_location_path || ""} />
            {!brief.video_location_path ? (
              <BriefPreText value="" />
            ) : null}
          </SectionCard>

          <SectionCard
            id="pb-posts"
            icon={Film}
            title="Posts"
            actions={
              allCaptions ? (
                <BriefCopyButton text={allCaptions} label="all captions" />
              ) : null
            }
          >
            <div className="space-y-3">
              {brief.posts.length ? (
                brief.posts.map((post, i) => (
                  <PostCard key={post.id || i} post={post} index={i} />
                ))
              ) : (
                <p className="text-sm text-white/35">No posts yet.</p>
              )}
            </div>
          </SectionCard>

          <SectionCard id="pb-sound" icon={Music} title="Sound">
            <div className="space-y-2 text-sm text-white/80">
              <p>
                <span className="text-white/40">Name: </span>
                {brief.sound_name || "—"}
              </p>
              {brief.sound_link ? (
                <p className="flex flex-wrap items-center gap-2">
                  <span className="text-white/40">Link: </span>
                  <a
                    href={brief.sound_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-1 text-[#D4AF8C] underline-offset-2 hover:underline"
                  >
                    <Link2 className="h-3.5 w-3.5" aria-hidden />
                    Open sound
                  </a>
                </p>
              ) : null}
              {brief.sound_notes ? <BriefPreText value={brief.sound_notes} /> : null}
            </div>
          </SectionCard>

          <SectionCard id="pb-style" icon={Type} title="Text style">
            <BriefPreText value={brief.text_style_notes || ""} />
          </SectionCard>

          <SectionCard id="pb-timing" icon={Clock} title="Timing">
            <BriefPreText value={brief.timing_notes || ""} />
          </SectionCard>

          <SectionCard id="pb-check" icon={ListChecks} title="Final check">
            {brief.final_checklist.length ? (
              <LocalChecklist
                storageKey={`pb-checklist:${brief.id}`}
                lines={brief.final_checklist}
              />
            ) : (
              <p className="text-sm text-white/35">—</p>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
