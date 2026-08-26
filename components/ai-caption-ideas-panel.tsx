"use client";

import * as React from "react";
import { Check, Copy, Loader2, Sparkles } from "lucide-react";
import { VA_BTN_SECONDARY, VA_CARD } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";

type Idea = { caption: string; hashtags: string[] };

type Props = {
  modelRecordId: string;
  modelName?: string;
  topicHint?: string;
  className?: string;
};

export function AiCaptionIdeasPanel({ modelRecordId, modelName, topicHint, className }: Props) {
  const [ideas, setIdeas] = React.useState<Idea[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState<number | null>(null);
  const [grounded, setGrounded] = React.useState<number | null>(null);

  async function generate(force: boolean) {
    if (!modelRecordId.trim()) {
      setError("Select a model first");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/va/ai/caption-ideas", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelRecordId, modelName, topicHint, force }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ideas?: Idea[];
        grounded_post_count?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Failed to generate captions");
      setIdeas(data.ideas ?? []);
      setGrounded(data.grounded_post_count ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function copyIdea(idea: Idea, idx: number) {
    const text = `${idea.caption}\n\n${idea.hashtags.join(" ")}`.trim();
    await navigator.clipboard.writeText(text);
    setCopied(idx);
    window.setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className={cn("space-y-3", className)}>
      <button
        type="button"
        onClick={() => void generate(false)}
        disabled={loading}
        className={cn(VA_BTN_SECONDARY, "inline-flex items-center gap-2")}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        Get AI caption ideas
      </button>
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      {ideas.length > 0 ? (
        <div className={cn(VA_CARD, "space-y-3 p-4")}>
          <p className="text-xs text-white/45">
            Grounded in {grounded ?? 0} top post{grounded === 1 ? "" : "s"} for this model
          </p>
          {ideas.map((idea, idx) => (
            <div key={idx} className="rounded-xl border border-white/10 bg-black/25 p-3">
              <p className="whitespace-pre-wrap text-sm text-white/85">{idea.caption}</p>
              <p className="mt-2 text-xs text-[#FF1493]/80">{idea.hashtags.join(" ")}</p>
              <button
                type="button"
                onClick={() => void copyIdea(idea, idx)}
                className={cn(VA_BTN_SECONDARY, "mt-2 inline-flex items-center gap-1.5 px-2 py-1 text-xs")}
              >
                {copied === idx ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied === idx ? "Copied" : "Copy"}
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
