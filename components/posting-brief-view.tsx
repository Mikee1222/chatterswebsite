"use client";

import * as React from "react";
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Film,
  FolderOpen,
  Link2,
  ListChecks,
  Music,
  Type,
  Undo2,
} from "lucide-react";
import type { PostingBrief, PostingBriefPost } from "@/services/posting-briefs";
import { useToast } from "@/contexts/toast-context";
import { winnerVideoLocalToast } from "@/components/winner-videos-shared";
import { VA_BTN_PRIMARY, VA_BTN_SECONDARY, VA_FILTER_INPUT } from "@/lib/va-tasks-tokens";
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
  /** Called with the fresh brief after a post is marked / unmarked as posted. */
  onBriefChange?: (brief: PostingBrief) => void;
};

function postedCount(brief: Pick<PostingBrief, "posts">): { posted: number; total: number } {
  return {
    posted: brief.posts.filter((p) => !!p.posted_at).length,
    total: brief.posts.length,
  };
}

function formatPostedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * "Posted" stage for one post block. The Marketing Executive pastes the live
 * link once the post is up; the CD gets notified and the Account Supervisor
 * has the link for the 24h check.
 */
function PostedPanel({
  briefId,
  post,
  canEdit,
  onChange,
}: {
  briefId: string;
  post: PostingBriefPost;
  canEdit: boolean;
  onChange?: (brief: PostingBrief) => void;
}) {
  const { addToast } = useToast();
  const [url, setUrl] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const inputId = `posted-url-${post.id}`;

  const call = async (method: "POST" | "DELETE") => {
    if (!canEdit || busy) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/posting-briefs/${encodeURIComponent(briefId)}/posts/${encodeURIComponent(post.id)}/posted`,
        {
          method,
          headers: method === "POST" ? { "Content-Type": "application/json" } : undefined,
          body: method === "POST" ? JSON.stringify({ url }) : undefined,
        },
      );
      const data = (await res.json().catch(() => ({}))) as { brief?: PostingBrief; error?: string };
      if (!res.ok || !data.brief) throw new Error(data.error || "Failed");
      onChange?.(data.brief);
      if (method === "POST") setUrl("");
    } catch (e) {
      addToast(
        winnerVideoLocalToast(
          `pb-posted-${post.id}-${Date.now()}`,
          method === "POST" ? "Could not mark as posted" : "Could not undo",
          e instanceof Error ? e.message : "Try again",
          "high",
        ),
      );
    } finally {
      setBusy(false);
    }
  };

  if (post.posted_at) {
    return (
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-400/25 bg-emerald-400/[0.07] px-3 py-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-1 font-semibold text-emerald-300">
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            Posted
          </span>
          <span className="text-white/45">{formatPostedAt(post.posted_at)}</span>
          {post.posted_url ? (
            <a
              href={post.posted_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 max-w-full items-center gap-1 truncate text-[#D4AF8C] underline-offset-2 hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">{post.posted_url.replace(/^https?:\/\//, "")}</span>
            </a>
          ) : null}
        </div>
        {canEdit ? (
          <button
            type="button"
            onClick={() => void call("DELETE")}
            disabled={busy}
            className={cn(VA_BTN_SECONDARY, "inline-flex min-h-10 items-center gap-1 px-3 py-2 text-xs")}
          >
            <Undo2 className="h-3.5 w-3.5" aria-hidden />
            Undo
          </button>
        ) : null}
      </div>
    );
  }

  if (!canEdit) {
    return (
      <p className="mt-3 text-xs text-white/35">Not posted yet.</p>
    );
  }

  return (
    <form
      className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center"
      onSubmit={(e) => {
        e.preventDefault();
        void call("POST");
      }}
    >
      <label htmlFor={inputId} className="sr-only">
        Live post link
      </label>
      <input
        id={inputId}
        type="url"
        inputMode="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Paste the live post link…"
        className={cn(VA_FILTER_INPUT, "min-w-0 flex-1")}
        disabled={busy}
      />
      <button
        type="submit"
        disabled={busy || !url.trim()}
        className={cn(VA_BTN_PRIMARY, "min-h-10 whitespace-nowrap px-4 py-2 text-xs")}
      >
        {busy ? "Saving…" : "Mark as posted"}
      </button>
    </form>
  );
}

/** Trial check (Content Flow v1.1): Account Supervisor types the trial views (no IG API for trials). Grid is automatic. */
function ViewsCheckPanel({
  briefId,
  post,
  canEdit,
  onChange,
}: {
  briefId: string;
  post: PostingBriefPost;
  canEdit: boolean;
  onChange?: (brief: PostingBrief) => void;
}) {
  const { addToast } = useToast();
  const [views, setViews] = React.useState<string>(post.views_24h == null ? "" : String(post.views_24h));
  const [busy, setBusy] = React.useState(false);
  const inputId = `views-24h-${post.id}`;

  React.useEffect(() => {
    setViews(post.views_24h == null ? "" : String(post.views_24h));
  }, [post.views_24h]);

  const submit = async () => {
    if (!canEdit || busy) return;
    const n = Number(views.replace(/[^\d]/g, ""));
    if (!Number.isFinite(n)) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/posting-briefs/${encodeURIComponent(briefId)}/posts/${encodeURIComponent(post.id)}/views`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ views: n }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        brief?: PostingBrief;
        status?: string;
        multiple?: number | null;
        baseline_count?: number;
        queued?: boolean;
        error?: string;
      };
      if (!res.ok || !data.brief) throw new Error(data.error || "Failed");
      onChange?.(data.brief);
      const label =
        data.status === "hot"
          ? `🔥 HOT ×${data.multiple ?? "?"} — urgent lane`
          : data.status === "outlier"
            ? `Outlier ×${data.multiple ?? "?"} — added to recreation queue`
            : data.baseline_count
              ? `Normal (×${data.multiple ?? "?"} of the last ${data.baseline_count})`
              : "Saved — no baseline yet";
      addToast(winnerVideoLocalToast(`pb-views-${post.id}-${Date.now()}`, "24h check", label, "normal"));
    } catch (e) {
      addToast(
        winnerVideoLocalToast(
          `pb-views-${post.id}-${Date.now()}`,
          "Could not save 24h views",
          e instanceof Error ? e.message : "Try again",
          "high",
        ),
      );
    } finally {
      setBusy(false);
    }
  };

  const badge =
    post.outlier_status === "hot" ? (
      <span className="rounded-md border border-rose-400/40 bg-rose-400/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.1em] text-rose-200">
        🔥 HOT ×{post.outlier_multiple ?? "?"}
      </span>
    ) : post.outlier_status === "outlier" ? (
      <span className="rounded-md border border-amber-400/40 bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.1em] text-amber-200">
        OUTLIER ×{post.outlier_multiple ?? "?"}
      </span>
    ) : post.outlier_status === "normal" ? (
      <span className="rounded-md border border-white/15 bg-white/[0.04] px-1.5 py-0.5 text-[10px] tracking-[0.1em] text-white/50">
        NORMAL{post.outlier_multiple != null ? ` ×${post.outlier_multiple}` : ""}
      </span>
    ) : null;

  if (!canEdit) {
    return post.views_24h != null ? (
      <p className="mt-2 flex items-center gap-2 text-xs text-white/55">
        24h views: <span className="font-semibold text-white/80">{post.views_24h.toLocaleString()}</span>
        {badge}
      </p>
    ) : null;
  }

  return (
    <form
      className="mt-2 flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <label htmlFor={inputId} className="text-xs text-white/55">
        Trial views
      </label>
      <input
        id={inputId}
        type="text"
        inputMode="numeric"
        value={views}
        onChange={(e) => setViews(e.target.value)}
        placeholder="e.g. 12400"
        className={cn(VA_FILTER_INPUT, "w-32")}
        disabled={busy}
      />
      <button
        type="submit"
        disabled={busy || !views.trim()}
        className={cn(VA_BTN_SECONDARY, "min-h-10 whitespace-nowrap px-3 py-2 text-xs")}
      >
        {busy ? "Checking…" : post.views_24h == null ? "Check" : "Update"}
      </button>
      {badge}
      {post.views_checked_at ? (
        <span className="text-[11px] text-white/35">checked {formatPostedAt(post.views_checked_at)}</span>
      ) : null}
    </form>
  );
}

