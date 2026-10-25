"use client";

/**
 * Client-side video frame extraction + perceptual hash.
 * Uploads only small JPEGs for analysis — never the video file.
 * Does not identify people from faces.
 */

import * as React from "react";
import { AlertTriangle, Film, Loader2 } from "lucide-react";
import { aHashFromImageData } from "@/lib/video-frame-hash";
import {
  blankReplacementOffsets,
  clampSeekTime,
  frameCountForDuration,
  isTechnicallyBlankImageData,
  MAX_VIDEO_SAMPLE_FRAMES,
  sampleTimestamps,
  type VideoSamplingMeta,
} from "@/lib/video-frame-sampling";
import {
  manualDescriptionToIdeaContext,
  NEUTRAL_ANALYSIS_REFUSAL_MESSAGE,
} from "@/lib/video-analysis-refusal";
import {
  VA_BTN_PRIMARY,
  VA_BTN_SECONDARY,
  VA_FILTER_INPUT,
} from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";
import type { VideoAnalysisJson } from "@/lib/creative-studio-types";

type Props = {
  modelId: string;
  onUseForCaptions: (ctx: string) => void;
  onUseForTos: (ctx: string) => void;
  /** When true, block new analysis (e.g. birth date / 18+ missing). */
  disabled?: boolean;
};

type SampledFrame = {
  jpeg: string;
  hash: string;
  timeSec: number;
  previewUrl: string;
  byteLength: number;
};

type PriorMatch = {
  date: string;
  similarity: number;
  kind: "analysed" | "could_not_analyse";
};

const MAX_SAMPLE_FRAMES = MAX_VIDEO_SAMPLE_FRAMES;
const MAX_EDGE = 768;

type CaptureResult = {
  frame: SampledFrame;
  /** True when ImageData variance was near-uniform (technical blank). */
  blank: boolean;
};

async function captureAt(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  timeSec: number,
): Promise<CaptureResult> {
  await seek(video, timeSec);

  const vw = video.videoWidth || 720;
  const vh = video.videoHeight || 1280;
  const scale = Math.min(1, MAX_EDGE / Math.max(vw, vh));
  canvas.width = Math.max(1, Math.round(vw * scale));
  canvas.height = Math.max(1, Math.round(vh * scale));
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
  const b64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");

  let hash = "";
  let blank = false;
  const hashCanvas = document.createElement("canvas");
  hashCanvas.width = 32;
  hashCanvas.height = 32;
  const hctx = hashCanvas.getContext("2d", { willReadFrequently: true });
  if (hctx) {
    hctx.drawImage(canvas, 0, 0, 32, 32);
    const img = hctx.getImageData(0, 0, 32, 32);
    hash = aHashFromImageData(img);
    // Technical blank-frame check, not content filter.
    blank = isTechnicallyBlankImageData(img);
  }

  return {
    blank,
    frame: {
      jpeg: b64,
      hash,
      timeSec,
      previewUrl: `data:image/jpeg;base64,${b64}`,
      byteLength: b64.length,
    },
  };
}

async function extractFramesAtTimes(
  file: File,
  times: number[],
  opts?: { replaceBlanks?: boolean },
): Promise<{
  frames: SampledFrame[];
  duration: number;
  blankFramesReplaced: number;
  seekTimestamps: number[];
}> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.src = url;

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Could not load video"));
    });

    const duration =
      Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Canvas unsupported");

    const frames: SampledFrame[] = [];
    const seekTimestamps: number[] = [];
    let blankFramesReplaced = 0;
    const replaceBlanks = opts?.replaceBlanks !== false;

    for (const t of times) {
      let chosen = await captureAt(video, canvas, ctx, t);
      let usedTime = t;

      // Technical blank-frame check, not content filter — replace with nearest informative frame.
      if (replaceBlanks && chosen.blank) {
        for (const off of blankReplacementOffsets()) {
          const alt = clampSeekTime(t + off, duration);
          if (Math.abs(alt - t) < 0.04) continue;
          const candidate = await captureAt(video, canvas, ctx, alt);
          if (!candidate.blank) {
            chosen = candidate;
            usedTime = alt;
            blankFramesReplaced += 1;
            break;
          }
        }
      }

      frames.push({ ...chosen.frame, timeSec: usedTime });
      seekTimestamps.push(usedTime);
    }

    return { frames, duration, blankFramesReplaced, seekTimestamps };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function seek(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      resolve();
    };
    video.addEventListener("seeked", onSeeked);
    video.onerror = () => reject(new Error("Seek failed"));
    try {
      video.currentTime = Math.min(Math.max(0, time), (video.duration || 1) - 0.05);
    } catch (err) {
      reject(err instanceof Error ? err : new Error("Seek failed"));
    }
  });
}

