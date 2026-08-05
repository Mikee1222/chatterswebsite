"use client";

import * as React from "react";
import { Check, ChevronDown, ChevronRight, Copy, FileText, Loader2, Trash2 } from "lucide-react";
import {
  FilterBar,
  FindingCard,
  ManagerReviewFileDropzone,
  ManagerReviewSelect,
  QuickActionDelete,
  ReviewEmptyState,
  ReviewFieldLabel,
  ReviewFormSection,
  ReviewLoadingState,
  ReviewPageEyebrow,
  ReviewSectionHeader,
  VA_BTN_PRIMARY,
  VA_BTN_SECONDARY,
  VA_FILTER_INPUT,
  VideoTranscriptStatusBadge,
} from "@/components/manager-review-ui";
import { WinnerVideoCopyButton } from "@/components/winner-videos-shared";
import { useToast } from "@/contexts/toast-context";
import { useIsSupabaseBackend } from "@/contexts/data-backend-context";
import { uploadFileToSupabaseStorage } from "@/lib/client-direct-storage-upload";
import { formatDateTimeAthens } from "@/lib/format";
import { copyTextToClipboard } from "@/lib/winner-videos-copy";
import { appendWinnerVideoDateParams, WINNER_VIDEO_DATE_RANGE_OPTIONS, type WinnerVideoDateRange } from "@/lib/winner-videos-filters";
import { WINNER_VIDEO_ACCEPT, WINNER_VIDEO_MAX_FILE_BYTES } from "@/lib/winner-video-files";
import { cn } from "@/lib/utils";
import type { VideoTranscriptRecord } from "@/services/video-transcripts";

type Props = {
  initialTranscripts: VideoTranscriptRecord[];
};

type ProgressStage = "idle" | "uploading" | "processing" | "transcribing" | "done" | "failed";

const PROGRESS_LABELS: Record<Exclude<ProgressStage, "idle" | "failed">, string> = {
  uploading: "Uploading video…",
  processing: "Processing audio…",
  transcribing: "Transcribing… this may take a minute or two",
  done: "Done",
};

function localToast(id: string, title: string, body: string, priority: "normal" | "high" = "normal") {
  return {
    id,
    notification_id: id,
    user_id: "local",
    category: "system" as const,
    event_type: "system_alert" as const,
    priority,
    title,
    body,
    entity_type: "system",
    entity_id: "",
    read_at: null,
    created_at: new Date().toISOString(),
  };
}

function TranscriptProgressBar({ stage }: { stage: Exclude<ProgressStage, "idle" | "failed"> }) {
  return (
    <div className="space-y-2">
      <div className="h-1.5 overflow-hidden rounded-full border border-white/[0.06] bg-[#0D0B0D]/80 shadow-[inset_0_2px_6px_rgba(0,0,0,0.45)]">
        <div
          className={cn(
            "h-full w-full origin-left rounded-full bg-gradient-to-r from-[#FF1493]/70 via-[#D4AF8C]/80 to-[#FF1493]/70",
            stage === "done"
              ? "animate-none scale-x-100 transition-transform duration-500"
              : "animate-[transcript-indeterminate_1.8s_ease-in-out_infinite]",
          )}
          style={stage === "done" ? undefined : { transform: "scaleX(0.35)" }}
        />
      </div>
      <p
        className={cn(
          "text-sm transition-colors duration-300",
          stage === "done" ? "text-emerald-300/90" : "text-[#FFB3D9]/85",
        )}
      >
        {PROGRESS_LABELS[stage]}
      </p>
      <style jsx>{`
        @keyframes transcript-indeterminate {
          0% {
            transform: translateX(-120%) scaleX(0.25);
          }
          50% {
            transform: translateX(40%) scaleX(0.55);
          }
          100% {
            transform: translateX(220%) scaleX(0.25);
          }
        }
      `}</style>
    </div>
  );
}

