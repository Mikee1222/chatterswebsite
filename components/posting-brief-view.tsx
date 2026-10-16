"use client";

import * as React from "react";
import {
  Check,
  Clock,
  Copy,
  Film,
  FolderOpen,
  Link2,
  ListChecks,
  Music,
  Type,
} from "lucide-react";
import type { PostingBrief, PostingBriefPost } from "@/services/posting-briefs";
import { cn } from "@/lib/utils";

type Props = {
  brief: PostingBrief;
  modelName?: string;
  className?: string;
};

async function copyExact(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = React.useState(false);
  if (!text) return null;
  return (
    <button
      type="button"
      onClick={async () => {
        const ok = await copyExact(text);
        if (ok) {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        }
      }}
      className={cn(
        "inline-flex min-h-11 min-w-[5.5rem] items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition",
        "border border-[#D4AF8C]/35 bg-[#D4AF8C]/12 text-[#E8D5B5] active:scale-[0.98]",
        "hover:border-[#D4AF8C]/55 hover:bg-[#D4AF8C]/18",
      )}
      aria-label={`Copy ${label}`}
    >
      {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/[0.1] bg-white/[0.03] p-4 md:p-5">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-[#D4AF8C]/80" aria-hidden />
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#D4AF8C]/75">
          {title}
        </h3>
      </div>
      {children}
    </section>
  );
}

function PreText({ value }: { value: string }) {
  if (!value) return <p className="text-sm text-white/35">—</p>;
  return (
    <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-white/85">
      {value}
    </pre>
  );
}

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
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
              Text on screen
            </p>
            <CopyButton text={post.text_on_screen} label="text on screen" />
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-black/30 p-3">
            <PreText value={post.text_on_screen} />
          </div>
        </div>
      ) : null}

      <div className="mb-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
            Caption
          </p>
          <CopyButton text={post.caption} label="caption" />
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-black/30 p-3">
          <PreText value={post.caption} />
        </div>
      </div>

      {post.pinned_comment != null && post.pinned_comment !== "" ? (
        <div className="mb-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
              Pinned comment
            </p>
            <CopyButton text={post.pinned_comment} label="pinned comment" />
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-black/30 p-3">
            <PreText value={post.pinned_comment} />
          </div>
        </div>
      ) : null}

      {post.notes != null && post.notes !== "" ? (
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
            Notes
          </p>
          <PreText value={post.notes} />
        </div>
      ) : null}
    </div>
  );
}

export function PostingBriefView({ brief, modelName, className }: Props) {
  return (
    <div className={cn("space-y-4", className)}>
      <header className="rounded-3xl border border-[#D4AF8C]/15 bg-gradient-to-br from-[#151315] via-[#0D0B0D] to-[#120810] px-5 py-6 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#D4AF8C]/70">
              Posting brief
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">
              {brief.title}
            </h1>
            <p className="mt-2 text-sm text-white/55">
              {modelName || "Model"}
              {brief.account_handle ? ` · ${brief.account_handle.startsWith("@") ? brief.account_handle : `@${brief.account_handle}`}` : ""}
              {` · ${brief.content_type}`}
              {` · ${brief.region}`}
              {` · ${brief.account_type}`}
            </p>
          </div>
          {brief.priority === "urgent" ? (
            <span className="rounded-full border border-rose-400/40 bg-rose-500/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-rose-200">
              Urgent
            </span>
          ) : null}
        </div>
        {brief.instructions_notes ? (
          <div className="mt-4 rounded-2xl border border-white/[0.08] bg-black/25 p-4">
            <PreText value={brief.instructions_notes} />
          </div>
        ) : null}
      </header>

      <Section icon={FolderOpen} title="Video">
        <PreText value={brief.video_location_path || "—"} />
      </Section>

      <Section icon={Film} title="Posts">
        <div className="space-y-3">
          {brief.posts.length ? (
            brief.posts.map((post, i) => <PostCard key={post.id || i} post={post} index={i} />)
          ) : (
            <p className="text-sm text-white/35">No posts yet.</p>
          )}
        </div>
      </Section>

      <Section icon={Music} title="Sound">
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
                className="inline-flex items-center gap-1 text-[#D4AF8C] underline-offset-2 hover:underline"
              >
                <Link2 className="h-3.5 w-3.5" aria-hidden />
                Open sound
              </a>
            </p>
          ) : null}
          {brief.sound_notes ? <PreText value={brief.sound_notes} /> : null}
        </div>
      </Section>

      <Section icon={Type} title="Text style">
        <PreText value={brief.text_style_notes || "—"} />
      </Section>

      <Section icon={Clock} title="Timing">
        <PreText value={brief.timing_notes || "—"} />
      </Section>

      <Section icon={ListChecks} title="Final check">
        {brief.final_checklist.length ? (
          <ul className="space-y-2">
            {brief.final_checklist.map((line, i) => (
              <li key={i} className="flex gap-2 text-sm text-white/80">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#D4AF8C]/70" />
                <span className="whitespace-pre-wrap break-words">{line}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-white/35">—</p>
        )}
      </Section>
    </div>
  );
}
