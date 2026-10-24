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

const FRAME_COUNT = 7;
const MAX_EDGE = 768;

async function extractFrames(file: File): Promise<{
  jpegs: string[];
  hashes: string[];
  cover: string;
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

    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Canvas unsupported");

    const jpegs: string[] = [];
    const hashes: string[] = [];

    for (let i = 0; i < FRAME_COUNT; i++) {
      const t = ((i + 0.5) / FRAME_COUNT) * duration;
      await seek(video, t);

      const vw = video.videoWidth || 720;
      const vh = video.videoHeight || 1280;
      const scale = Math.min(1, MAX_EDGE / Math.max(vw, vh));
      canvas.width = Math.max(1, Math.round(vw * scale));
      canvas.height = Math.max(1, Math.round(vh * scale));
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
      const b64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");
      jpegs.push(b64);

      // Hash from downscaled 8×8 via ImageData
      const hashCanvas = document.createElement("canvas");
      hashCanvas.width = 32;
      hashCanvas.height = 32;
      const hctx = hashCanvas.getContext("2d", { willReadFrequently: true });
      if (hctx) {
        hctx.drawImage(canvas, 0, 0, 32, 32);
        const img = hctx.getImageData(0, 0, 32, 32);
        hashes.push(aHashFromImageData(img));
      }
    }

    return { jpegs, hashes, cover: jpegs[0] ?? "" };
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

export function CreativeStudioVideoAnalyzer({
  modelId,
  onUseForCaptions,
  onUseForTos,
}: Props) {
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [analysis, setAnalysis] = React.useState<VideoAnalysisJson | null>(null);
  const [ideaContext, setIdeaContext] = React.useState("");
  const [duplicate, setDuplicate] = React.useState<{
    date: string;
    similarity: number;
  } | null>(null);
  const [previews, setPreviews] = React.useState<string[]>([]);

  async function onFile(file: File | null) {
    if (!file || !modelId) return;
    setBusy(true);
    setError(null);
    setAnalysis(null);
    setDuplicate(null);
    setIdeaContext("");
    setStatus("Extracting frames in browser…");
    try {
      const { jpegs, hashes, cover } = await extractFrames(file);
      setPreviews(jpegs.slice(0, 4).map((b) => `data:image/jpeg;base64,${b}`));
      setStatus("Analysing frames (video stays local)…");

      const res = await fetch("/api/creative-studio/analyze-video", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          modelId,
          frames: jpegs,
          frameHashes: hashes,
          coverThumbnailBase64: cover,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        analysis?: VideoAnalysisJson;
        ideaContext?: string;
        duplicate?: { date: string; similarity: number };
        generationDisabledReason?: string;
      };

      if (data.generationDisabledReason) {
        setError(data.generationDisabledReason);
        return;
      }
      if (!res.ok && !data.analysis) {
        setError(data.error ?? "could not analyse, describe manually");
        setAnalysis({
          refusal: true,
          refusal_message: "could not analyse, describe manually",
        });
        return;
      }

      setAnalysis(data.analysis ?? null);
      setIdeaContext(data.ideaContext ?? "");
      if (data.duplicate) {
        setDuplicate({
          date: data.duplicate.date,
          similarity: data.duplicate.similarity,
        });
      }
      if (data.analysis?.refusal) {
        setError(data.analysis.refusal_message || "could not analyse, describe manually");
      }
    } catch {
      setError("could not analyse, describe manually");
      setAnalysis({
        refusal: true,
        refusal_message: "could not analyse, describe manually",
      });
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm text-white/55">
          Choose a local video. Frames are sampled in your browser (6–8 JPEGs, max 768px). The
          video file is never uploaded. Faces are never identified.
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

      {previews.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {previews.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={src}
              alt=""
              className="h-20 w-auto rounded-lg border border-white/10 object-cover"
            />
          ))}
        </div>
      )}

      {duplicate && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-100/90">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Looks like a video analysed on {new Date(duplicate.date).toLocaleString()} (
            {duplicate.similarity}% similarity).
          </span>
        </div>
      )}

      {error && <p className="text-sm text-red-300/90">{error}</p>}

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
            >
              Write captions from this
            </button>
            <button
              type="button"
              className={cn(VA_BTN_SECONDARY, "px-4 py-2 text-xs")}
              onClick={() => onUseForTos(ideaContext)}
            >
              Write text on screen from this
            </button>
          </div>
        </div>
      )}

      {analysis?.refusal && (
        <div className="space-y-2">
          <p className="text-sm text-white/55">
            {analysis.refusal_message || "could not analyse, describe manually"}
          </p>
          <textarea
            className={cn(VA_FILTER_INPUT, "min-h-[80px] w-full resize-y")}
            placeholder="Describe the video manually…"
            value={ideaContext}
            onChange={(e) => setIdeaContext(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={cn(VA_BTN_PRIMARY, "px-4 py-2 text-xs")}
              disabled={!ideaContext.trim()}
              onClick={() => onUseForCaptions(ideaContext)}
            >
              Write captions from this
            </button>
            <button
              type="button"
              className={cn(VA_BTN_SECONDARY, "px-4 py-2 text-xs")}
              disabled={!ideaContext.trim()}
              onClick={() => onUseForTos(ideaContext)}
            >
              Write text on screen from this
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
