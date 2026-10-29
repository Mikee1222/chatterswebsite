"use client";

import * as React from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { BriefAiGenerateButton } from "@/components/brief-ai-generate-button";
import { PostingBriefView } from "@/components/posting-brief-view";
import type {
  PostingBrief,
  PostingBriefAccountType,
  PostingBriefContentType,
  PostingBriefInput,
  PostingBriefPostInput,
  PostingBriefPriority,
  PostingBriefRegion,
} from "@/services/posting-briefs";
import type { ModelRecord } from "@/types";
import { VA_BTN_PRIMARY, VA_BTN_SECONDARY, VA_FILTER_INPUT } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";

export type PostingBriefFormModelOption = Pick<ModelRecord, "id" | "model_name">;

export type AccountSuggestion = {
  username: string;
  account_type: "main" | "secondary";
  region: string;
};

type DraftPost = PostingBriefPostInput & { key: string };

type Props = {
  models: PostingBriefFormModelOption[];
  accountSuggestionsByModel: Record<string, AccountSuggestion[]>;
  initial?: PostingBrief | null;
  submitLabel?: string;
  onSubmit: (input: PostingBriefInput) => Promise<void>;
  onCancel?: () => void;
};

const CONTENT_TYPES: PostingBriefContentType[] = [
  "Trial Reels",
  "Reels",
  "Stories",
  "Carousel",
  "Other",
];
const REGIONS: PostingBriefRegion[] = ["USA", "Greece", "Global"];

function newPostKey(): string {
  return `p_${Math.random().toString(36).slice(2, 9)}`;
}

function emptyPost(): DraftPost {
  return {
    key: newPostKey(),
    placement: "grid",
    content_source: "",
    video_name: "",
    text_on_screen: "",
    caption: "",
    pinned_comment: "",
    notes: "",
  };
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">
      {children}
    </label>
  );
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        VA_FILTER_INPUT,
        "min-h-[88px] w-full resize-y whitespace-pre-wrap font-sans leading-relaxed",
        props.className,
      )}
    />
  );
}

