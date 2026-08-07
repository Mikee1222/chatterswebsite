"use client";

import * as React from "react";
import { ChevronDown, ChevronRight, FileText, History, Loader2 } from "lucide-react";
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
  ScriptStatusBadge,
  VA_BTN_PRIMARY,
  VA_BTN_SECONDARY,
  displayOrDash,
  type CustomSelectOption,
} from "@/components/manager-review-ui";
import { WinnerVideoCopyButton } from "@/components/winner-videos-shared";
import { useToast } from "@/contexts/toast-context";
import { formatCreativeScriptCopy } from "@/lib/creative-scripts-copy";
import { SCRIPT_VIDEO_TYPES } from "@/lib/creative-scripts-helpers";
import { formatDateTimeAthens } from "@/lib/format";
import { copyTextToClipboard } from "@/lib/winner-videos-copy";
import { winnerVideoLocalToast } from "@/components/winner-videos-shared";
import type { WinnerVideoRecord } from "@/services/winner-videos";
import type { SlotScriptMeta } from "@/services/winner-sourcing";
import type { ModelRecord } from "@/types";
import { cn } from "@/lib/utils";
import { useIsSupabaseBackend } from "@/contexts/data-backend-context";
import { useSupabaseRealtimeRefresh } from "@/lib/hooks/use-supabase-realtime";
import { CreativeScriptsHistory } from "@/components/creative-scripts-history";

