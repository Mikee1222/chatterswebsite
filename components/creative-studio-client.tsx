"use client";

import * as React from "react";
import Link from "next/link";
import {
  Bookmark,
  FileText,
  Instagram,
  Languages,
  RefreshCw,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  Type,
  Video,
  AlertTriangle,
  Facebook,
  Trophy,
} from "lucide-react";
import { ROUTES } from "@/lib/routes";
import type { CreativeIdea } from "@/lib/creative-studio-types";
import type { PersonaListSummary } from "@/lib/persona-types";
import { COMPLETE_THRESHOLD, formatRelativeShort } from "@/lib/persona-completeness";
import { CreativeStudioVideoAnalyzer } from "@/components/creative-studio-video-analyzer";
import { CreativeStudioWinnerBreakdown } from "@/components/creative-studio-winner-breakdown";
import { CreativeStudioDraftBriefs } from "@/components/creative-studio-draft-briefs";
import {
  CompletenessRing,
  ModelAvatar,
  PlatformChip,
  PsCopyButton,
  PsEmptyState,
  PsFieldLabel as FieldLabel,
  PsInput,
  PsPageHeader,
  PsTextArea,
  ResultCard,
  SearchFilterRow,
  StreamingSkeleton,
  VA_BTN_PRIMARY,
  VA_BTN_SECONDARY,
  VA_CARD,
  VA_CARD_GLOW,
  VA_FILTER_INPUT,
  cn,
} from "@/components/personas-studio/shared";
import { CustomSelect } from "@/components/ui/custom-select";

type ModelOpt = { id: string; model_name: string };
type BriefOpt = { id: string; title: string; model_id: string };
type PersonaMeta = Pick<
  PersonaListSummary,
  | "model_id"
  | "has_birth_date"
  | "is_adult"
  | "persona_type"
  | "completeness"
  | "has_live_updates"
>;

type Tab = "breakdown" | "captions" | "tos" | "analyzer" | "saved";

type Props = {
  models: ModelOpt[];
  briefs: BriefOpt[];
  canPushBrief: boolean;
  personaMeta: PersonaMeta[];
  canViewPersonas: boolean;
  /** Which brief modules the user can create drafts in (Winner Breakdown → Draft briefs). */
  briefPerms?: { editing: boolean; recording: boolean; posting: boolean };
};

const PLATFORMS: Array<{
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "Instagram", label: "Instagram", icon: Instagram },
  { id: "TikTok", label: "TikTok", icon: Video },
  { id: "Facebook", label: "Facebook", icon: Facebook },
  { id: "Snapchat", label: "Snapchat", icon: Sparkles },
];

