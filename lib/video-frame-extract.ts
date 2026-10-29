/**
 * Client-side video frame extraction + perceptual hash (browser only).
 * Shared by the Video Analyzer and Winner Breakdown tabs.
 * Uploads only small JPEGs for analysis — never the video file (the breakdown
 * tab streams the clip separately for transcription only).
 */

import { aHashFromImageData } from "@/lib/video-frame-hash";
import {
  blankReplacementOffsets,
  clampSeekTime,
  frameCountForDuration,
  isTechnicallyBlankImageData,
  sampleTimestamps,
  type VideoSamplingMeta,
} from "@/lib/video-frame-sampling";

export type SampledFrame = {
  jpeg: string;
  hash: string;
  timeSec: number;
  previewUrl: string;
  byteLength: number;
};


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

export async function extractFramesAtTimes(
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

/** Read duration without decoding frames. */
export async function probeVideoDuration(file: File): Promise<number> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Could not load video"));
    });
    return Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Default evenly spaced sampling for a file, with blank-frame replacement + telemetry. */
export async function sampleVideoFrames(file: File): Promise<{
  frames: SampledFrame[];
  duration: number;
  meta: VideoSamplingMeta;
}> {
  const dur = await probeVideoDuration(file);
  const count = frameCountForDuration(dur);
  const times = sampleTimestamps(dur, count);
  const { frames, duration, blankFramesReplaced, seekTimestamps } = await extractFramesAtTimes(
    file,
    times,
    { replaceBlanks: true },
  );
  return {
    frames,
    duration,
    meta: {
      duration_sec: duration,
      seek_timestamps_sec: seekTimestamps,
      frames_requested: count,
      frames_analysed: frames.length,
      frame_byte_lengths: frames.map((f) => f.byteLength),
      blank_frames_replaced: blankFramesReplaced,
    },
  };
}
