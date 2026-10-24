"use client";

import * as React from "react";
import {
  Check,
  Copy,
  FileText,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  Type,
  Video,
} from "lucide-react";
import {
  VA_BTN_PRIMARY,
  VA_BTN_SECONDARY,
  VA_CARD,
  VA_FILTER_INPUT,
  VA_TASKS,
} from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";
import type { CreativeIdea } from "@/lib/creative-studio-types";
import { CreativeStudioVideoAnalyzer } from "@/components/creative-studio-video-analyzer";

type ModelOpt = { id: string; model_name: string };
type BriefOpt = { id: string; title: string; model_id: string };

type Tab = "captions" | "tos" | "analyzer";

type Props = {
  models: ModelOpt[];
  briefs: BriefOpt[];
  canPushBrief: boolean;
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">
      {children}
    </label>
  );
}

function CopyButton({ text }: { text: string }) {
  const [ok, setOk] = React.useState(false);
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[11px] text-white/55 hover:border-[#D4AF8C]/40 hover:text-[#D4AF8C]"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setOk(true);
        setTimeout(() => setOk(false), 1200);
      }}
    >
      {ok ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {ok ? "Copied" : "Copy"}
    </button>
  );
}

export function CreativeStudioClient({ models, briefs, canPushBrief }: Props) {
  const [modelId, setModelId] = React.useState(models[0]?.id ?? "");
  const [tab, setTab] = React.useState<Tab>("captions");
  const [platform, setPlatform] = React.useState("Instagram");
  const [format, setFormat] = React.useState("Reel");
  const [ideaContext, setIdeaContext] = React.useState("");
  const [toneTweak, setToneTweak] = React.useState("");
  const [variations, setVariations] = React.useState(3);
  const [hashtagCount, setHashtagCount] = React.useState(5);
  const [maxChars, setMaxChars] = React.useState(40);
  const [outputLanguage, setOutputLanguage] = React.useState("");
  const [outputs, setOutputs] = React.useState<string[]>([]);
  const [allowlistKeys, setAllowlistKeys] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [meta, setMeta] = React.useState<string | null>(null);
  const [ideas, setIdeas] = React.useState<CreativeIdea[]>([]);
  const [briefId, setBriefId] = React.useState("");

  const modelBriefs = briefs.filter((b) => b.model_id === modelId);

  React.useEffect(() => {
    if (!modelId) return;
    void fetch(`/api/creative-studio/ideas?modelId=${encodeURIComponent(modelId)}`)
      .then((r) => r.json())
      .then((d: { ideas?: CreativeIdea[] }) => setIdeas(d.ideas ?? []))
      .catch(() => setIdeas([]));
  }, [modelId]);

  async function generate() {
    if (!modelId) return;
    setBusy(true);
    setError(null);
    setMeta(null);
    try {
      const res = await fetch("/api/creative-studio/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: tab === "tos" ? "text_on_screen" : "captions",
          modelId,
          platform,
          format,
          ideaContext: ideaContext || undefined,
          toneTweak: toneTweak || undefined,
          variations,
          hashtagCount,
          maxChars,
          outputLanguage: outputLanguage || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        variations?: string[];
        allowlistKeysUsed?: string[];
        cached?: boolean;
        generationDisabledReason?: string;
        droppedRegenRounds?: number;
      };
      if (!res.ok) {
        setError(data.error ?? "Failed");
        return;
      }
      if (data.generationDisabledReason) {
        setError(data.generationDisabledReason);
        setOutputs([]);
        return;
      }
      setOutputs(data.variations ?? []);
      setAllowlistKeys(data.allowlistKeysUsed ?? []);
      setMeta(
        [
          data.cached ? "cached" : "fresh",
          data.droppedRegenRounds
            ? `regen×${data.droppedRegenRounds}`
            : null,
        ]
          .filter(Boolean)
          .join(" · "),
      );
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function saveOutput(content: string, ideaType: "caption" | "text_on_screen") {
    const res = await fetch("/api/creative-studio/ideas", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model_id: modelId,
        idea_type: ideaType,
        platform: tab === "captions" ? platform : "",
        content,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { idea?: CreativeIdea };
    if (data.idea) setIdeas((prev) => [data.idea!, ...prev]);
  }

  async function patchIdea(id: string, patch: Record<string, unknown>) {
    const res = await fetch("/api/creative-studio/ideas", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    const data = (await res.json().catch(() => ({}))) as { idea?: CreativeIdea; ok?: boolean };
    if (patch.delete) {
      setIdeas((prev) => prev.filter((i) => i.id !== id));
      return;
    }
    if (data.idea) setIdeas((prev) => prev.map((i) => (i.id === id ? data.idea! : i)));
  }

  async function pushToBrief(content: string, as: "caption" | "tos") {
    if (!briefId) {
      setError("Select a posting brief first");
      return;
    }
    const res = await fetch("/api/creative-studio/push-to-brief", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        briefId,
        caption: as === "caption" ? content : undefined,
        text_on_screen: as === "tos" ? content : undefined,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean };
    if (!res.ok) setError(data.error ?? "Push failed");
    else setMeta("Pushed to posting brief");
  }

  const tabs: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
    { id: "captions", label: "Captions", icon: <FileText className="h-3.5 w-3.5" /> },
    { id: "tos", label: "Text on Screen", icon: <Type className="h-3.5 w-3.5" /> },
    { id: "analyzer", label: "Video Analyzer", icon: <Video className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6">
      <header className="mb-6">
        <div className="mb-2 flex items-center gap-2 text-[#D4AF8C]">
          <Sparkles className="h-5 w-5" aria-hidden />
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">
            Creative
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
          AI Creative Studio
        </h1>
        <p className="mt-2 max-w-xl text-sm" style={{ color: VA_TASKS.bodyText }}>
          Persona-grounded, platform-safe captions and on-screen hooks. Sensitive persona
          sections never reach the model.
        </p>
      </header>

      <div className={cn(VA_CARD, "mb-4 p-4")}>
        <FieldLabel>Model</FieldLabel>
        <select
          className={cn(VA_FILTER_INPUT, "w-full max-w-md")}
          value={modelId}
          onChange={(e) => {
            setModelId(e.target.value);
            setOutputs([]);
            setBriefId("");
          }}
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.model_name}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4 flex gap-1.5 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              setOutputs([]);
              setError(null);
            }}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-medium",
              tab === t.id
                ? "border-[#FF1493]/50 bg-[#FF1493]/15 text-white"
                : "border-white/10 text-white/55",
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === "analyzer" ? (
        <div className={cn(VA_CARD, "p-6")}>
          <CreativeStudioVideoAnalyzer
            modelId={modelId}
            onUseForCaptions={(ctx) => {
              setIdeaContext(ctx);
              setTab("captions");
            }}
            onUseForTos={(ctx) => {
              setIdeaContext(ctx);
              setTab("tos");
            }}
          />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className={cn(VA_CARD, "space-y-3 p-4")}>
            {tab === "captions" && (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <FieldLabel>Platform</FieldLabel>
                    <select
                      className={cn(VA_FILTER_INPUT, "w-full")}
                      value={platform}
                      onChange={(e) => setPlatform(e.target.value)}
                    >
                      {["Instagram", "TikTok", "Facebook", "Snapchat"].map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <FieldLabel>Format</FieldLabel>
                    <select
                      className={cn(VA_FILTER_INPUT, "w-full")}
                      value={format}
                      onChange={(e) => setFormat(e.target.value)}
                    >
                      {["Reel", "Story", "Carousel", "Feed post"].map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <FieldLabel>Variations (1–5)</FieldLabel>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      className={cn(VA_FILTER_INPUT, "w-full")}
                      value={variations}
                      onChange={(e) => setVariations(Number(e.target.value) || 1)}
                    />
                  </div>
                  <div>
                    <FieldLabel>Hashtag count</FieldLabel>
                    <input
                      type="number"
                      min={0}
                      max={15}
                      className={cn(VA_FILTER_INPUT, "w-full")}
                      value={hashtagCount}
                      onChange={(e) => setHashtagCount(Number(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </>
            )}

            {tab === "tos" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <FieldLabel>Max characters</FieldLabel>
                  <input
                    type="number"
                    min={12}
                    max={80}
                    className={cn(VA_FILTER_INPUT, "w-full")}
                    value={maxChars}
                    onChange={(e) => setMaxChars(Number(e.target.value) || 40)}
                  />
                </div>
                <div>
                  <FieldLabel>Variations (1–5)</FieldLabel>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    className={cn(VA_FILTER_INPUT, "w-full")}
                    value={variations}
                    onChange={(e) => setVariations(Number(e.target.value) || 1)}
                  />
                </div>
              </div>
            )}

            <div>
              <FieldLabel>Idea / context (optional)</FieldLabel>
              <textarea
                className={cn(VA_FILTER_INPUT, "min-h-[80px] w-full resize-y whitespace-pre-wrap")}
                value={ideaContext}
                onChange={(e) => setIdeaContext(e.target.value)}
                placeholder="From video analyzer or your own notes…"
              />
            </div>
            <div>
              <FieldLabel>Tone tweak</FieldLabel>
              <input
                className={cn(VA_FILTER_INPUT, "w-full")}
                value={toneTweak}
                onChange={(e) => setToneTweak(e.target.value)}
                placeholder="e.g. softer, more playful…"
              />
            </div>
            <div>
              <FieldLabel>Output language</FieldLabel>
              <input
                className={cn(VA_FILTER_INPUT, "w-full")}
                value={outputLanguage}
                onChange={(e) => setOutputLanguage(e.target.value)}
                placeholder="Default from persona languages"
              />
            </div>

            <button
              type="button"
              className={cn(VA_BTN_PRIMARY, "w-full sm:w-auto")}
              disabled={busy || !modelId}
              onClick={() => void generate()}
            >
              {busy ? "Generating…" : "Generate"}
            </button>
            {error && <p className="text-sm text-red-300/90">{error}</p>}
            {meta && <p className="text-[11px] text-white/35">{meta}</p>}
            {allowlistKeys.length > 0 && (
              <p className="text-[10px] leading-relaxed text-white/25">
                AI keys: {allowlistKeys.join(", ")}
              </p>
            )}
          </div>

          <div className={cn(VA_CARD, "p-4")}>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">
              Output
            </p>
            {canPushBrief && modelBriefs.length > 0 && (
              <div className="mb-3">
                <FieldLabel>Use in Posting Brief</FieldLabel>
                <select
                  className={cn(VA_FILTER_INPUT, "w-full")}
                  value={briefId}
                  onChange={(e) => setBriefId(e.target.value)}
                >
                  <option value="">Select draft brief…</option>
                  {modelBriefs.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <ul className="space-y-3">
              {outputs.map((text, i) => (
                <li
                  key={i}
                  className="rounded-xl border border-white/[0.06] bg-black/25 p-3"
                >
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-white/90">
                    {text}
                  </pre>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <CopyButton text={text} />
                    <button
                      type="button"
                      className={cn(VA_BTN_SECONDARY, "px-2.5 py-1 text-[11px]")}
                      onClick={() =>
                        void saveOutput(text, tab === "tos" ? "text_on_screen" : "caption")
                      }
                    >
                      Save idea
                    </button>
                    {canPushBrief && (
                      <button
                        type="button"
                        className={cn(VA_BTN_SECONDARY, "px-2.5 py-1 text-[11px]")}
                        onClick={() =>
                          void pushToBrief(text, tab === "tos" ? "tos" : "caption")
                        }
                      >
                        Use in Posting Brief
                      </button>
                    )}
                  </div>
                </li>
              ))}
              {outputs.length === 0 && (
                <li className="py-8 text-center text-sm text-white/30">
                  Generate to see variations here
                </li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* Ideas library */}
      <div className={cn(VA_CARD, "mt-6 p-4")}>
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">
          Saved ideas
        </p>
        <ul className="space-y-2">
          {ideas.map((idea) => (
            <li
              key={idea.id}
              className="flex gap-3 rounded-xl border border-white/[0.05] px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wider text-white/30">
                  {idea.idea_type.replace(/_/g, " ")}
                  {idea.platform ? ` · ${idea.platform}` : ""}
                </p>
                <pre className="mt-1 whitespace-pre-wrap font-sans text-sm text-white/80">
                  {idea.content}
                </pre>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <CopyButton text={idea.content} />
                <div className="flex gap-1">
                  <button
                    type="button"
                    title="Favourite"
                    className={cn(
                      "rounded p-1",
                      idea.is_favourite ? "text-[#D4AF8C]" : "text-white/25",
                    )}
                    onClick={() =>
                      void patchIdea(idea.id, { is_favourite: !idea.is_favourite })
                    }
                  >
                    <Star className="h-3.5 w-3.5" fill={idea.is_favourite ? "currentColor" : "none"} />
                  </button>
                  <button
                    type="button"
                    className={cn("rounded p-1", idea.thumbs === 1 ? "text-emerald-400" : "text-white/25")}
                    onClick={() =>
                      void patchIdea(idea.id, { thumbs: idea.thumbs === 1 ? 0 : 1 })
                    }
                  >
                    <ThumbsUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className={cn("rounded p-1", idea.thumbs === -1 ? "text-red-300" : "text-white/25")}
                    onClick={() =>
                      void patchIdea(idea.id, { thumbs: idea.thumbs === -1 ? 0 : -1 })
                    }
                  >
                    <ThumbsDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </li>
          ))}
          {ideas.length === 0 && (
            <li className="py-4 text-center text-sm text-white/30">No saved ideas yet</li>
          )}
        </ul>
      </div>
    </div>
  );
}
