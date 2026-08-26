/**
 * Content quality pre-check: programmatic media checks + optional vision AI.
 * Flags for admin assist only — never auto-rejects.
 */

import sharp from "sharp";
import {
  AI_FAST_MODEL,
  AI_GROUNDING_RULES,
  callAnthropicVision,
  extractJsonObject,
  type AnthropicImageSource,
} from "@/lib/ai-assistant";
import {
  getAiFeatureCache,
  isAiCacheStale,
  upsertAiFeatureCache,
} from "@/services/ai-feature-cache";
import { AI_OPS_FEATURE_KEYS } from "@/services/ai-ops-features";

export type ContentQualityFlag = {
  code: string;
  severity: "info" | "warn" | "critical";
  message: string;
};

export type ContentQualityResult = {
  assignment_id: string | null;
  file_url: string;
  programmatic: ContentQualityFlag[];
  vision: {
    ran: boolean;
    model: string | null;
    summary: string | null;
    flags: ContentQualityFlag[];
  };
  /** Overall: never "reject" — only ok | review */
  recommendation: "ok" | "review";
  generated_at: string;
};

const MIN_WIDTH = 720;
const MIN_HEIGHT = 720;
const MAX_BYTES = 80 * 1024 * 1024;
const VISION_MAX_BYTES = 4 * 1024 * 1024;

function guessMediaType(contentType: string | null, url: string): AnthropicImageSource["mediaType"] | null {
  const ct = (contentType ?? "").toLowerCase();
  if (ct.includes("jpeg") || ct.includes("jpg") || /\.jpe?g(\?|$)/i.test(url)) return "image/jpeg";
  if (ct.includes("png") || /\.png(\?|$)/i.test(url)) return "image/png";
  if (ct.includes("webp") || /\.webp(\?|$)/i.test(url)) return "image/webp";
  if (ct.includes("gif") || /\.gif(\?|$)/i.test(url)) return "image/gif";
  return null;
}

function isLikelyVideo(contentType: string | null, url: string): boolean {
  const ct = (contentType ?? "").toLowerCase();
  return ct.startsWith("video/") || /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url);
}

async function fetchMediaHead(url: string): Promise<{
  contentType: string | null;
  contentLength: number | null;
  ok: boolean;
  status: number;
}> {
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow" });
    const len = res.headers.get("content-length");
    return {
      contentType: res.headers.get("content-type"),
      contentLength: len ? Number(len) : null,
      ok: res.ok,
      status: res.status,
    };
  } catch {
    return { contentType: null, contentLength: null, ok: false, status: 0 };
  }
}

async function fetchBytes(url: string, maxBytes: number): Promise<{
  buffer: Buffer | null;
  contentType: string | null;
  error?: string;
}> {
  try {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) return { buffer: null, contentType: null, error: `HTTP ${res.status}` };
    const contentType = res.headers.get("content-type");
    const ab = await res.arrayBuffer();
    if (ab.byteLength > maxBytes) {
      return { buffer: null, contentType, error: `File too large (${ab.byteLength} bytes)` };
    }
    return { buffer: Buffer.from(ab), contentType };
  } catch (err) {
    return {
      buffer: null,
      contentType: null,
      error: err instanceof Error ? err.message : "Fetch failed",
    };
  }
}

/**
 * Lightweight pre-check before Content Q/A. Never auto-rejects.
 */
