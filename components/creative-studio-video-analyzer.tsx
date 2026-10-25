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
};

type SampledFrame = {
  jpeg: string;
  hash: string;
  timeSec: number;
  previewUrl: string;
};

type PriorMatch = {
  date: string;
  similarity: number;
  kind: "analysed" | "could_not_analyse";
};

const MAX_SAMPLE_FRAMES = 10;
const MAX_EDGE = 768;
const MIN_SAMPLE_FRAMES = 4;

function sampleTimestamps(duration: number, count: number): number[] {
  const n = Math.max(1, Math.min(MAX_SAMPLE_FRAMES, count));
  if (n === 1) return [Math.min(0.05, Math.max(0, duration * 0.5))];
  const times: number[] = [];
  for (let i = 0; i < n; i++) {
    // Evenly across whole timeline including near start / middle / end
    const t = (i / (n - 1)) * Math.max(0, duration - 0.05);
    times.push(Math.max(0, Math.min(duration - 0.05, t)));
  }
  return times;
}

function frameCountForDuration(duration: number): number {
  if (duration >= 90) return 10;
  if (duration >= 45) return 9;
  if (duration >= 20) return 8;
  if (duration >= 10) return 7;
  return Math.max(MIN_SAMPLE_FRAMES, 6);
}

async function extractFramesAtTimes(
  file: File,
  times: number[],
): Promise<{ frames: SampledFrame[]; duration: number }> {
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
    for (const t of times) {
      await seek(video, t);

      const vw = video.videoWidth || 720;
      const vh = video.videoHeight || 1280;
      const scale = Math.min(1, MAX_EDGE / Math.max(vw, vh));
      canvas.width = Math.max(1, Math.round(vw * scale));
      canvas.height = Math.max(1, Math.round(vh * scale));
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
      const b64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");

      let hash = "";
      const hashCanvas = document.createElement("canvas");
      hashCanvas.width = 32;
      hashCanvas.height = 32;
      const hctx = hashCanvas.getContext("2d", { willReadFrequently: true });
      if (hctx) {
        hctx.drawImage(canvas, 0, 0, 32, 32);
        const img = hctx.getImageData(0, 0, 32, 32);
        hash = aHashFromImageData(img);
      }

      frames.push({
        jpeg: b64,
        hash,
        timeSec: t,
        previewUrl: `data:image/jpeg;base64,${b64}`,
      });
    }

    return { frames, duration };
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

  async function runAnalysis(framesToSend: SampledFrame[]) {
    if (!framesToSend.length || !modelId) return;
    setBusy(true);
    resetResultState();
    setStatus("Analysing frames (video stays local)…");
    try {
      const res = await fetch("/api/creative-studio/analyze-video", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          modelId,
          frames: framesToSend.map((f) => f.jpeg),
          frameHashes: framesToSend.map((f) => f.hash),
          coverThumbnailBase64: framesToSend[0]?.jpeg,
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
      const { frames: sampled, duration: d } = await extractFramesAtTimes(file, times);
      setDuration(d);
      setFrames(sampled);
      setSelected(new Set(sampled.map((_, i) => i)));
      setScrubTime(0);
      await runAnalysis(sampled);
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
      <div>
        <p className="mb-2 text-sm text-white/55">
          Choose a local video. Frames are sampled in your browser (up to {MAX_SAMPLE_FRAMES}{" "}
          JPEGs across the timeline, max 768px). The video file is never uploaded. Faces are
          never identified.
        </p>
        <label
          className={cn(
            VA_BTN_SECONDARY,
            "inline-flex cursor-pointer items-center gap-2 px-4 py-2.5 text-sm",
            busy && "pointer-events-none opacity-50",
          )}
        >
          <Film className="h-4 w-4" />
          {busy ? "Working…" : "Choose video"}
          <input
            type="file"
            accept="video/*"
            className="hidden"
            disabled={busy || !modelId}
            onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
          />
        </label>
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

      {duplicate && (
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
        <div className="space-y-3 rounded-xl border border-white/[0.06] bg-black/25 p-4 text-sm text-white/80">
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
          {analysis.quality_flags && (
            <p>
              <span className="text-white/40">Quality · </span>
              {Object.entries(analysis.quality_flags)
                .filter(([, v]) => v)
                .map(([k]) => k.replace(/_/g, " "))
                .join(", ") || "ok"}
            </p>
          )}
          {analysis.suggested_hooks?.length ? (
            <p>
              <span className="text-white/40">Hooks · </span>
              {analysis.suggested_hooks.join(" · ")}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              className={cn(VA_BTN_PRIMARY, "px-4 py-2 text-xs")}
              onClick={() => onUseForCaptions(ideaContext)}
              disabled={!ideaContext.trim()}
            >
              Write captions from this
            </button>
            <button
              type="button"
              className={cn(VA_BTN_SECONDARY, "px-4 py-2 text-xs")}
              onClick={() => onUseForTos(ideaContext)}
              disabled={!ideaContext.trim()}
            >
              Write text on screen from this
            </button>
            {analysisId && (
              <>
                <button
                  type="button"
                  className={cn(VA_BTN_SECONDARY, "px-4 py-2 text-xs")}
                  onClick={() => void sendFeedback("ok")}
                >
                  Mark as OK
                </button>
                <button
                  type="button"
                  className={cn(VA_BTN_SECONDARY, "px-4 py-2 text-xs")}
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