function formatTs(sec: number): string {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function CreativeStudioVideoAnalyzer({
  modelId,
  onUseForCaptions,
  onUseForTos,
  disabled = false,
}: Props) {
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);
  const [surfaceMessage, setSurfaceMessage] = React.useState<string | null>(null);
  const [surfaceTone, setSurfaceTone] = React.useState<"error" | "info">("info");
  const [analysis, setAnalysis] = React.useState<VideoAnalysisJson | null>(null);
  const [analysisId, setAnalysisId] = React.useState<string | null>(null);
  const [ideaContext, setIdeaContext] = React.useState("");
  const [duplicate, setDuplicate] = React.useState<PriorMatch | null>(null);
  const [frames, setFrames] = React.useState<SampledFrame[]>([]);
  const [selected, setSelected] = React.useState<Set<number>>(new Set());
  const [duration, setDuration] = React.useState(0);
  const [videoFile, setVideoFile] = React.useState<File | null>(null);
  const [scrubTime, setScrubTime] = React.useState(0);
  const [feedbackNote, setFeedbackNote] = React.useState<string | null>(null);
  const [lastSamplingMeta, setLastSamplingMeta] = React.useState<VideoSamplingMeta | null>(
    null,
  );

  // Manual describe form
  const [manualWhat, setManualWhat] = React.useState("");
  const [manualSetting, setManualSetting] = React.useState("");
  const [manualOutfit, setManualOutfit] = React.useState("");
  const [manualMood, setManualMood] = React.useState("");
  const [manualProps, setManualProps] = React.useState("");
  const [manualText, setManualText] = React.useState("");

  const refused = Boolean(analysis?.refusal);
  const showManualProminent = refused || !analysis;

  const manualCtx = React.useMemo(
    () =>
      manualDescriptionToIdeaContext({
        whatHappens: manualWhat,
        setting: manualSetting,
        outfit: manualOutfit,
        mood: manualMood,
        props: manualProps,
        visibleText: manualText,
      }),
    [manualWhat, manualSetting, manualOutfit, manualMood, manualProps, manualText],
  );

  function resetResultState() {
    setSurfaceMessage(null);
    setAnalysis(null);
    setAnalysisId(null);
    setDuplicate(null);
    setIdeaContext("");
    setFeedbackNote(null);
  }

  async function runAnalysis(
    framesToSend: SampledFrame[],
    samplingMeta?: VideoSamplingMeta | null,
  ) {
    if (!framesToSend.length || !modelId) return;
    setBusy(true);
    resetResultState();
    setStatus("Analysing frames (video stays local)…");
    const meta: VideoSamplingMeta = samplingMeta ??
      lastSamplingMeta ?? {
        duration_sec: duration,
        seek_timestamps_sec: framesToSend.map((f) => f.timeSec),
        frames_requested: framesToSend.length,
        frames_analysed: framesToSend.length,
        frame_byte_lengths: framesToSend.map((f) => f.byteLength ?? f.jpeg.length),
        blank_frames_replaced: 0,
      };
    try {
      const res = await fetch("/api/creative-studio/analyze-video", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          modelId,
          frames: framesToSend.map((f) => f.jpeg),
          frameHashes: framesToSend.map((f) => f.hash),
          coverThumbnailBase64: framesToSend[0]?.jpeg,
          samplingMeta: meta,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        analysis?: VideoAnalysisJson;
        ideaContext?: string;
        analysisId?: string | null;
        refused?: boolean;
        duplicate?: {
          date: string;
          similarity: number;
          kind?: "analysed" | "could_not_analyse";
        };
        generationDisabledReason?: string;
      };

      if (data.generationDisabledReason) {
        setSurfaceTone("error");
        setSurfaceMessage(data.generationDisabledReason);
        return;
      }

      const nextAnalysis = data.analysis ?? {
        refusal: true,
        refusal_message: NEUTRAL_ANALYSIS_REFUSAL_MESSAGE,
      };
      // Hard-sanitize: never show model refusal prose even if a buggy response slips through
      if (nextAnalysis.refusal) {
        nextAnalysis.refusal_message = NEUTRAL_ANALYSIS_REFUSAL_MESSAGE;
      }

      setAnalysis(nextAnalysis);
      setAnalysisId(data.analysisId ?? null);
      setIdeaContext(data.ideaContext ?? "");

      if (data.duplicate) {
        setDuplicate({
          date: data.duplicate.date,
          similarity: data.duplicate.similarity,
          kind: data.duplicate.kind === "could_not_analyse" ? "could_not_analyse" : "analysed",
        });
      }

      if (nextAnalysis.refusal || data.refused) {
        setSurfaceTone("info");
        setSurfaceMessage(NEUTRAL_ANALYSIS_REFUSAL_MESSAGE);
      } else if (!res.ok) {
        setSurfaceTone("error");
        setSurfaceMessage(NEUTRAL_ANALYSIS_REFUSAL_MESSAGE);
        setAnalysis({
          refusal: true,
          refusal_message: NEUTRAL_ANALYSIS_REFUSAL_MESSAGE,
        });
      }
    } catch {
      setSurfaceTone("info");
      setSurfaceMessage(NEUTRAL_ANALYSIS_REFUSAL_MESSAGE);
      setAnalysis({
        refusal: true,
        refusal_message: NEUTRAL_ANALYSIS_REFUSAL_MESSAGE,
      });
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  async function onFile(file: File | null) {
    if (!file || !modelId) return;
    setBusy(true);
    resetResultState();
    setVideoFile(file);
    setFrames([]);
    setSelected(new Set());
    setStatus("Extracting frames in browser…");
    try {
      // Peek duration via a throwaway extract of timestamps
      const probeUrl = URL.createObjectURL(file);
      let dur = 1;
      try {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.muted = true;
        video.src = probeUrl;
        await new Promise<void>((resolve, reject) => {
          video.onloadedmetadata = () => resolve();
          video.onerror = () => reject(new Error("Could not load video"));
        });
        dur = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
      } finally {
        URL.revokeObjectURL(probeUrl);
      }

      const count = frameCountForDuration(dur);
      const times = sampleTimestamps(dur, count);
      const {
        frames: sampled,
        duration: d,
        blankFramesReplaced,
        seekTimestamps,
      } = await extractFramesAtTimes(file, times, { replaceBlanks: true });
      setDuration(d);
      setFrames(sampled);
      setSelected(new Set(sampled.map((_, i) => i)));
      setScrubTime(0);
      const meta: VideoSamplingMeta = {
        duration_sec: d,
        seek_timestamps_sec: seekTimestamps,
        frames_requested: count,
        frames_analysed: sampled.length,
        frame_byte_lengths: sampled.map((f) => f.byteLength),
        blank_frames_replaced: blankFramesReplaced,
      };
      setLastSamplingMeta(meta);
      await runAnalysis(sampled, meta);
    } catch {
      setBusy(false);
      setStatus(null);
      setSurfaceTone("info");
      setSurfaceMessage(NEUTRAL_ANALYSIS_REFUSAL_MESSAGE);
    }
  }

  async function addScrubFrame() {
    if (!videoFile || busy) return;
    setBusy(true);
    setStatus("Capturing frame…");
    try {
      const { frames: added } = await extractFramesAtTimes(videoFile, [scrubTime]);
      const next = added[0];
      if (!next) return;
      setFrames((prev) => {
        const merged = [...prev, next].slice(0, MAX_SAMPLE_FRAMES);
        setSelected(new Set(merged.map((_, i) => i)));
        return merged;
      });
    } catch {
      setSurfaceTone("error");
      setSurfaceMessage("Could not capture that frame.");
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  function toggleFrame(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) {
        if (next.size <= 1) return prev;
        next.delete(i);
      } else {
        if (next.size >= MAX_SAMPLE_FRAMES) return prev;
        next.add(i);
      }
      return next;
    });
  }

  async function reanalyzeSelected() {
    const chosen = frames.filter((_, i) => selected.has(i));
    if (!chosen.length) return;
    await runAnalysis(chosen);
  }

  async function sendFeedback(feedback: "ok" | "flag_wrong" | "wrong_refusal") {
    if (!analysisId) return;
    setFeedbackNote(null);
    try {
      const res = await fetch("/api/creative-studio/analyze-video/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ analysisId, feedback }),
      });
      if (!res.ok) {
        setFeedbackNote("Could not save feedback.");
        return;
      }
      setFeedbackNote(
        feedback === "ok"
          ? "Marked as OK."
          : feedback === "flag_wrong"
            ? "Flagged — thank you."
            : "Recorded as wrong refusal for admin review.",
      );
    } catch {
      setFeedbackNote("Could not save feedback.");
    }
  }

  function useManual(forCaptions: boolean) {
    if (!manualCtx.trim()) return;
    if (forCaptions) onUseForCaptions(manualCtx);
    else onUseForTos(manualCtx);
  }

  return (
    <div className="space-y-4">
      {/* Mode: video file only (Instagram link mode not shipped) */}
      <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
        <span className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#FF1493]/40 bg-[#FF1493]/15 px-3.5 text-xs font-medium text-white">
          <Film className="h-3.5 w-3.5" /> Video file
        </span>
      </div>

      <div>
        <p className="mb-3 text-sm text-white/55">
          Drop or choose a local video. Frames are sampled in your browser (10+ JPEGs across
          the timeline, up to {MAX_SAMPLE_FRAMES}, max 768px). The video file is never
          uploaded. Faces are never identified.
        </p>
        <label
          className={cn(
            "flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[#D4AF8C]/35 bg-[#D4AF8C]/[0.04] px-4 py-8 text-center transition",
            (busy || disabled || !modelId) && "pointer-events-none opacity-50",
          )}
        >
          <Film className="h-8 w-8 text-[#D4AF8C]/80" />
          <span className="text-sm font-medium text-white/80">
            {busy ? "Working…" : "Drop video or tap to choose"}
          </span>
          <span className="text-[11px] text-white/35">MP4, MOV, WebM · stays on device</span>
          <input
            type="file"
            accept="video/*"
            className="hidden"
            disabled={busy || disabled || !modelId}
            onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
          />
        </label>
        {disabled && (
          <p className="mt-2 text-xs text-amber-200/80">
            Analysis disabled until birth date / 18+ is set on the persona.
          </p>
        )}
      </div>

      {busy && (
        <p className="flex items-center gap-2 text-sm text-white/50">
          <Loader2 className="h-4 w-4 animate-spin" />
          {status}
        </p>
      )}

      {frames.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">
            Frames analysed ({frames.length}
            {duration ? ` · ${formatTs(duration)}` : ""})
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {frames.map((f, i) => {
              const on = selected.has(i);
              return (
                <button
                  key={`${f.timeSec}-${i}`}
                  type="button"
                  onClick={() => toggleFrame(i)}
                  className={cn(
                    "relative shrink-0 overflow-hidden rounded-lg border transition",
                    on
                      ? "border-[#D4AF8C]/60 ring-1 ring-[#D4AF8C]/40"
                      : "border-white/10 opacity-60",
                  )}
                  title={`Toggle frame at ${formatTs(f.timeSec)}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={f.previewUrl}
                    alt=""
                    className="h-20 w-auto object-cover"
                  />
                  <span className="absolute bottom-0 left-0 right-0 bg-black/65 px-1 py-0.5 text-center text-[10px] text-white/85">
                    {formatTs(f.timeSec)}
                  </span>
                </button>
              );
            })}
          </div>

          {videoFile && (
            <div className="flex flex-wrap items-end gap-3 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5">
              <div className="min-w-[160px] flex-1">
                <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/35">
                  Scrubber — pick a representative frame
                </label>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0.05, duration - 0.05)}
                  step={0.05}
                  value={scrubTime}
                  onChange={(e) => setScrubTime(Number(e.target.value))}
                  className="w-full"
                  disabled={busy}
                />
                <p className="mt-0.5 text-[11px] text-white/40">{formatTs(scrubTime)}</p>
              </div>
              <button
                type="button"
                className={cn(VA_BTN_SECONDARY, "px-3 py-2 text-xs")}
                disabled={busy || frames.length >= MAX_SAMPLE_FRAMES}
                onClick={() => void addScrubFrame()}
              >
                Add frame
              </button>
              <button
                type="button"
                className={cn(VA_BTN_PRIMARY, "px-3 py-2 text-xs")}
                disabled={busy || selected.size === 0}
                onClick={() => void reanalyzeSelected()}
              >
                Re-analyse selected ({selected.size})
              </button>
            </div>
          )}
        </div>
      )}

      {/* Dup banner only after successful analysis (not on refusal) */}
      {duplicate && analysis && !analysis.refusal && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-100/90">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {duplicate.kind === "analysed" ? (
              <>
                Looks like a video analysed on {new Date(duplicate.date).toLocaleString()} (
                {duplicate.similarity}% similarity).
              </>
            ) : (
              <>
                Previous attempt on {new Date(duplicate.date).toLocaleString()} could not be
                analysed ({duplicate.similarity}% similarity).
              </>
            )}
          </span>
        </div>
      )}

      {/* Single surface for refusal / status — never duplicate raw model text */}
      {surfaceMessage && (
        <p
          className={cn(
            "text-sm",
            surfaceTone === "error" ? "text-red-300/90" : "text-white/70",
          )}
        >
          {surfaceMessage}
        </p>
      )}

      {analysis && !analysis.refusal && (
        <div className="space-y-3 rounded-2xl border border-white/[0.08] bg-black/30 p-4 text-sm text-white/80 md:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#D4AF8C]/75">
            Analysis
          </p>
          {analysis.quality_flags && (
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(analysis.quality_flags)
                .filter(([, v]) => v)
                .map(([k]) => (
                  <span
                    key={k}
                    className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-100/90"
                  >
                    {k.replace(/_/g, " ")}
                  </span>
                ))}
              {!Object.values(analysis.quality_flags).some(Boolean) && (
                <span className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-100/90">
                  Quality ok
                </span>
              )}
            </div>
          )}
          {analysis.setting && (
            <p>
              <span className="text-white/40">Setting · </span>
              {analysis.setting}
            </p>
          )}
          {analysis.outfit && (
            <p>
              <span className="text-white/40">Outfit · </span>
              {analysis.outfit}
            </p>
          )}
          {analysis.activity && (
            <p>
              <span className="text-white/40">Activity · </span>
              {analysis.activity}
            </p>
          )}
          {analysis.mood_vibe && (
            <p>
              <span className="text-white/40">Mood · </span>
              {analysis.mood_vibe}
            </p>
          )}
          {analysis.objects_props?.length ? (
            <p>
              <span className="text-white/40">Props · </span>
              {analysis.objects_props.join(", ")}
            </p>
          ) : null}
          {analysis.visible_text?.length ? (
            <p>
              <span className="text-white/40">Visible text · </span>
              {analysis.visible_text.join(" | ")}
            </p>
          ) : null}
          {analysis.suggested_hooks?.length ? (
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/35">
                Hooks
              </p>
              <div className="flex flex-wrap gap-1.5">
                {analysis.suggested_hooks.map((h) => (
                  <span
                    key={h}
                    className="rounded-lg border border-[#D4AF8C]/30 bg-[#D4AF8C]/10 px-2.5 py-1 text-xs text-[#E8D5B5]"
                  >
                    {h}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              className={cn(VA_BTN_PRIMARY, "min-h-11 px-4 text-xs")}
              onClick={() => onUseForCaptions(ideaContext)}
              disabled={!ideaContext.trim()}
            >
              Write captions from this
            </button>
            <button
              type="button"
              className={cn(VA_BTN_SECONDARY, "min-h-11 px-4 text-xs")}
              onClick={() => onUseForTos(ideaContext)}
              disabled={!ideaContext.trim()}
            >
              Write text on screen from this
            </button>
            {analysisId && (
              <>
                <button
                  type="button"
                  className={cn(VA_BTN_SECONDARY, "min-h-11 px-4 text-xs")}
                  onClick={() => void sendFeedback("ok")}
                >
                  Mark as OK
                </button>
                <button
                  type="button"
                  className={cn(VA_BTN_SECONDARY, "min-h-11 px-4 text-xs")}
                  onClick={() => void sendFeedback("flag_wrong")}
                >
                  Flag was wrong
                </button>
              </>
            )}
          </div>
          {feedbackNote && <p className="text-[11px] text-white/40">{feedbackNote}</p>}
        </div>
      )}

      {/* Manual describe — always available; prominent when analysis failed/refused */}
      <div
        className={cn(
          "space-y-3 rounded-xl border p-4",
          showManualProminent
            ? "border-[#D4AF8C]/35 bg-[#D4AF8C]/08"
            : "border-white/[0.06] bg-black/20",
        )}
      >
        <div>
          <p className="text-sm font-medium text-white/85">Describe the video</p>
          <p className="mt-0.5 text-[12px] text-white/45">
            What happens, setting, outfit, mood, props, any text on screen — 2–3 lines is
            enough. Captions use the model&apos;s persona and existing guardrails. Outputs are
            marked <span className="text-white/70">from your description</span>.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <textarea
            className={cn(VA_FILTER_INPUT, "min-h-[72px] w-full resize-y sm:col-span-2")}
            placeholder="What happens…"
            value={manualWhat}
            onChange={(e) => setManualWhat(e.target.value)}
          />
          <input
            className={cn(VA_FILTER_INPUT, "w-full")}
            placeholder="Setting"
            value={manualSetting}
            onChange={(e) => setManualSetting(e.target.value)}
          />
          <input
            className={cn(VA_FILTER_INPUT, "w-full")}
            placeholder="Outfit"
            value={manualOutfit}
            onChange={(e) => setManualOutfit(e.target.value)}
          />
          <input
            className={cn(VA_FILTER_INPUT, "w-full")}
            placeholder="Mood"
            value={manualMood}
            onChange={(e) => setManualMood(e.target.value)}
          />
          <input
            className={cn(VA_FILTER_INPUT, "w-full")}
            placeholder="Props"
            value={manualProps}
            onChange={(e) => setManualProps(e.target.value)}
          />
          <input
            className={cn(VA_FILTER_INPUT, "w-full sm:col-span-2")}
            placeholder="Any text in the video"
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={cn(VA_BTN_PRIMARY, "px-4 py-2 text-xs")}
            disabled={!manualCtx.trim()}
            onClick={() => useManual(true)}
          >
            Write captions from your description
          </button>
          <button
            type="button"
            className={cn(VA_BTN_SECONDARY, "px-4 py-2 text-xs")}
            disabled={!manualCtx.trim()}
            onClick={() => useManual(false)}
          >
            Write text on screen from your description
          </button>
          {refused && analysisId && (
            <button
              type="button"
              className={cn(VA_BTN_SECONDARY, "px-4 py-2 text-xs")}
              onClick={() => void sendFeedback("wrong_refusal")}
            >
              This was a wrong refusal
            </button>
          )}
        </div>
        {refused && feedbackNote && (
          <p className="text-[11px] text-white/40">{feedbackNote}</p>
        )}
      </div>
    </div>
  );
}
