"use client";

import * as React from "react";
import { ChevronDown, ExternalLink, FileText, History, Loader2 } from "lucide-react";
import {
  FindingCard,
  ManagerReviewSelect,
  ManagerReviewTextarea,
  ReviewEmptyState,
  ReviewFieldLabel,
  ReviewFormSection,
  ReviewLoadingState,
  ReviewPageEyebrow,
  ReviewSectionHeader,
  VA_BTN_PRIMARY,
  VA_BTN_SECONDARY,
  displayOrDash,
  type CustomSelectOption,
} from "@/components/manager-review-ui";
import { useToast } from "@/contexts/toast-context";
import { SCRIPT_VIDEO_TYPES } from "@/lib/creative-scripts-helpers";
import { truncateNote } from "@/lib/winner-videos-copy";
import { winnerVideoLocalToast } from "@/components/winner-videos-shared";
import type { WinnerVideoRecord } from "@/services/winner-videos";
import type {
  BunchScriptProgress,
  SlotScriptMeta,
} from "@/services/winner-sourcing";
import type { ModelRecord } from "@/types";
import { useIsSupabaseBackend } from "@/contexts/data-backend-context";
import { useSupabaseRealtimeRefresh } from "@/lib/hooks/use-supabase-realtime";
import { slotVideoTypeLabel } from "@/lib/winner-sourcing-helpers";
import { cn } from "@/lib/utils";
import { CreativeScriptsHistory } from "@/components/creative-scripts-history";

type Props = {
  initialQueue: WinnerVideoRecord[];
  initialHistory?: WinnerVideoRecord[];
  initialBunchProgress?: BunchScriptProgress[];
  initialSlotMeta?: SlotScriptMeta[];
  gunzoModels: ModelRecord[];
};

function resolveModelId(video: WinnerVideoRecord, models: ModelRecord[]): string {
  const name = video.assigned_creator_name?.trim();
  if (!name) return "";
  const match = models.find((m) => m.model_name.trim() === name);
  return match?.id ?? `custom:${name}`;
}

function modelNameFromSelection(modelId: string, models: ModelRecord[]): string {
  if (modelId.startsWith("custom:")) return modelId.slice("custom:".length);
  return models.find((m) => m.id === modelId)?.model_name ?? "";
}

type QueueGroup = {
  key: string;
  title: string;
  progress?: BunchScriptProgress;
  videos: WinnerVideoRecord[];
};