export function CreativeStudioClient({
  models,
  briefs,
  canPushBrief,
  personaMeta,
  canViewPersonas,
  briefPerms = { editing: false, recording: false, posting: false },
}: Props) {
  const [modelId, setModelId] = React.useState(models[0]?.id ?? "");
  const [tab, setTab] = React.useState<Tab>("breakdown");
  React.useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const qModel = sp.get("model")?.trim() ?? "";
      const qTab = sp.get("tab")?.trim();
      if (qModel && models.some((m) => m.id === qModel)) setModelId(qModel);
      if (qTab === "breakdown" || qTab === "winner") setTab("breakdown");
      else if (qTab === "video" || qTab === "analyzer") setTab("analyzer");
      else if (qTab === "tos") setTab("tos");
      else if (qTab === "ideas" || qTab === "saved") setTab("saved");
      else if (qTab === "captions") setTab("captions");
    } catch {
      /* ignore */
    }
  }, [models]);
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
  const [rateLimited, setRateLimited] = React.useState(false);
  const [ideas, setIdeas] = React.useState<CreativeIdea[]>([]);
  const [briefId, setBriefId] = React.useState("");
  const [ideaSearch, setIdeaSearch] = React.useState("");
  const [ideaTypeFilter, setIdeaTypeFilter] = React.useState<"all" | "caption" | "text_on_screen">(
    "all",
  );
  const [favOnly, setFavOnly] = React.useState(false);
  const [selectedIdeas, setSelectedIdeas] = React.useState<Set<string>>(new Set());

  const metaById = React.useMemo(
    () => new Map(personaMeta.map((p) => [p.model_id, p])),
    [personaMeta],
  );
  const currentMeta = metaById.get(modelId);
  const modelName = models.find((m) => m.id === modelId)?.model_name ?? "";
  const modelBriefs = briefs.filter((b) => b.model_id === modelId);
  const generationBlocked =
    currentMeta != null && (!currentMeta.has_birth_date || !currentMeta.is_adult);
  const incomplete =
    currentMeta != null && currentMeta.completeness < COMPLETE_THRESHOLD;

  React.useEffect(() => {
    if (!modelId) return;
    void fetch(`/api/creative-studio/ideas?modelId=${encodeURIComponent(modelId)}`)
      .then((r) => r.json())
      .then((d: { ideas?: CreativeIdea[] }) => setIdeas(d.ideas ?? []))
      .catch(() => setIdeas([]));
  }, [modelId]);

  async function generate(opts?: { variationsOverride?: number; replaceIndex?: number }) {
    if (!modelId || generationBlocked) return;
    setBusy(true);
    setError(null);
    setMeta(null);
    setRateLimited(false);
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
          variations: opts?.variationsOverride ?? variations,
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
      if (res.status === 429 || (data.error ?? "").includes("Rate limit")) {
        setRateLimited(true);
        setError(data.error ?? "Rate limit exceeded — try again next hour");
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "Failed");
        return;
      }
      if (data.generationDisabledReason) {
        setError(data.generationDisabledReason);
        if (opts?.replaceIndex == null) setOutputs([]);
        return;
      }
      const next = data.variations ?? [];
      if (opts?.replaceIndex != null && next[0]) {
        setOutputs((prev) => {
          const copy = [...prev];
          copy[opts.replaceIndex!] = next[0]!;
          return copy;
        });
      } else {
        setOutputs(next);
      }
      setAllowlistKeys(data.allowlistKeysUsed ?? []);
      setMeta(
        [data.cached ? "cached" : "fresh", data.droppedRegenRounds ? `regen×${data.droppedRegenRounds}` : null]
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

  async function thumbThenSave(content: string, thumbs: 1 | -1) {
    const ideaType = tab === "tos" ? "text_on_screen" : "caption";
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
    if (data.idea) {
      setIdeas((prev) => [data.idea!, ...prev]);
      await patchIdea(data.idea.id, { thumbs });
    }
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
    { id: "breakdown", label: "Winner Breakdown", icon: <Trophy className="h-3.5 w-3.5" /> },
    { id: "captions", label: "Captions", icon: <FileText className="h-3.5 w-3.5" /> },
    { id: "tos", label: "Text on Screen", icon: <Type className="h-3.5 w-3.5" /> },
    { id: "analyzer", label: "Video Analyzer", icon: <Video className="h-3.5 w-3.5" /> },
    { id: "saved", label: "Saved Ideas", icon: <Bookmark className="h-3.5 w-3.5" /> },
  ];

  const filteredIdeas = React.useMemo(() => {
    const q = ideaSearch.trim().toLowerCase();
    return ideas.filter((idea) => {
      if (ideaTypeFilter !== "all" && idea.idea_type !== ideaTypeFilter) return false;
      if (favOnly && !idea.is_favourite) return false;
      if (q && !idea.content.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [ideas, ideaSearch, ideaTypeFilter, favOnly]);

  async function bulkCopy() {
    const texts = filteredIdeas
      .filter((i) => selectedIdeas.has(i.id))
      .map((i) => i.content);
    if (!texts.length) return;
    try {
      await navigator.clipboard.writeText(texts.join("\n\n———\n\n"));
      setMeta(`Copied ${texts.length} ideas`);
    } catch {
      setError("Copy failed");
    }
  }

  const examples =
    tab === "tos"
      ? ["soft morning light", "say my name", "don't scroll"]
      : ["soft launch energy", "sunday reset", "main character walk"];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6">
      <PsPageHeader
        eyebrow="Creative"
        title="AI Creative Studio"
        description="Break down winners into their viral elements, then persona-grounded, platform-safe captions and on-screen hooks. Sensitive persona sections never reach the model."
        icon={Sparkles}
      />

      {/* Header card: model + persona status */}
      <div className={cn(VA_CARD, VA_CARD_GLOW, "mb-5 border border-white/[0.08] p-4 md:p-5")}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <ModelAvatar name={modelName || "?"} size={52} />
          <div className="min-w-0 flex-1 space-y-2">
            <FieldLabel>Model</FieldLabel>
            <CustomSelect
              portaled
              value={modelId}
              onChange={(v) => {
                setModelId(v);
                setOutputs([]);
                setBriefId("");
                setError(null);
              }}
              options={models.map((m) => ({ value: m.id, label: m.model_name }))}
              triggerClassName={cn(VA_FILTER_INPUT, "min-h-11 w-full max-w-md")}
            />
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {currentMeta?.persona_type ? (
                <span className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/55">
                  {currentMeta.persona_type}
                </span>
              ) : (
                <span className="text-[11px] text-white/35">No persona type set</span>
              )}
              {currentMeta ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] text-white/45">
                  <CompletenessRing value={currentMeta.completeness} size={22} stroke={2} />
                  {Math.round(currentMeta.completeness * 100)}% complete
                </span>
              ) : null}
              {currentMeta?.has_live_updates ? (
                <span className="text-[11px] text-emerald-300/80">Live updates on</span>
              ) : null}
            </div>
          </div>
        </div>

        {generationBlocked && (
          <div className="mt-4 flex flex-wrap items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-sm text-amber-100/90">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">AI generation disabled</p>
              <p className="mt-0.5 text-xs text-amber-100/70">
                Birth date required and must be 18+.
                {canViewPersonas ? (
                  <>
                    {" "}
                    <Link
                      href={ROUTES.persona(modelId)}
                      className="underline decoration-[#D4AF8C]/50 underline-offset-2"
                    >
                      Fix in Model Personas
                    </Link>
                  </>
                ) : null}
              </p>
            </div>
          </div>
        )}

        {!generationBlocked && incomplete && canViewPersonas && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-xs text-white/55">
            <span>Persona is incomplete — richer profiles improve captions.</span>
            <Link
              href={ROUTES.persona(modelId)}
              className="min-h-11 inline-flex items-center text-[#D4AF8C] underline-offset-2 hover:underline"
            >
              Complete persona
            </Link>
          </div>
        )}

        {rateLimited && (
          <p className="mt-3 text-xs text-rose-300/90">
            Rate limit reached for this hour (40 calls). Try again later.
          </p>
        )}
      </div>

      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              if (t.id !== "saved" && t.id !== "analyzer" && t.id !== "breakdown") setOutputs([]);
              setError(null);
            }}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2.5 text-xs font-medium",
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

      {tab === "breakdown" ? (
        <div className={cn(VA_CARD, "p-4 md:p-6")}>
          <CreativeStudioWinnerBreakdown
            modelId={modelId}
            modelName={modelName}
            onUseForCaptions={(ctx) => {
              setIdeaContext(ctx);
              setTab("captions");
            }}
            onUseForTos={(ctx) => {
              setIdeaContext(ctx);
              setTab("tos");
            }}
            renderActions={({ id }) => (
              <CreativeStudioDraftBriefs
                breakdownId={id}
                models={models}
                defaultModelId={modelId}
                perms={briefPerms}
              />
            )}
          />
        </div>
      ) : tab === "analyzer" ? (
        <div className={cn(VA_CARD, "p-4 md:p-6")}>
          <CreativeStudioVideoAnalyzer
            modelId={modelId}
            disabled={generationBlocked}
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
      ) : tab === "saved" ? (
        <div className="space-y-4">
          <div className={cn(VA_CARD, "space-y-3 p-4")}>
            <SearchFilterRow search={ideaSearch} onSearch={setIdeaSearch} />
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["all", "All"],
                  ["caption", "Captions"],
                  ["text_on_screen", "Text on screen"],
                ] as const
              ).map(([id, label]) => (
                <PlatformChip
                  key={id}
                  label={label}
                  selected={ideaTypeFilter === id}
                  onClick={() => setIdeaTypeFilter(id)}
                />
              ))}
              <PlatformChip
                label="Favourites"
                selected={favOnly}
                onClick={() => setFavOnly((v) => !v)}
                icon={Star}
              />
              {selectedIdeas.size > 0 && (
                <button
                  type="button"
                  className={cn(VA_BTN_SECONDARY, "min-h-11 px-3 text-xs")}
                  onClick={() => void bulkCopy()}
                >
                  Copy selected ({selectedIdeas.size})
                </button>
              )}
            </div>
          </div>

          {filteredIdeas.length === 0 ? (
            <PsEmptyState
              title="No saved ideas"
              description="Generate captions or text on screen, then tap Save idea."
              icon={Bookmark}
            />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {filteredIdeas.map((idea) => (
                <li
                  key={idea.id}
                  className={cn(
                    VA_CARD,
                    "flex flex-col gap-3 border border-white/[0.06] p-4",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <label className="flex min-h-11 items-center gap-2 text-[10px] uppercase tracking-wider text-white/35">
                      <input
                        type="checkbox"
                        checked={selectedIdeas.has(idea.id)}
                        onChange={(e) => {
                          setSelectedIdeas((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(idea.id);
                            else next.delete(idea.id);
                            return next;
                          });
                        }}
                      />
                      {idea.idea_type.replace(/_/g, " ")}
                      {idea.platform ? ` · ${idea.platform}` : ""}
                    </label>
                    <PsCopyButton text={idea.content} className="!min-h-11" />
                  </div>
                  <pre className="whitespace-pre-wrap break-words font-sans text-sm text-white/85">
                    {idea.content}
                  </pre>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className={cn(
                        "inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl",
                        idea.is_favourite ? "text-[#D4AF8C]" : "text-white/25",
                      )}
                      onClick={() =>
                        void patchIdea(idea.id, { is_favourite: !idea.is_favourite })
                      }
                      aria-label="Favourite"
                    >
                      <Star
                        className="h-4 w-4"
                        fill={idea.is_favourite ? "currentColor" : "none"}
                      />
                    </button>
                    <button
                      type="button"
                      className={cn(
                        "inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl",
                        idea.thumbs === 1 ? "text-emerald-400" : "text-white/25",
                      )}
                      onClick={() =>
                        void patchIdea(idea.id, { thumbs: idea.thumbs === 1 ? 0 : 1 })
                      }
                      aria-label="Thumbs up"
                    >
                      <ThumbsUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className={cn(
                        "inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl",
                        idea.thumbs === -1 ? "text-red-300" : "text-white/25",
                      )}
                      onClick={() =>
                        void patchIdea(idea.id, { thumbs: idea.thumbs === -1 ? 0 : -1 })
                      }
                      aria-label="Thumbs down"
                    >
                      <ThumbsDown className="h-4 w-4" />
                    </button>
                    <span className="ml-auto text-[10px] text-white/25">
                      {formatRelativeShort(idea.updated_at || idea.created_at)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          <div className={cn(VA_CARD, "space-y-4 p-4 md:p-5")}>
            {tab === "captions" && (
              <>
                <div>
                  <FieldLabel>Platform</FieldLabel>
                  <div className="flex flex-wrap gap-2">
                    {PLATFORMS.map((p) => (
                      <PlatformChip
                        key={p.id}
                        label={p.label}
                        icon={p.icon}
                        selected={platform === p.id}
                        onClick={() => setPlatform(p.id)}
                      />
                    ))}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <FieldLabel>Format</FieldLabel>
                    <select
                      className={cn(VA_FILTER_INPUT, "min-h-11 w-full")}
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
                    <PsInput
                      type="number"
                      min={1}
                      max={5}
                      value={variations}
                      onChange={(e) => setVariations(Number(e.target.value) || 1)}
                    />
                  </div>
                  <div>
                    <FieldLabel>Hashtag count</FieldLabel>
                    <PsInput
                      type="number"
                      min={0}
                      max={15}
                      value={hashtagCount}
                      onChange={(e) => setHashtagCount(Number(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <FieldLabel>Language</FieldLabel>
                    <div className="relative">
                      <Languages className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                      <PsInput
                        className="pl-9"
                        value={outputLanguage}
                        onChange={(e) => setOutputLanguage(e.target.value)}
                        placeholder="Default from persona"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {tab === "tos" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <FieldLabel>Max characters</FieldLabel>
                  <PsInput
                    type="number"
                    min={12}
                    max={80}
                    value={maxChars}
                    onChange={(e) => setMaxChars(Number(e.target.value) || 40)}
                  />
                  <input
                    type="range"
                    min={12}
                    max={80}
                    value={maxChars}
                    onChange={(e) => setMaxChars(Number(e.target.value))}
                    className="mt-2 w-full"
                  />
                </div>
                <div>
                  <FieldLabel>Variations (1–5)</FieldLabel>
                  <PsInput
                    type="number"
                    min={1}
                    max={5}
                    value={variations}
                    onChange={(e) => setVariations(Number(e.target.value) || 1)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <FieldLabel>Language</FieldLabel>
                  <PsInput
                    value={outputLanguage}
                    onChange={(e) => setOutputLanguage(e.target.value)}
                    placeholder="Default from persona languages"
                  />
                </div>
              </div>
            )}

            <div>
              <FieldLabel>Idea / context (optional)</FieldLabel>
              <PsTextArea
                value={ideaContext}
                onChange={(e) => setIdeaContext(e.target.value)}
                placeholder="From video analyzer or your own notes…"
              />
            </div>
            <div>
              <FieldLabel>Tone tweak</FieldLabel>
              <PsInput
                value={toneTweak}
                onChange={(e) => setToneTweak(e.target.value)}
                placeholder="e.g. softer, more playful…"
              />
            </div>

            <button
              type="button"
              className={cn(VA_BTN_PRIMARY, "w-full min-h-11 sm:w-auto")}
              disabled={busy || !modelId || generationBlocked}
              onClick={() => void generate()}
            >
              {busy ? "Generating…" : "Generate"}
            </button>
            {error && <p className="text-sm text-red-300/90">{error}</p>}
            {meta && <p className="text-[11px] text-white/35">{meta}</p>}
            {allowlistKeys.length > 0 && (
              <p className="text-[10px] leading-relaxed text-white/25">
                Persona applied · {allowlistKeys.join(", ")}
              </p>
            )}
          </div>

          <div className={cn(VA_CARD, "p-4 md:p-5")}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">
                Results
              </p>
              {canPushBrief && modelBriefs.length > 0 && (
                <select
                  className={cn(VA_FILTER_INPUT, "min-h-11 max-w-xs")}
                  value={briefId}
                  onChange={(e) => setBriefId(e.target.value)}
                  aria-label="Posting brief"
                >
                  <option value="">Posting brief…</option>
                  {modelBriefs.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {busy && outputs.length === 0 ? (
              <StreamingSkeleton count={Math.min(variations, 3)} />
            ) : outputs.length > 0 ? (
              <ul className="space-y-3">
                {outputs.map((text, i) => (
                  <ResultCard
                    key={i}
                    index={i}
                    text={text}
                    actions={
                      <>
                        <PsCopyButton text={text} />
                        <button
                          type="button"
                          className={cn(VA_BTN_SECONDARY, "min-h-11 px-3 text-xs")}
                          onClick={() =>
                            void saveOutput(
                              text,
                              tab === "tos" ? "text_on_screen" : "caption",
                            )
                          }
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-white/10 text-white/40"
                          aria-label="Thumbs up"
                          onClick={() => void thumbThenSave(text, 1)}
                        >
                          <ThumbsUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-white/10 text-white/40"
                          aria-label="Thumbs down"
                          onClick={() => void thumbThenSave(text, -1)}
                        >
                          <ThumbsDown className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className={cn(VA_BTN_SECONDARY, "min-h-11 gap-1.5 px-3 text-xs")}
                          disabled={busy || generationBlocked}
                          onClick={() =>
                            void generate({ variationsOverride: 1, replaceIndex: i })
                          }
                        >
                          <RefreshCw className="h-3.5 w-3.5" /> One
                        </button>
                        {canPushBrief && (
                          <button
                            type="button"
                            className={cn(VA_BTN_SECONDARY, "min-h-11 px-3 text-xs")}
                            onClick={() =>
                              void pushToBrief(text, tab === "tos" ? "tos" : "caption")
                            }
                          >
                            Use in Posting Brief
                          </button>
                        )}
                      </>
                    }
                  />
                ))}
              </ul>
            ) : (
              <div className="py-10 text-center">
                <p className="text-sm text-white/40">Generate to see variations here</p>
                <p className="mt-3 text-[11px] text-white/30">Try an idea:</p>
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  {examples.map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/50"
                      onClick={() => setIdeaContext(ex)}
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