function SortablePostRow({
  post,
  index,
  onChange,
  onRemove,
  canRemove,
  modelId,
}: {
  post: DraftPost;
  index: number;
  onChange: (next: DraftPost) => void;
  onRemove: () => void;
  canRemove: boolean;
  modelId: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: post.key,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-2xl border border-white/[0.1] bg-white/[0.03] p-4"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg p-2 text-white/40 hover:bg-white/5 hover:text-white/70"
            aria-label="Drag to reorder"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
            Post {index + 1}
          </p>
          <select
            value={post.placement ?? "grid"}
            onChange={(e) => onChange({ ...post, placement: e.target.value === "trial" ? "trial" : "grid" })}
            className={cn(VA_FILTER_INPUT, "h-8 py-0 text-xs")}
            aria-label="Placement"
            title="Grid = original goes to the profile grid. Trial = variation goes to trials."
          >
            <option value="grid">Grid</option>
            <option value="trial">Trial</option>
          </select>
          <select
            value={post.content_source ?? ""}
            onChange={(e) =>
              onChange({
                ...post,
                content_source: (["proven", "experimental", "recreation"].includes(e.target.value)
                  ? e.target.value
                  : "") as PostingBriefPostInput["content_source"],
              })
            }
            className={cn(VA_FILTER_INPUT, "h-8 py-0 text-xs")}
            aria-label="Content source"
          >
            <option value="">Source —</option>
            <option value="proven">Proven</option>
            <option value="experimental">Experimental</option>
            <option value="recreation">Recreation</option>
          </select>
        </div>
        {canRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-lg p-2 text-white/35 hover:bg-rose-500/10 hover:text-rose-300"
            aria-label="Remove post"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="grid gap-3">
        <div>
          <FieldLabel>Video name</FieldLabel>
          <input
            value={post.video_name ?? ""}
            onChange={(e) => onChange({ ...post, video_name: e.target.value })}
            className={cn(VA_FILTER_INPUT, "w-full")}
            placeholder="e.g. AGE_REACTION_01"
          />
        </div>
        <div>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <FieldLabel>Text on screen</FieldLabel>
            <BriefAiGenerateButton
              modelId={modelId}
              mode="text_on_screen"
              onResult={(text) => onChange({ ...post, text_on_screen: text })}
            />
          </div>
          <TextArea
            value={post.text_on_screen ?? ""}
            onChange={(e) => onChange({ ...post, text_on_screen: e.target.value })}
            placeholder="Exact text overlays — emoji and line breaks preserved"
          />
        </div>
        <div>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <FieldLabel>Caption</FieldLabel>
            <BriefAiGenerateButton
              modelId={modelId}
              mode="captions"
              onResult={(text) => onChange({ ...post, caption: text })}
            />
          </div>
          <TextArea
            value={post.caption ?? ""}
            onChange={(e) => onChange({ ...post, caption: e.target.value })}
            placeholder="Exact caption — do not rewrite"
          />
        </div>
        <div>
          <FieldLabel>Pinned comment</FieldLabel>
          <TextArea
            value={post.pinned_comment ?? ""}
            onChange={(e) => onChange({ ...post, pinned_comment: e.target.value })}
          />
        </div>
        <div>
          <FieldLabel>Notes</FieldLabel>
          <TextArea
            value={post.notes ?? ""}
            onChange={(e) => onChange({ ...post, notes: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

export function PostingBriefForm({
  models,
  accountSuggestionsByModel,
  initial,
  submitLabel = "Publish brief",
  onSubmit,
  onCancel,
}: Props) {
  const [title, setTitle] = React.useState(initial?.title ?? "");
  const [modelId, setModelId] = React.useState(initial?.model_id ?? "");
  const [accountHandle, setAccountHandle] = React.useState(initial?.account_handle ?? "");
  const [accountType, setAccountType] = React.useState<PostingBriefAccountType>(
    initial?.account_type ?? "main",
  );
  const [region, setRegion] = React.useState<PostingBriefRegion>(initial?.region ?? "Global");
  const [contentType, setContentType] = React.useState<PostingBriefContentType>(
    initial?.content_type ?? "Trial Reels",
  );
  const [priority, setPriority] = React.useState<PostingBriefPriority>(
    initial?.priority ?? "normal",
  );
  const [instructionsNotes, setInstructionsNotes] = React.useState(
    initial?.instructions_notes ?? "",
  );
  const [videoLocationPath, setVideoLocationPath] = React.useState(
    initial?.video_location_path ?? "",
  );
  const [soundName, setSoundName] = React.useState(initial?.sound_name ?? "");
  const [soundLink, setSoundLink] = React.useState(initial?.sound_link ?? "");
  const [soundNotes, setSoundNotes] = React.useState(initial?.sound_notes ?? "");
  const [textStyleNotes, setTextStyleNotes] = React.useState(initial?.text_style_notes ?? "");
  const [timingNotes, setTimingNotes] = React.useState(initial?.timing_notes ?? "");
  const [checklistRaw, setChecklistRaw] = React.useState(
    (initial?.final_checklist ?? []).join("\n"),
  );
  const [posts, setPosts] = React.useState<DraftPost[]>(
    initial?.posts?.length
      ? initial.posts.map((p) => ({
          key: p.id || newPostKey(),
          placement: p.placement ?? "grid",
          content_source: p.content_source ?? "",
          video_name: p.video_name,
          text_on_screen: p.text_on_screen ?? "",
          caption: p.caption,
          pinned_comment: p.pinned_comment ?? "",
          notes: p.notes ?? "",
        }))
      : [emptyPost()],
  );
  const [showPreview, setShowPreview] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const suggestions = accountSuggestionsByModel[modelId] ?? [];
  const modelName = models.find((m) => m.id === modelId)?.model_name ?? "";

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setPosts((items) => {
      const oldIndex = items.findIndex((p) => p.key === active.id);
      const newIndex = items.findIndex((p) => p.key === over.id);
      if (oldIndex < 0 || newIndex < 0) return items;
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  const applySuggestion = (s: AccountSuggestion) => {
    setAccountHandle(s.username.startsWith("@") ? s.username : `@${s.username}`);
    setAccountType(s.account_type);
    const r = s.region === "Greek" || s.region === "Greece" ? "Greece" : s.region === "USA" ? "USA" : "Global";
    setRegion(r as PostingBriefRegion);
  };

  const buildInput = (): PostingBriefInput => ({
    title,
    model_id: modelId,
    editing_brief_id: initial?.editing_brief_id ?? null,
    account_handle: accountHandle,
    account_type: accountType,
    region,
    content_type: contentType,
    priority,
    instructions_notes: instructionsNotes,
    video_location_path: videoLocationPath,
    sound_name: soundName,
    sound_link: soundLink,
    sound_notes: soundNotes,
    text_style_notes: textStyleNotes,
    timing_notes: timingNotes,
    final_checklist: checklistRaw.split("\n").filter((l) => l.length > 0 || l === ""),
    posts: posts.map((p) => ({
      // Existing posts keep their id so the "posted" stage survives an edit.
      ...(initial?.posts?.some((ip) => ip.id === p.key) ? { id: p.key } : {}),
      placement: p.placement ?? "grid",
      content_source: p.content_source ?? "",
      video_name: p.video_name ?? "",
      text_on_screen: p.text_on_screen || null,
      caption: p.caption ?? "",
      pinned_comment: p.pinned_comment || null,
      notes: p.notes || null,
    })),
  });

  const previewBrief: PostingBrief = {
    id: initial?.id ?? "preview",
    ...buildInput(),
    title: title || "Untitled brief",
    model_id: modelId,
    account_handle: accountHandle,
    account_type: accountType,
    region,
    content_type: contentType,
    priority,
    instructions_notes: instructionsNotes,
    video_location_path: videoLocationPath,
    sound_name: soundName,
    sound_link: soundLink,
    sound_notes: soundNotes,
    text_style_notes: textStyleNotes,
    timing_notes: timingNotes,
    final_checklist: checklistRaw.split("\n").filter((l) => l.trim().length > 0),
    status: initial?.status ?? "active",
    editing_brief_id: initial?.editing_brief_id ?? null,
    created_by: initial?.created_by ?? "",
    created_at: initial?.created_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
    posts: posts.map((p, i) => ({
      id: p.key,
      brief_id: initial?.id ?? "preview",
      position: i,
      video_name: p.video_name ?? "",
      text_on_screen: p.text_on_screen || null,
      caption: p.caption ?? "",
      pinned_comment: p.pinned_comment || null,
      notes: p.notes || null,
      posted_url: null,
      posted_at: null,
      posted_by: null,
      placement: p.placement ?? "grid",
      content_source: p.content_source ?? "",
      views_24h: null,
      views_checked_at: null,
      outlier_multiple: null,
      outlier_status: "",
      created_at: "",
      updated_at: "",
    })),
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (!modelId.trim()) {
      setError("Model is required");
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        ...buildInput(),
        final_checklist: checklistRaw.split("\n").filter((l) => l.trim().length > 0),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-28 md:pb-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <FieldLabel>Title</FieldLabel>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={cn(VA_FILTER_INPUT, "w-full text-base")}
            placeholder="AGE REACTION - 3 trial reels"
            required
          />
        </div>
        <div>
          <FieldLabel>Model</FieldLabel>
          <select
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            className={cn(VA_FILTER_INPUT, "w-full")}
            required
          >
            <option value="">Select model…</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.model_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel>Account handle</FieldLabel>
          <input
            value={accountHandle}
            onChange={(e) => setAccountHandle(e.target.value)}
            className={cn(VA_FILTER_INPUT, "w-full")}
            placeholder="@roxana.jsla"
            list={modelId ? `pb-accounts-${modelId}` : undefined}
          />
          {suggestions.length ? (
            <>
              <datalist id={`pb-accounts-${modelId}`}>
                {suggestions.map((s) => (
                  <option key={s.username} value={s.username.startsWith("@") ? s.username : `@${s.username}`} />
                ))}
              </datalist>
              <div className="mt-2 flex flex-wrap gap-2">
                {suggestions.slice(0, 6).map((s) => (
                  <button
                    key={s.username}
                    type="button"
                    onClick={() => applySuggestion(s)}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/60 hover:border-[#D4AF8C]/30 hover:text-[#D4AF8C]"
                  >
                    @{s.username.replace(/^@/, "")}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>
        <div>
          <FieldLabel>Account type</FieldLabel>
          <select
            value={accountType}
            onChange={(e) => setAccountType(e.target.value as PostingBriefAccountType)}
            className={cn(VA_FILTER_INPUT, "w-full")}
          >
            <option value="main">Main</option>
            <option value="secondary">Secondary</option>
          </select>
        </div>
        <div>
          <FieldLabel>Region</FieldLabel>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value as PostingBriefRegion)}
            className={cn(VA_FILTER_INPUT, "w-full")}
          >
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel>Content type</FieldLabel>
          <select
            value={contentType}
            onChange={(e) => setContentType(e.target.value as PostingBriefContentType)}
            className={cn(VA_FILTER_INPUT, "w-full")}
          >
            {CONTENT_TYPES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel>Priority</FieldLabel>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as PostingBriefPriority)}
            className={cn(VA_FILTER_INPUT, "w-full")}
          >
            <option value="normal">Normal</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
      </div>

      <div>
        <FieldLabel>Instructions / notes</FieldLabel>
        <TextArea
          value={instructionsNotes}
          onChange={(e) => setInstructionsNotes(e.target.value)}
          placeholder="How this works — free text"
        />
      </div>

      <div>
        <FieldLabel>Video location path</FieldLabel>
        <TextArea
          value={videoLocationPath}
          onChange={(e) => setVideoLocationPath(e.target.value)}
          placeholder="iCloud folder path exactly as typed"
          className="min-h-[64px]"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <FieldLabel>Sound name</FieldLabel>
          <input
            value={soundName}
            onChange={(e) => setSoundName(e.target.value)}
            className={cn(VA_FILTER_INPUT, "w-full")}
          />
        </div>
        <div>
          <FieldLabel>Sound link</FieldLabel>
          <input
            value={soundLink}
            onChange={(e) => setSoundLink(e.target.value)}
            className={cn(VA_FILTER_INPUT, "w-full")}
            placeholder="https://…"
          />
        </div>
      </div>
      <div>
        <FieldLabel>Sound notes</FieldLabel>
        <TextArea
          value={soundNotes}
          onChange={(e) => setSoundNotes(e.target.value)}
          placeholder="e.g. start at the chorus, original audio OFF"
          className="min-h-[64px]"
        />
      </div>
      <div>
        <FieldLabel>Text style notes</FieldLabel>
        <TextArea
          value={textStyleNotes}
          onChange={(e) => setTextStyleNotes(e.target.value)}
          placeholder="Font, position, max lines…"
        />
      </div>
      <div>
        <FieldLabel>Timing notes</FieldLabel>
        <TextArea
          value={timingNotes}
          onChange={(e) => setTimingNotes(e.target.value)}
          placeholder="e.g. post 1, wait 1 hour, post 2…"
        />
      </div>
      <div>
        <FieldLabel>Final checklist (one line per item)</FieldLabel>
        <TextArea
          value={checklistRaw}
          onChange={(e) => setChecklistRaw(e.target.value)}
          placeholder={"Trial toggle ON\nHashtags checked\n…"}
        />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <FieldLabel>Posts</FieldLabel>
          <button
            type="button"
            onClick={() => setPosts((p) => [...p, emptyPost()])}
            className={cn(VA_BTN_SECONDARY, "inline-flex items-center gap-1.5 !px-3 !py-2 text-xs")}
          >
            <Plus className="h-3.5 w-3.5" />
            Add post
          </button>
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={posts.map((p) => p.key)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {posts.map((post, index) => (
                <SortablePostRow
                  key={post.key}
                  post={post}
                  index={index}
                  modelId={modelId}
                  canRemove={posts.length > 1}
                  onChange={(next) =>
                    setPosts((all) => all.map((p) => (p.key === post.key ? next : p)))
                  }
                  onRemove={() => setPosts((all) => all.filter((p) => p.key !== post.key))}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      {showPreview ? (
        <div className="rounded-3xl border border-[#D4AF8C]/20 bg-black/20 p-4 md:p-6">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#D4AF8C]/70">
            Live preview
          </p>
          <PostingBriefView brief={previewBrief} modelName={modelName} />
        </div>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#0A0A0A]/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md md:static md:border-0 md:bg-transparent md:p-0 md:pt-2 md:backdrop-blur-none">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3">
          <button type="submit" disabled={saving} className={cn(VA_BTN_PRIMARY, "min-h-12 px-5")}>
            {saving ? "Saving…" : submitLabel}
          </button>
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className={cn(VA_BTN_SECONDARY, "min-h-12 px-5")}
          >
            {showPreview ? "Hide preview" : "Preview"}
          </button>
          {onCancel ? (
            <button type="button" onClick={onCancel} className={cn(VA_BTN_SECONDARY, "min-h-12 px-5")}>
              Cancel
            </button>
          ) : null}
        </div>
      </div>
    </form>
  );
}