export function CreativeScriptsQueueClient({
  initialQueue,
  initialHistory = [],
  initialBunchProgress = [],
  initialSlotMeta = [],
  gunzoModels,
}: Props) {
  const { addToast } = useToast();
  const isSupabaseBackend = useIsSupabaseBackend();
  const [queue, setQueue] = React.useState(initialQueue);
  const [history, setHistory] = React.useState(initialHistory);
  const [bunchProgress, setBunchProgress] = React.useState(initialBunchProgress);
  const [slotMeta, setSlotMeta] = React.useState(initialSlotMeta);
  const [loading, setLoading] = React.useState(false);
  const [tab, setTab] = React.useState<"write" | "history">("write");
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [modelId, setModelId] = React.useState("");
  const [scriptType, setScriptType] = React.useState("");
  const [scriptText, setScriptText] = React.useState("");
  const [textOnScreen, setTextOnScreen] = React.useState("");
  const [textOnScreenOpen, setTextOnScreenOpen] = React.useState(false);

  React.useEffect(() => setQueue(initialQueue), [initialQueue]);
  React.useEffect(() => setHistory(initialHistory), [initialHistory]);
  React.useEffect(() => setBunchProgress(initialBunchProgress), [initialBunchProgress]);
  React.useEffect(() => setSlotMeta(initialSlotMeta), [initialSlotMeta]);

  const metaByVideoId = React.useMemo(() => {
    const map = new Map<string, SlotScriptMeta>();
    for (const m of slotMeta) map.set(m.winner_video_id, m);
    return map;
  }, [slotMeta]);

  const progressByBunchId = React.useMemo(() => {
    const map = new Map<string, BunchScriptProgress>();
    for (const p of bunchProgress) map.set(p.bunch_id, p);
    return map;
  }, [bunchProgress]);

  const groups = React.useMemo<QueueGroup[]>(() => {
    const byBunch = new Map<string, WinnerVideoRecord[]>();
    const other: WinnerVideoRecord[] = [];
    for (const v of queue) {
      const bunchId = v.bunch_id?.trim();
      if (bunchId) {
        const list = byBunch.get(bunchId) ?? [];
        list.push(v);
        byBunch.set(bunchId, list);
      } else {
        other.push(v);
      }
    }
    const out: QueueGroup[] = [];
    for (const [bunchId, videos] of byBunch) {
      const progress = progressByBunchId.get(bunchId);
      const title =
        progress?.bunch_name ||
        videos[0]?.bunch_name?.trim() ||
        metaByVideoId.get(videos[0]?.id ?? "")?.bunch_name ||
        "Bunch";
      out.push({
        key: bunchId,
        title,
        progress,
        videos,
      });
    }
    out.sort((a, b) => a.title.localeCompare(b.title));
    if (other.length > 0) {
      out.push({ key: "__other__", title: "Other scripts", videos: other });
    }
    return out;
  }, [queue, progressByBunchId, metaByVideoId]);

  const modelOptions = React.useMemo<CustomSelectOption[]>(() => {
    const base = gunzoModels.map((m) => ({ value: m.id, label: m.model_name }));
    const active = activeId ? queue.find((v) => v.id === activeId) : null;
    const assigned = active?.assigned_creator_name?.trim();
    if (assigned && !base.some((o) => o.label === assigned)) {
      return [{ value: `custom:${assigned}`, label: assigned }, ...base];
    }
    return [{ value: "", label: "Select Gunzo-team model…" }, ...base];
  }, [gunzoModels, activeId, queue]);

  const typeOptions = React.useMemo<CustomSelectOption[]>(
    () => [
      { value: "", label: "Select type…" },
      ...SCRIPT_VIDEO_TYPES.map((t) => ({ value: t, label: t })),
    ],
    [],
  );

  async function reload() {
    setLoading(true);
    try {
      const [queueRes, mineRes] = await Promise.all([
        fetch("/api/creative-scripts/queue", { credentials: "include" }),
        fetch("/api/creative-scripts/mine", { credentials: "include" }),
      ]);
      const queueData = (await queueRes.json()) as {
        videos?: WinnerVideoRecord[];
        bunchProgress?: BunchScriptProgress[];
        slotMeta?: SlotScriptMeta[];
      };
      const mineData = (await mineRes.json()) as {
        videos?: WinnerVideoRecord[];
        slotMeta?: SlotScriptMeta[];
      };
      if (queueRes.ok) {
        setQueue(queueData.videos ?? []);
        setBunchProgress(queueData.bunchProgress ?? []);
        setSlotMeta((prev) => {
          const fromQueue = queueData.slotMeta ?? [];
          if (fromQueue.length > 0) return fromQueue;
          return prev;
        });
      }
      if (mineRes.ok) {
        setHistory(mineData.videos ?? []);
        if (mineData.slotMeta?.length) {
          setSlotMeta((prev) => {
            const map = new Map(prev.map((m) => [m.winner_video_id, m]));
            for (const m of mineData.slotMeta!) map.set(m.winner_video_id, m);
            return [...map.values()];
          });
        }
      }
    } finally {
      setLoading(false);
    }
  }

  const reloadRef = React.useRef(reload);
  reloadRef.current = reload;

  React.useEffect(() => {
    if (isSupabaseBackend) return;
    const id = window.setInterval(() => {
      void reloadRef.current();
    }, 60_000);
    return () => window.clearInterval(id);
  }, [isSupabaseBackend]);

  useSupabaseRealtimeRefresh(["winner_videos"], () => void reloadRef.current(), { debounceMs: 600 });

  function openForm(video: WinnerVideoRecord) {
    if (activeId === video.id) {
      setActiveId(null);
      return;
    }
    setActiveId(video.id);
    setModelId(resolveModelId(video, gunzoModels));
    setScriptType("");
    setScriptText("");
    setTextOnScreen(video.text_on_screen_suggestion ?? "");
    setTextOnScreenOpen(Boolean(video.text_on_screen_suggestion?.trim()));
  }

  async function handleSubmit(videoId: string) {
    const modelName = modelNameFromSelection(modelId, gunzoModels).trim();
    if (!modelName || !scriptType || !scriptText.trim()) {
      addToast(
        winnerVideoLocalToast(`cs-val-${Date.now()}`, "Missing fields", "Model, type, and script are required.", "high"),
      );
      return;
    }

    setSavingId(videoId);
    try {
      const res = await fetch("/api/creative-scripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id: videoId,
          assigned_creator_name: modelName,
          script_video_type: scriptType,
          script_text: scriptText,
          text_on_screen_suggestion: textOnScreen,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        addToast(winnerVideoLocalToast(`cs-err-${Date.now()}`, "Submit failed", data.error ?? "Could not submit", "high"));
        return;
      }
      addToast(winnerVideoLocalToast(`cs-ok-${Date.now()}`, "Script submitted", "Sent for review.", "normal"));
      setActiveId(null);
      await reload();
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <ReviewPageEyebrow>Creative</ReviewPageEyebrow>
          <h1 className="mt-1 text-2xl font-bold text-white">Scripts to Write</h1>
          <p className="mt-1 text-sm text-[#B8B4B8]/60">
            Winner Video bunches and research finds assigned to you. Each slot has its own script — submit them independently.
          </p>
        </div>
        <div className="flex rounded-xl border border-white/10 bg-black/30 p-1">
          <button
            type="button"
            onClick={() => setTab("write")}
            className={cn(
              "rounded-lg px-3.5 py-1.5 text-xs font-semibold transition",
              tab === "write"
                ? "bg-[#FF1493]/20 text-[#FF1493]"
                : "text-white/45 hover:text-white/80",
            )}
          >
            Write
          </button>
          <button
            type="button"
            onClick={() => setTab("history")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition",
              tab === "history"
                ? "bg-[#FF1493]/20 text-[#FF1493]"
                : "text-white/45 hover:text-white/80",
            )}
          >
            <History className="h-3.5 w-3.5" aria-hidden />
            History
          </button>
        </div>
      </div>

      {tab === "history" ? (
        <CreativeScriptsHistory scripts={history} slotMeta={slotMeta} />
      ) : loading ? (
        <ReviewLoadingState />
      ) : queue.length === 0 ? (
        <ReviewEmptyState
          icon={FileText}
          title="No scripts to write"
          description="When a manager assigns you a bunch (or an approved research find), scripts appear here grouped by bunch."
        />
      ) : (
        <div className="space-y-6">
          <ReviewSectionHeader
            action={
              <button type="button" className={VA_BTN_SECONDARY} onClick={() => void reload()} disabled={loading}>
                Refresh
              </button>
            }
          >
            Queue ({queue.length})
          </ReviewSectionHeader>

          {groups.map((group) => (
            <section key={group.key} className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold text-white">
                  {group.key === "__other__" ? group.title : `Bunch: ${group.title}`}
                </h2>
                {group.progress ? (
                  <p className="text-xs tabular-nums text-[#D4AF8C]/85">
                    {group.progress.written} of {group.progress.total} scripts written
                  </p>
                ) : null}
              </div>

              {group.videos.map((v) => {
                const meta = metaByVideoId.get(v.id);
                const typeLabel =
                  slotVideoTypeLabel(meta?.video_type, meta?.video_type_other) ||
                  meta?.video_type?.trim() ||
                  v.script_video_type?.trim() ||
                  v.content_type?.trim() ||
                  "";
                const description =
                  meta?.description?.trim() ||
                  (v.note?.trim() ? truncateNote(v.note, 200) || v.note : "");
                const videoLink = meta?.video_link?.trim() || v.video_link?.trim() || "";
                return (
                  <FindingCard key={v.id} pending={savingId === v.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-lg font-semibold text-white">
                          {displayOrDash(v.assigned_creator_name || v.reference_model_name)}
                        </p>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#B8B4B8]/55">
                          {typeLabel ? <span>Type: {typeLabel}</span> : null}
                          {meta && meta.recreate_total > 1 ? (
                            <span className="text-[#D4AF8C]/80">
                              Recreate {meta.recreate_index} of {meta.recreate_total}
                            </span>
                          ) : meta ? (
                            <span>Slot #{meta.sequence_number}</span>
                          ) : null}
                          {v.reference_model_name?.trim() &&
                          v.reference_model_name.trim() !== (v.assigned_creator_name || "").trim() ? (
                            <span>Ref: {v.reference_model_name}</span>
                          ) : null}
                        </div>
                      </div>
                      <button
                        type="button"
                        className={activeId === v.id ? VA_BTN_SECONDARY : VA_BTN_PRIMARY}
                        onClick={() => openForm(v)}
                        disabled={savingId === v.id}
                      >
                        {activeId === v.id ? "Close" : "Write script"}
                      </button>
                    </div>

                    {videoLink ? (
                      <a
                        href={videoLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex items-center gap-1 text-sm text-[#FF1493] hover:underline"
                      >
                        Reference video <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                      </a>
                    ) : null}

                    {description ? (
                      <p className="mt-2 text-sm text-[#B8B4B8]/70">{description}</p>
                    ) : null}

                    {activeId === v.id ? (
                      <ReviewFormSection
                        title="Write script"
                        description="Assign the Gunzo model, pick a type, and paste the full script."
                        className="mt-4 border border-white/[0.06] shadow-[inset_0_2px_8px_rgba(0,0,0,0.25)]"
                      >
                        <div className="space-y-4">
                          <div>
                            <ReviewFieldLabel>Model</ReviewFieldLabel>
                            <ManagerReviewSelect
                              value={modelId}
                              onChange={setModelId}
                              options={modelOptions}
                              placeholder="Select Gunzo-team model…"
                              required
                            />
                          </div>
                          <div>
                            <ReviewFieldLabel>Type</ReviewFieldLabel>
                            <ManagerReviewSelect
                              value={scriptType}
                              onChange={setScriptType}
                              options={typeOptions}
                              placeholder="Select type…"
                              required
                            />
                          </div>
                          <div>
                            <ReviewFieldLabel>Script</ReviewFieldLabel>
                            <ManagerReviewTextarea
                              value={scriptText}
                              onChange={(e) => setScriptText(e.target.value)}
                              rows={10}
                              placeholder="Write the full script here…"
                              required
                            />
                          </div>
                          <div className="overflow-hidden rounded-xl border border-[#D4AF8C]/15 bg-[#D4AF8C]/[0.04]">
                            <button
                              type="button"
                              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
                              onClick={() => setTextOnScreenOpen((o) => !o)}
                              aria-expanded={textOnScreenOpen}
                            >
                              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#D4AF8C]/75">
                                Text on Screen Suggestion
                                <span className="ml-1.5 font-normal normal-case tracking-normal text-[#B8B4B8]/45">
                                  (optional)
                                </span>
                              </span>
                              <ChevronDown
                                className={cn(
                                  "h-4 w-4 text-[#D4AF8C]/70 transition-transform",
                                  textOnScreenOpen && "rotate-180",
                                )}
                                aria-hidden
                              />
                            </button>
                            {textOnScreenOpen ? (
                              <div className="border-t border-[#D4AF8C]/10 px-3 pb-3 pt-2">
                                <p className="mb-2 text-xs text-[#B8B4B8]/50">
                                  Suggested on-screen text overlays — secondary to the main script.
                                </p>
                                <ManagerReviewTextarea
                                  value={textOnScreen}
                                  onChange={(e) => setTextOnScreen(e.target.value)}
                                  rows={4}
                                  placeholder="e.g. captions, titles, callouts…"
                                />
                              </div>
                            ) : null}
                          </div>
                          <div className="flex justify-end gap-2">
                            <button type="button" className={VA_BTN_SECONDARY} onClick={() => setActiveId(null)}>
                              Cancel
                            </button>
                            <button
                              type="button"
                              className={VA_BTN_PRIMARY}
                              disabled={savingId === v.id}
                              onClick={() => void handleSubmit(v.id)}
                            >
                              {savingId === v.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                "Submit script"
                              )}
                            </button>
                          </div>
                        </div>
                      </ReviewFormSection>
                    ) : null}
                  </FindingCard>
                );
              })}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