function TranscriptPreview({
  text,
  expanded,
  onToggle,
}: {
  text: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const preview = expanded || text.length <= 280 ? text : `${text.slice(0, 280)}…`;
  return (
    <div className="mt-3 rounded-lg border border-[#D4AF8C]/15 bg-[#0D0B0D]/50 p-3">
      <button
        type="button"
        onClick={onToggle}
        className="mb-2 flex w-full items-center gap-1 text-left text-xs font-medium text-[#D4AF8C]/80"
      >
        {expanded ? <ChevronDown className="h-3.5 w-3.5" aria-hidden /> : <ChevronRight className="h-3.5 w-3.5" aria-hidden />}
        Transcript
      </button>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#B8B4B8]/85">{preview}</p>
    </div>
  );
}

export function TranscriptVideosClient({ initialTranscripts }: Props) {
  const { addToast } = useToast();
  const isSupabase = useIsSupabaseBackend();
  const [transcripts, setTranscripts] = React.useState(initialTranscripts);
  const [loading, setLoading] = React.useState(false);
  const [videoFile, setVideoFile] = React.useState<File[]>([]);
  const [label, setLabel] = React.useState("");
  const [progressStage, setProgressStage] = React.useState<ProgressStage>("idle");
  const [errorMessage, setErrorMessage] = React.useState("");
  const [result, setResult] = React.useState<VideoTranscriptRecord | null>(null);
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const [filterDateRange, setFilterDateRange] = React.useState<WinnerVideoDateRange>("all");
  const [filterDateFrom, setFilterDateFrom] = React.useState("");
  const [filterDateTo, setFilterDateTo] = React.useState("");

  React.useEffect(() => setTranscripts(initialTranscripts), [initialTranscripts]);

  React.useEffect(() => {
    if (progressStage !== "uploading" && progressStage !== "processing" && progressStage !== "transcribing") {
      return;
    }
    const timers: number[] = [];
    if (progressStage === "uploading") {
      timers.push(window.setTimeout(() => setProgressStage("processing"), 3500));
    }
    if (progressStage === "processing") {
      timers.push(window.setTimeout(() => setProgressStage("transcribing"), 5000));
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [progressStage]);

  async function reload() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      appendWinnerVideoDateParams(params, filterDateRange, filterDateFrom, filterDateTo);
      const res = await fetch(`/api/transcript-videos?${params}`, { credentials: "include" });
      const data = (await res.json()) as { transcripts?: VideoTranscriptRecord[] };
      if (res.ok) setTranscripts(data.transcripts ?? []);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterDateRange, filterDateFrom, filterDateTo]);

  async function handleTranscribe() {
    if (videoFile.length === 0) {
      addToast(localToast(`tv-val-${Date.now()}`, "Missing video", "Select a video file to transcribe.", "high"));
      return;
    }
    setErrorMessage("");
    setResult(null);
    setProgressStage("uploading");

    const fd = new FormData();
    if (label.trim()) fd.append("label", label.trim());

    try {
      if (isSupabase) {
        const { sbUrl } = await uploadFileToSupabaseStorage(videoFile[0]!, "video-transcript");
        fd.append("video_file_url", sbUrl);
      } else {
        fd.append("video_file", videoFile[0]!);
      }

      setProgressStage("processing");
      const res = await fetch("/api/transcript-videos", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const data = (await res.json()) as {
        transcript?: VideoTranscriptRecord;
        error?: string;
      };

      if (!res.ok || !data.transcript) {
        setProgressStage("failed");
        setErrorMessage(data.error ?? "Transcription failed");
        if (data.transcript) {
          setTranscripts((prev) => [data.transcript!, ...prev.filter((t) => t.id !== data.transcript!.id)]);
        }
        return;
      }

      setProgressStage("done");
      setResult(data.transcript);
      setTranscripts((prev) => [data.transcript!, ...prev.filter((t) => t.id !== data.transcript!.id)]);
      setVideoFile([]);
      setLabel("");
      window.setTimeout(() => setProgressStage("idle"), 2500);
    } catch {
      setProgressStage("failed");
      setErrorMessage("Network error — please try again.");
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this transcription?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/transcript-videos/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        addToast(localToast(`tv-del-${Date.now()}`, "Delete failed", data.error ?? "Could not delete", "high"));
        return;
      }
      setTranscripts((prev) => prev.filter((t) => t.id !== id));
      if (result?.id === id) setResult(null);
    } finally {
      setDeletingId(null);
    }
  }

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const isBusy = progressStage === "uploading" || progressStage === "processing" || progressStage === "transcribing";

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <ReviewPageEyebrow>Tools</ReviewPageEyebrow>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-white">
          <FileText className="h-6 w-6 text-[#FF1493]/80" aria-hidden />
          Transcript Videos
        </h1>
        <p className="mt-1 text-sm text-[#B8B4B8]/60">
          Upload a video and get a text transcript. Processing may take a minute or two for longer clips.
        </p>
      </div>

      <ReviewFormSection title="Upload & transcribe" description="One video at a time — MP4, MOV, WebM up to 100 MB.">
        <div className="space-y-4">
          <div>
            <ReviewFieldLabel>Label (optional)</ReviewFieldLabel>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className={VA_FILTER_INPUT}
              placeholder={videoFile[0]?.name ?? "Defaults to filename"}
              disabled={isBusy}
            />
          </div>
          <div>
            <ReviewFieldLabel>Video file</ReviewFieldLabel>
            <ManagerReviewFileDropzone
              files={videoFile}
              onChange={setVideoFile}
              accept={WINNER_VIDEO_ACCEPT}
              multiple={false}
            />
            <p className="mt-1 text-xs text-[#B8B4B8]/40">
              MP4, MOV, WebM — max {WINNER_VIDEO_MAX_FILE_BYTES / (1024 * 1024)} MB
            </p>
          </div>

          {isBusy || progressStage === "done" ? (
            <TranscriptProgressBar
              stage={
                progressStage === "uploading" || progressStage === "processing" || progressStage === "transcribing"
                  ? progressStage
                  : "done"
              }
            />
          ) : null}

          {progressStage === "failed" && errorMessage ? (
            <div className="rounded-lg border border-red-500/25 bg-red-500/8 px-4 py-3 text-sm text-red-200">
              {errorMessage}
            </div>
          ) : null}

          {result?.transcript?.trim() && progressStage !== "failed" ? (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4 shadow-[0_0_24px_-12px_rgba(16,185,129,0.2)]">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300/80">Transcript</p>
                <WinnerVideoCopyButton
                  label="Copy transcript"
                  onClick={() => {
                    void copyTextToClipboard(result.transcript).then((ok) => {
                      if (!ok) addToast(localToast(`tv-copy-${Date.now()}`, "Copy failed", "Could not copy transcript.", "high"));
                    });
                  }}
                />
              </div>
              <p className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-[#B8B4B8]/90">
                {result.transcript}
              </p>
              {result.language ? (
                <p className="mt-2 text-xs text-[#B8B4B8]/45">
                  Language: {result.language}
                  {result.duration_seconds != null ? ` · ${Math.round(result.duration_seconds)}s` : ""}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className={VA_BTN_SECONDARY}
              disabled={isBusy}
              onClick={() => {
                setVideoFile([]);
                setLabel("");
                setErrorMessage("");
                setResult(null);
                setProgressStage("idle");
              }}
            >
              Clear
            </button>
            <button
              type="button"
              disabled={isBusy || videoFile.length === 0}
              className={VA_BTN_PRIMARY}
              onClick={() => void handleTranscribe()}
            >
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {progressStage === "failed" ? "Retry" : "Transcribe"}
            </button>
          </div>
        </div>
      </ReviewFormSection>

      <section className="space-y-4">
        <ReviewSectionHeader action={loading ? <Loader2 className="h-4 w-4 animate-spin text-[#D4AF8C]/60" aria-hidden /> : null}>
          History
        </ReviewSectionHeader>

        <FilterBar>
          <ManagerReviewSelect
            value={filterDateRange}
            onChange={(v) => setFilterDateRange(v as WinnerVideoDateRange)}
            options={WINNER_VIDEO_DATE_RANGE_OPTIONS}
            triggerClassName="min-w-[9rem]"
            aria-label="Filter by date"
          />
          {filterDateRange === "custom" ? (
            <div className="flex flex-wrap gap-2">
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className={cn(VA_FILTER_INPUT, "w-auto")}
                aria-label="From date"
              />
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className={cn(VA_FILTER_INPUT, "w-auto")}
                aria-label="To date"
              />
            </div>
          ) : null}
        </FilterBar>

        {loading && transcripts.length === 0 ? <ReviewLoadingState /> : null}
        {!loading && transcripts.length === 0 ? (
          <ReviewEmptyState icon={FileText} title="No transcriptions yet" description="Upload a video above to get started." />
        ) : null}

        <div className="space-y-3">
          {transcripts.map((t) => (
            <FindingCard key={t.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <VideoTranscriptStatusBadge status={t.status} />
                    <span className="truncate text-sm font-medium text-white">{t.label || "Untitled"}</span>
                  </div>
                  <p className="mt-1 text-xs text-[#B8B4B8]/45">
                    {t.created_at ? formatDateTimeAthens(t.created_at) : "—"}
                    {t.duration_seconds != null ? ` · ${Math.round(t.duration_seconds)}s` : ""}
                    {t.language ? ` · ${t.language}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {t.transcript?.trim() ? (
                    <WinnerVideoCopyButton
                      label="Copy transcript"
                      onClick={() => {
                        void copyTextToClipboard(t.transcript).then((ok) => {
                          if (!ok) addToast(localToast(`tv-copy-${Date.now()}`, "Copy failed", "Could not copy.", "high"));
                        });
                      }}
                    />
                  ) : null}
                  <QuickActionDelete
                    disabled={deletingId === t.id}
                    onClick={() => void handleDelete(t.id)}
                  >
                    {deletingId === t.id ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <Trash2 className="h-3 w-3" aria-hidden />}
                  </QuickActionDelete>
                </div>
              </div>
              {t.transcript?.trim() ? (
                <TranscriptPreview
                  text={t.transcript}
                  expanded={expandedIds.has(t.id)}
                  onToggle={() => toggleExpanded(t.id)}
                />
              ) : t.status === "Failed" ? (
                <p className="mt-2 text-xs text-red-300/70">Transcription did not complete.</p>
              ) : null}
            </FindingCard>
          ))}
        </div>
      </section>
    </div>
  );
}
