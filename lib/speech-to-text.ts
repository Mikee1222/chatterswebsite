/**
 * Speech-to-text for Winner Breakdown (server-side only).
 * Uses an OpenAI-compatible /audio/transcriptions endpoint:
 *   - OPENAI_API_KEY → api.openai.com, model whisper-1 (override: STT_MODEL)
 *   - GROQ_API_KEY   → api.groq.com,   model whisper-large-v3-turbo (override: STT_MODEL)
 * The video/audio file is streamed straight to the provider and never stored.
 * Approved provider (owner, 2026-10-29): Groq whisper-large-v3-turbo (set GROQ_API_KEY,
 * optionally STT_PROVIDER=groq). Transcripts are never written to logs; every call
 * writes one ai_usage_logs row (feature stt_groq / stt_openai).
 */

import "server-only";

import type { TranscriptSegment } from "@/lib/winner-breakdown-schema";

/** Provider hard limit for whisper-1 / groq free tier. */
export const STT_MAX_FILE_BYTES = 25 * 1024 * 1024;

export type SttProvider = {
  name: "openai" | "groq";
  url: string;
  apiKey: string;
  model: string;
};

/** One ai_usage_logs row per transcription call (same table as the Anthropic calls). */
function recordSttUsage(provider: SttProvider, ok: boolean): void {
  void import("@/services/ai-usage-log")
    .then(({ logAiUsage }) =>
      logAiUsage({ featureKey: `stt_${provider.name}`, model: provider.model, ok }),
    )
    .catch(() => null);
}

export function resolveSttProvider(): SttProvider | null {
  const forced = process.env.STT_PROVIDER?.trim().toLowerCase();
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const groqKey = process.env.GROQ_API_KEY?.trim();
  const override = process.env.STT_MODEL?.trim();

  const useGroq = forced === "groq" ? Boolean(groqKey) : forced === "openai" ? false : !openaiKey && Boolean(groqKey);
  if (useGroq && groqKey) {
    return {
      name: "groq",
      url: "https://api.groq.com/openai/v1/audio/transcriptions",
      apiKey: groqKey,
      model: override || "whisper-large-v3-turbo",
    };
  }
  if (openaiKey) {
    return {
      name: "openai",
      url: "https://api.openai.com/v1/audio/transcriptions",
      apiKey: openaiKey,
      model: override || "whisper-1",
    };
  }
  return null;
}

export type TranscribeResult = {
  text: string;
  segments: TranscriptSegment[];
  language: string;
  durationSec: number | null;
  model: string;
  provider: SttProvider["name"];
};

type VerboseJson = {
  text?: string;
  language?: string;
  duration?: number;
  segments?: Array<{ start?: number; end?: number; text?: string }>;
  error?: { message?: string };
};

export async function transcribeMedia(input: {
  file: Blob;
  filename: string;
  /** ISO-639-1 hint, e.g. "el" or "en". Omit to auto-detect. */
  language?: string;
  prompt?: string;
}): Promise<TranscribeResult> {
  const provider = resolveSttProvider();
  if (!provider) {
    throw new Error("STT_NOT_CONFIGURED");
  }
  if (input.file.size > STT_MAX_FILE_BYTES) {
    throw new Error("FILE_TOO_LARGE");
  }

  const form = new FormData();
  form.append("file", input.file, input.filename || "video.mp4");
  form.append("model", provider.model);
  form.append("response_format", "verbose_json");
  form.append("temperature", "0");
  if (input.language?.trim()) form.append("language", input.language.trim());
  if (input.prompt?.trim()) form.append("prompt", input.prompt.trim().slice(0, 800));
  // OpenAI supports timestamp granularities; Groq ignores unknown fields.
  form.append("timestamp_granularities[]", "segment");

  let res: Response;
  try {
    res = await fetch(provider.url, {
      method: "POST",
      headers: { authorization: `Bearer ${provider.apiKey}` },
      body: form,
    });
  } catch (err) {
    recordSttUsage(provider, false);
    throw err;
  }

  const data = (await res.json().catch(() => ({}))) as VerboseJson;
  if (!res.ok) {
    const msg = data?.error?.message ?? `HTTP ${res.status}`;
    // Never log the audio or the transcript — status + provider message only.
    console.error(`[stt:${provider.name}] transcription failed`, res.status, msg);
    recordSttUsage(provider, false);
    // Status + provider message only (no audio, no transcript) so the UI can say why.
    throw new Error(`STT_FAILED:${res.status}: ${msg}`);
  }
  recordSttUsage(provider, true);

  const segments: TranscriptSegment[] = (data.segments ?? [])
    .map((s) => ({
      start: Number.isFinite(Number(s.start)) ? Number(s.start) : 0,
      end: Number.isFinite(Number(s.end)) ? Number(s.end) : 0,
      text: typeof s.text === "string" ? s.text.trim() : "",
    }))
    .filter((s) => s.text.length > 0);

  const text = (data.text ?? segments.map((s) => s.text).join(" ")).trim();

  return {
    text,
    segments,
    language: typeof data.language === "string" ? data.language : "",
    durationSec: Number.isFinite(Number(data.duration)) ? Number(data.duration) : null,
    model: provider.model,
    provider: provider.name,
  };
}