export async function runContentQualityPreCheck(input: {
  fileUrl: string;
  assignmentId?: string | null;
  skipVision?: boolean;
  force?: boolean;
}): Promise<ContentQualityResult> {
  const fileUrl = input.fileUrl.trim();
  const programmatic: ContentQualityFlag[] = [];
  const generated_at = new Date().toISOString();
  const cacheKey = `${input.assignmentId ?? "url"}:${fileUrl.slice(0, 160)}`;

  if (!input.force && !input.skipVision) {
    const cached = await getAiFeatureCache(AI_OPS_FEATURE_KEYS.CONTENT_QUALITY, cacheKey);
    // Same URL/assignment → reuse for a week (media rarely changes mid-review).
    if (cached && !isAiCacheStale(cached, 7 * 24 * 60 * 60 * 1000)) {
      const snap = cached.context_snapshot as Partial<ContentQualityResult> | undefined;
      if (snap?.programmatic && snap?.vision && snap?.recommendation) {
        return {
          assignment_id: input.assignmentId ?? null,
          file_url: fileUrl,
          programmatic: snap.programmatic,
          vision: snap.vision,
          recommendation: snap.recommendation,
          generated_at: cached.generated_at,
        };
      }
    }
  }

  if (!fileUrl) {
    return {
      assignment_id: input.assignmentId ?? null,
      file_url: fileUrl,
      programmatic: [{ code: "missing_url", severity: "critical", message: "No file URL provided" }],
      vision: { ran: false, model: null, summary: null, flags: [] },
      recommendation: "review",
      generated_at,
    };
  }

  const head = await fetchMediaHead(fileUrl);
  if (!head.ok) {
    programmatic.push({
      code: "unreachable",
      severity: "warn",
      message: `File URL did not respond OK (status ${head.status || "n/a"}) — admin should verify playability`,
    });
  }
  if (head.contentLength != null && Number.isFinite(head.contentLength)) {
    if (head.contentLength <= 0) {
      programmatic.push({
        code: "empty_file",
        severity: "critical",
        message: "Content-Length is 0",
      });
    } else if (head.contentLength > MAX_BYTES) {
      programmatic.push({
        code: "oversized",
        severity: "warn",
        message: `File is large (${Math.round(head.contentLength / (1024 * 1024))} MB)`,
      });
    }
  }

  const video = isLikelyVideo(head.contentType, fileUrl);
  if (video) {
    programmatic.push({
      code: "video_detected",
      severity: "info",
      message: "Video detected — programmatic frame extract skipped; vision uses a still only when an image URL is supplied",
    });
    // Light playability signal: reachable + non-zero length
    if (head.ok && (head.contentLength == null || head.contentLength > 1024)) {
      programmatic.push({
        code: "video_reachable",
        severity: "info",
        message: "Video URL appears reachable",
      });
    } else {
      programmatic.push({
        code: "video_playability_uncertain",
        severity: "warn",
        message: "Could not confirm video playability from headers alone",
      });
    }
  }

  let imageBuffer: Buffer | null = null;
  let imageMediaType: AnthropicImageSource["mediaType"] | null = null;

  if (!video) {
    const fetched = await fetchBytes(fileUrl, Math.min(MAX_BYTES, 25 * 1024 * 1024));
    if (!fetched.buffer) {
      programmatic.push({
        code: "download_failed",
        severity: "warn",
        message: fetched.error ?? "Could not download media for dimension checks",
      });
    } else {
      imageBuffer = fetched.buffer;
      imageMediaType = guessMediaType(fetched.contentType, fileUrl) ?? "image/jpeg";
      try {
        const meta = await sharp(fetched.buffer, { failOn: "none" }).metadata();
        const w = meta.width ?? 0;
        const h = meta.height ?? 0;
        if (w > 0 && h > 0) {
          if (w < MIN_WIDTH || h < MIN_HEIGHT) {
            programmatic.push({
              code: "low_resolution",
              severity: "warn",
              message: `Resolution ${w}×${h} is below ${MIN_WIDTH}×${MIN_HEIGHT}`,
            });
          } else {
            programmatic.push({
              code: "resolution_ok",
              severity: "info",
              message: `Resolution ${w}×${h}`,
            });
          }
          const ratio = w / h;
          if (ratio < 0.4 || ratio > 2.5) {
            programmatic.push({
              code: "unusual_aspect",
              severity: "warn",
              message: `Unusual aspect ratio (${ratio.toFixed(2)})`,
            });
          }
        } else {
          programmatic.push({
            code: "dimensions_unknown",
            severity: "warn",
            message: "Could not read image dimensions",
          });
        }
      } catch {
        programmatic.push({
          code: "decode_failed",
          severity: "warn",
          message: "Image could not be decoded — may be corrupt or unsupported",
        });
      }
    }
  }

  const visionFlags: ContentQualityFlag[] = [];
  let visionSummary: string | null = null;
  let visionModel: string | null = null;
  let visionRan = false;

  if (!input.skipVision && imageBuffer && imageBuffer.length <= VISION_MAX_BYTES && imageMediaType) {
    visionRan = true;
    const thumb = await sharp(imageBuffer)
      .resize({ width: 768, height: 768, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer()
      .catch(() => imageBuffer);

    const result = await callAnthropicVision({
      text: `You are a fast content QA assistant for an OnlyFans agency.
Flag ONLY clear, objective issues visible in this single frame/thumbnail (blur, crop cut-off, upside-down, extreme darkness, obvious watermark blocking subject, blank/black frame).
Do NOT reject or invent policy violations. Never recommend auto-rejection.
Return JSON only:
{"summary":"one sentence","flags":[{"code":"blurry|cropped|dark|watermark|blank|other","severity":"info|warn","message":"..."}]}
If nothing notable: {"summary":"No clear visual issues","flags":[]}
${AI_GROUNDING_RULES}`,
      images: [
        {
          mediaType: "image/jpeg",
          base64: (thumb ?? imageBuffer).toString("base64"),
        },
      ],
      maxTokens: 300,
      temperature: 0.1,
      logLabel: "content-quality-vision",
      model: AI_FAST_MODEL,
    });

    if (result) {
      visionModel = result.model;
      const parsed = extractJsonObject(result.text);
      visionSummary =
        (typeof parsed?.summary === "string" && parsed.summary.trim()) || result.text.slice(0, 240);
      if (Array.isArray(parsed?.flags)) {
        for (const item of parsed!.flags as unknown[]) {
          if (!item || typeof item !== "object") continue;
          const row = item as Record<string, unknown>;
          const code = typeof row.code === "string" ? row.code : "other";
          const message = typeof row.message === "string" ? row.message.trim() : "";
          const severity = row.severity === "warn" ? "warn" : "info";
          if (message) visionFlags.push({ code, severity, message });
        }
      }
    } else {
      visionSummary = "Vision check skipped (API unavailable)";
    }
  }

  const needsReview =
    programmatic.some((f) => f.severity === "warn" || f.severity === "critical") ||
    visionFlags.some((f) => f.severity === "warn" || f.severity === "critical");

  const out: ContentQualityResult = {
    assignment_id: input.assignmentId ?? null,
    file_url: fileUrl,
    programmatic,
    vision: {
      ran: visionRan,
      model: visionModel,
      summary: visionSummary,
      flags: visionFlags,
    },
    recommendation: needsReview ? "review" : "ok",
    generated_at,
  };

  await upsertAiFeatureCache({
    featureKey: AI_OPS_FEATURE_KEYS.CONTENT_QUALITY,
    cacheKey,
    contentText: visionSummary ?? programmatic.map((p) => p.message).join("; "),
    contextSnapshot: out as unknown as Record<string, unknown>,
    model: visionModel,
  }).catch(() => null);

  return out;
}