type Props = {
  initialScripts: WinnerVideoRecord[];
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

export function MyScriptsClient({
  initialScripts,
  initialSlotMeta = [],
  gunzoModels,
}: Props) {
  const { addToast } = useToast();
  const isSupabaseBackend = useIsSupabaseBackend();
  const [scripts, setScripts] = React.useState(initialScripts);
  const [slotMeta, setSlotMeta] = React.useState(initialSlotMeta);
  const [loading, setLoading] = React.useState(false);
  const [tab, setTab] = React.useState<"list" | "history">("list");
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [resubmitId, setResubmitId] = React.useState<string | null>(null);
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [modelId, setModelId] = React.useState("");
  const [scriptType, setScriptType] = React.useState("");
  const [scriptText, setScriptText] = React.useState("");
  const [textOnScreen, setTextOnScreen] = React.useState("");
  const [textOnScreenOpen, setTextOnScreenOpen] = React.useState(false);
  const [scriptBrief, setScriptBrief] = React.useState("");
  const [scriptBriefOpen, setScriptBriefOpen] = React.useState(false);

  React.useEffect(() => setScripts(initialScripts), [initialScripts]);
  React.useEffect(() => setSlotMeta(initialSlotMeta), [initialSlotMeta]);

  const modelOptions = React.useMemo<CustomSelectOption[]>(() => {
    const base = gunzoModels.map((m) => ({ value: m.id, label: m.model_name }));
    return [{ value: "", label: "Select Gunzo-team model…" }, ...base];
  }, [gunzoModels]);

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
      const res = await fetch("/api/creative-scripts/mine", { credentials: "include" });
      const data = (await res.json()) as {
        videos?: WinnerVideoRecord[];
        slotMeta?: SlotScriptMeta[];
      };
      if (res.ok) {
        setScripts(data.videos ?? []);
        if (data.slotMeta) setSlotMeta(data.slotMeta);
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

  async function copyScript(video: WinnerVideoRecord) {
    const ok = await copyTextToClipboard(formatCreativeScriptCopy(video));
    addToast(
      winnerVideoLocalToast(
        `msc-${Date.now()}`,
        ok ? "Copied" : "Copy failed",
        ok ? "Script copied to clipboard." : "Could not copy to clipboard.",
        ok ? "normal" : "high",
      ),
    );
  }

  function openResubmit(video: WinnerVideoRecord) {
    setResubmitId(video.id);
    setModelId(resolveModelId(video, gunzoModels));
    setScriptType(video.script_video_type || "");
    setScriptText(video.script_text || "");
    setTextOnScreen(video.text_on_screen_suggestion || "");
    setTextOnScreenOpen(Boolean(video.text_on_screen_suggestion?.trim()));
    setScriptBrief(video.script_brief || "");
    setScriptBriefOpen(Boolean(video.script_brief?.trim()));
    setExpandedId(video.id);
  }

  async function handleResubmit(videoId: string) {
    const modelName = modelNameFromSelection(modelId, gunzoModels).trim();
    if (!modelName || !scriptType || !scriptText.trim()) {
      addToast(
        winnerVideoLocalToast(`ms-val-${Date.now()}`, "Missing fields", "Model, type, and script are required.", "high"),
      );
      return;
    }

    setSavingId(videoId);
    try {
      const res = await fetch(`/api/creative-scripts/${encodeURIComponent(videoId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          assigned_creator_name: modelName,
          script_video_type: scriptType,
          script_text: scriptText,
          text_on_screen_suggestion: textOnScreen,
          script_brief: scriptBrief,
        }),
      });
      const data = (await res.json()) as { video?: WinnerVideoRecord; error?: string };
      if (!res.ok || !data.video) {
        addToast(winnerVideoLocalToast(`ms-err-${Date.now()}`, "Resubmit failed", data.error ?? "Could not resubmit", "high"));
        return;
      }
      addToast(winnerVideoLocalToast(`ms-ok-${Date.now()}`, "Script resubmitted", "Sent back for review.", "normal"));
      setResubmitId(null);
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
          <h1 className="mt-1 text-2xl font-bold text-white">My Scripts</h1>
          <p className="mt-1 text-sm text-[#B8B4B8]/60">Scripts you have submitted for research find recreations.</p>
        </div>
        <div className="flex rounded-xl border border-white/10 bg-black/30 p-1">
          <button
            type="button"
            onClick={() => setTab("list")}
            className={cn(
              "rounded-lg px-3.5 py-1.5 text-xs font-semibold transition",
              tab === "list"
                ? "bg-[#FF1493]/20 text-[#FF1493]"
                : "text-white/45 hover:text-white/80",
            )}
          >
            Submissions
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
        <CreativeScriptsHistory scripts={scripts} slotMeta={slotMeta} />
      ) : loading ? (
        <ReviewLoadingState />
      ) : scripts.length === 0 ? (
        <ReviewEmptyState
          icon={FileText}
          title="No scripts yet"
          description="Scripts you submit from Scripts to Write will appear here."
        />
      ) : (
        <div className="space-y-4">
          <ReviewSectionHeader
            action={
              <button type="button" className={VA_BTN_SECONDARY} onClick={() => void reload()} disabled={loading}>
                Refresh
              </button>
            }
          >
            Submissions ({scripts.length})
          </ReviewSectionHeader>

          {scripts.map((v) => {
            const expanded = expandedId === v.id;
            return (
              <FindingCard key={v.id} pending={savingId === v.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <ScriptStatusBadge status={v.script_status} />
                      {v.script_submitted_at ? (
                        <span className="text-xs text-[#B8B4B8]/45">{formatDateTimeAthens(v.script_submitted_at)}</span>
                      ) : null}
                      <WinnerVideoCopyButton onClick={() => void copyScript(v)} label="Copy script" />
                    </div>
                    <p className="text-lg font-semibold text-white">{displayOrDash(v.assigned_creator_name)}</p>
                    <p className="text-xs text-[#D4AF8C]/75">Type: {displayOrDash(v.script_video_type)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {v.script_status === "Rejected" ? (
                      <button type="button" className={VA_BTN_PRIMARY} onClick={() => openResubmit(v)}>
                        Resubmit
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={VA_BTN_SECONDARY}
                      onClick={() => setExpandedId(expanded ? null : v.id)}
                      aria-expanded={expanded}
                    >
                      {expanded ? (
                        <ChevronDown className="h-4 w-4" aria-hidden />
                      ) : (
                        <ChevronRight className="h-4 w-4" aria-hidden />
                      )}
                      <span className="sr-only">{expanded ? "Collapse" : "Expand"} script</span>
                    </button>
                  </div>
                </div>

                {v.script_rejection_reason?.trim() ? (
                  <p className="mt-3 rounded-lg border border-red-500/20 bg-red-500/8 px-3 py-2 text-sm text-red-200">
                    {v.script_rejection_reason}
                  </p>
                ) : null}

                {expanded && resubmitId !== v.id ? (
                  <div className="mt-3 space-y-3">
                    <pre
                      className={cn(
                        "max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-white/[0.06]",
                        "bg-[#0D0B0D]/60 px-3 py-3 text-sm text-[#B8B4B8]/80",
                      )}
                    >
                      {v.script_text?.trim() || "—"}
                    </pre>
                    {v.text_on_screen_suggestion?.trim() ? (
                      <div className="rounded-xl border border-[#D4AF8C]/15 bg-[#D4AF8C]/[0.04] px-3 py-2.5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#D4AF8C]/75">
                          Text on Screen Suggestion
                        </p>
                        <p className="mt-1.5 whitespace-pre-wrap text-sm text-[#B8B4B8]/70">
                          {v.text_on_screen_suggestion}
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {resubmitId === v.id ? (
                  <ReviewFormSection
                    title="Resubmit script"
                    description="Update the script and send it back for review."
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
                            <ManagerReviewTextarea
                              value={textOnScreen}
                              onChange={(e) => setTextOnScreen(e.target.value)}
                              rows={4}
                              placeholder="e.g. captions, titles, callouts…"
                            />
                          </div>
                        ) : null}
                      </div>
                      <div className="overflow-hidden rounded-xl border border-[#D4AF8C]/15 bg-[#D4AF8C]/[0.04]">
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
                          onClick={() => setScriptBriefOpen((o) => !o)}
                          aria-expanded={scriptBriefOpen}
                        >
                          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#D4AF8C]/75">
                            Brief
                            <span className="ml-1.5 font-normal normal-case tracking-normal text-[#B8B4B8]/45">
                              (optional)
                            </span>
                          </span>
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 text-[#D4AF8C]/70 transition-transform",
                              scriptBriefOpen && "rotate-180",
                            )}
                            aria-hidden
                          />
                        </button>
                        {scriptBriefOpen ? (
                          <div className="border-t border-[#D4AF8C]/10 px-3 pb-3 pt-2">
                            <ManagerReviewTextarea
                              value={scriptBrief}
                              onChange={(e) => setScriptBrief(e.target.value)}
                              rows={4}
                              placeholder="Filming brief — tone, framing, wardrobe…"
                            />
                          </div>
                        ) : null}
                      </div>
                      <div className="flex justify-end gap-2">
                        <button type="button" className={VA_BTN_SECONDARY} onClick={() => setResubmitId(null)}>
                          Cancel
                        </button>
                        <button
                          type="button"
                          className={VA_BTN_PRIMARY}
                          disabled={savingId === v.id}
                          onClick={() => void handleResubmit(v.id)}
                        >
                          {savingId === v.id ? (
                            <>
                              <Loader2 className="mr-2 inline h-4 w-4 animate-spin" aria-hidden />
                              Submitting…
                            </>
                          ) : (
                            "Resubmit for review"
                          )}
                        </button>
                      </div>
                    </div>
                  </ReviewFormSection>
                ) : null}
              </FindingCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