const SECTIONS = [
  { id: "pb-video", label: "Video" },
  { id: "pb-posts", label: "Posts" },
  { id: "pb-sound", label: "Sound" },
  { id: "pb-style", label: "Text style" },
  { id: "pb-timing", label: "Timing" },
  { id: "pb-check", label: "Final check" },
];

function PostCard({
  post,
  index,
  briefId,
  canMarkPosted,
  onBriefChange,
}: {
  post: PostingBriefPost;
  index: number;
  briefId: string;
  canMarkPosted: boolean;
  onBriefChange?: (brief: PostingBrief) => void;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-gradient-to-b from-white/[0.05] to-transparent p-4",
        post.posted_at ? "border-emerald-400/20" : "border-white/[0.1]",
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
          Post {index + 1}
          <span
            className={cn(
              "ml-2 rounded-md border px-1.5 py-0.5 text-[10px] tracking-[0.1em]",
              post.placement === "trial"
                ? "border-sky-400/30 bg-sky-400/10 text-sky-200"
                : "border-[#D4AF8C]/30 bg-[#D4AF8C]/10 text-[#D4AF8C]",
            )}
          >
            {post.placement === "trial" ? "TRIAL" : "GRID"}
          </span>
          {post.content_source ? (
            <span className="ml-1 rounded-md border border-white/15 bg-white/[0.04] px-1.5 py-0.5 text-[10px] tracking-[0.1em] text-white/50">
              {post.content_source.toUpperCase()}
            </span>
          ) : null}
          {post.posted_at ? (
            <span className="ml-2 rounded-md border border-emerald-400/30 bg-emerald-400/10 px-1.5 py-0.5 text-[10px] tracking-[0.1em] text-emerald-300">
              POSTED
            </span>
          ) : null}
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

      <PostedPanel
        briefId={briefId}
        post={post}
        canEdit={canMarkPosted}
        onChange={onBriefChange}
      />
      {post.posted_at && post.placement === "trial" ? (
        <ViewsCheckPanel
          briefId={briefId}
          post={post}
          canEdit={canMarkPosted}
          onChange={onBriefChange}
        />
      ) : null}
    </div>
  );
}

export function PostingBriefView({
  brief,
  modelName,
  className,
  editingBriefId,
  onBriefChange,
}: Props) {
  // Preview briefs (unsaved form) have no real ids — no posted controls there.
  const canMarkPosted = brief.id !== "preview" && brief.status === "active";
  const { posted, total } = postedCount(brief);
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
              {total > 0 ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]",
                    posted === total
                      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                      : "border-white/15 bg-white/[0.04] text-white/60",
                  )}
                  title="Posts marked as posted"
                >
                  <CheckCircle2 className="h-3 w-3" aria-hidden />
                  Posted {posted}/{total}
                </span>
              ) : null}
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
                  <PostCard
                    key={post.id || i}
                    post={post}
                    index={i}
                    briefId={brief.id}
                    canMarkPosted={canMarkPosted}
                    onBriefChange={onBriefChange}
                  />
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
