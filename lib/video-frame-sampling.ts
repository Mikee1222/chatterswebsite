/**
 * Video frame sampling helpers (counts, timestamps, technical blank check).
 * Blank detection is a technical blank-frame check, not a content filter.
 */

/** Hard cap for API + UI (long clips may request up to this). */
export const MAX_VIDEO_SAMPLE_FRAMES = 14;
/** Default / minimum evenly spaced samples across a clip. */
export const MIN_VIDEO_SAMPLE_FRAMES = 10;

export type VideoSamplingMeta = {
  duration_sec: number;
  seek_timestamps_sec: number[];
  frames_requested: number;
  frames_analysed: number;
  frame_byte_lengths: number[];
  blank_frames_replaced: number;
  vision_model?: string;
};

/** More frames for longer clips; always at least 10, never above max. */
export function frameCountForDuration(duration: number): number {
  const d = Number.isFinite(duration) && duration > 0 ? duration : 1;
  if (d >= 180) return MAX_VIDEO_SAMPLE_FRAMES;
  if (d >= 90) return 12;
  return MIN_VIDEO_SAMPLE_FRAMES;
}

/** Evenly spaced timestamps including near start / middle / end. */
export function sampleTimestamps(duration: number, count: number): number[] {
  const n = Math.max(1, Math.min(MAX_VIDEO_SAMPLE_FRAMES, count));
  const dur = Number.isFinite(duration) && duration > 0 ? duration : 1;
  const end = Math.max(0, dur - 0.05);
  if (n === 1) return [Math.min(0.05, Math.max(0, end * 0.5))];
  const times: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * end;
    times.push(Math.max(0, Math.min(end, t)));
  }
  return times;
}

/**
 * Technical blank-frame check, not content filter.
 * Drops near-uniform frames (very low pixel variance / blank white/black).
 */
export function isTechnicallyBlankLuma(
  luma: ArrayLike<number>,
  opts?: { varianceThreshold?: number },
): boolean {
  const n = luma.length;
  if (n === 0) return true;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += luma[i] ?? 0;
  const mean = sum / n;
  let varAcc = 0;
  for (let i = 0; i < n; i++) {
    const d = (luma[i] ?? 0) - mean;
    varAcc += d * d;
  }
  const variance = varAcc / n;
  // Near-uniform black/white/grey — technical blank only
  const threshold = opts?.varianceThreshold ?? 40;
  return variance < threshold;
}

/** Extract luma samples from RGBA ImageData-like buffer (stride 4). */
export function lumaFromRgba(
  pixels: ArrayLike<number>,
  width: number,
  height: number,
  sampleSize = 32,
): number[] {
  const size = Math.max(1, Math.min(sampleSize, width, height));
  const out: number[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx = Math.floor((x / size) * width);
      const sy = Math.floor((y / size) * height);
      const i = (sy * width + sx) * 4;
      const r = pixels[i] ?? 0;
      const g = pixels[i + 1] ?? 0;
      const b = pixels[i + 2] ?? 0;
      out.push(0.299 * r + 0.587 * g + 0.114 * b);
    }
  }
  return out;
}

export function isTechnicallyBlankImageData(
  data: { width: number; height: number; data: ArrayLike<number> },
  opts?: { varianceThreshold?: number },
): boolean {
  // Technical blank-frame check, not content filter.
  const luma = lumaFromRgba(data.data, data.width, data.height);
  return isTechnicallyBlankLuma(luma, opts);
}

/** Candidate seek offsets (seconds) to find a non-blank neighbour. */
export function blankReplacementOffsets(): number[] {
  return [0.12, -0.12, 0.28, -0.28, 0.55, -0.55, 1.0, -1.0, 1.6, -1.6];
}

export function clampSeekTime(time: number, duration: number): number {
  const dur = Number.isFinite(duration) && duration > 0 ? duration : 1;
  const end = Math.max(0, dur - 0.05);
  return Math.max(0, Math.min(end, time));
}
