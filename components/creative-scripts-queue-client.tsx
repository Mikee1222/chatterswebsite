"use client";

import * as React from "react";
import { ExternalLink, FileText, Loader2 } from "lucide-react";
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
import type { ModelRecord } from "@/types";

type Props = {
  initialQueue: WinnerVideoRecord[];
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

export function CreativeScriptsQueueClient({ initialQueue, gunzoModels }: Props) {
  const { addToast } = useToast();
  const [queue, setQueue] = React.useState(initialQueue);
  const [loading, setLoading] = React.useState(false);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [modelId, setModelId] = React.useState("");
  const [scriptType, setScriptType] = React.useState("");
  const [scriptText, setScriptText] = React.useState("");

  React.useEffect(() => setQueue(initialQueue), [initialQueue]);

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
      const res = await fetch("/api/creative-scripts/queue", { credentials: "include" });
      const data = (await res.json()) as { videos?: WinnerVideoRecord[] };
      if (res.ok) setQueue(data.videos ?? []);
    } finally {
      setLoading(false);
    }
  }

  function openForm(video: WinnerVideoRecord) {
    if (activeId === video.id) {
      setActiveId(null);
      return;
    }
    setActiveId(video.id);
    setModelId(resolveModelId(video, gunzoModels));
    setScriptType("");
    setScriptText("");
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
      <div>
        <ReviewPageEyebrow>Creative</ReviewPageEyebrow>
        <h1 className="mt-1 text-2xl font-bold text-white">Scripts to Write</h1>
        <p className="mt-1 text-sm text-[#B8B4B8]/60">
          Approved research finds waiting for a creative script. Pick one, write the script, and submit for review.
        </p>
      </div>

      {loading ? (
        <ReviewLoadingState />
      ) : queue.length === 0 ? (
        <ReviewEmptyState
          icon={FileText}
          title="No scripts to write"
          description="When a research find is approved, it will appear here for scripting."
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
            Queue ({queue.length})
          </ReviewSectionHeader>

          {queue.map((v) => (
            <FindingCard key={v.id} pending={savingId === v.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-lg font-semibold text-white">{displayOrDash(v.assigned_creator_name)}</p>
                  <p className="text-xs text-[#B8B4B8]/55">Ref model: {displayOrDash(v.reference_model_name)}</p>
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

              {v.video_link ? (
                <a
                  href={v.video_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-sm text-[#FF1493] hover:underline"
                >
                  Reference video <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </a>
              ) : null}

              {v.note?.trim() ? (
                <p className="mt-2 text-sm text-[#B8B4B8]/70">{truncateNote(v.note, 200) || v.note}</p>
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
                          <>
                            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" aria-hidden />
                            Submitting…
                          </>
                        ) : (
                          "Submit for review"
                        )}
                      </button>
                    </div>
                  </div>
                </ReviewFormSection>
              ) : null}
            </FindingCard>
          ))}
        </div>
      )}
    </div>
  );
}
