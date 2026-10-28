"use client";

/**
 * Winner Breakdown — upload a viral clip, get transcript + the structural reasons
 * it worked (hook, beats, turn, viral elements, must-keep vs flexible, variation angles).
 * Frames are sampled in the browser; the clip is streamed once for transcription only.
 */

import * as React from "react";
import {
  AlertTriangle,
  Check,
  Clock3,
  Copy,
  Film,
  History,
  Loader2,
  Lock,
  Mic,
  RefreshCw,
  Sparkles,
  Trash2,
  Unlock,
  Zap,
} from "lucide-react";
import { sampleVideoFrames, type SampledFrame } from "@/lib/video-frame-extract";
import {
  breakdownToIdeaContext,
  breakdownToMarkdown,
  formatSeconds,
  segmentsToTimedText,
  type TranscriptSegment,
  type WinnerBreakdownJson,
} from "@/lib/winner-breakdown-schema";
import {
  VA_BTN_PRIMARY,
  VA_BTN_SECONDARY,
  VA_FILTER_INPUT,
} from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";

type Props = {
  modelId: string;
  modelName: string;
  /** Fill Bunches winner to prefill from (?winner= in the URL). */
  winnerVideoId?: string | null;
  onUseForCaptions: (ctx: string) => void;
  onUseForTos: (ctx: string) => void;
  /** Optional extra actions rendered next to the result (e.g. Draft briefs). */
  renderActions?: (ctx: { id: string | null; breakdown: WinnerBreakdownJson }) => React.ReactNode;
};

type Step = "idle" | "preparing" | "breaking" | "done";

type HistoryItem = {
  id: string;
  model_id: string | null;
  title: string;
  source_url: string;
  duration_sec: number | null;
  cover_thumbnail_base64: string | null;
  created_by: string;
  created_at: string;
  summary: string;
  hook: string;
};

type LoadedBreakdown = {
  id: string;
  title: string;
  source_url: string;
  source_caption: string;
  notes: string;
  duration_sec: number | null;
  transcript: string;
  transcript_segments: TranscriptSegment[];
  transcript_language: string;
  cover_thumbnail_base64: string | null;
  breakdown: WinnerBreakdownJson;
  breakdown_model: string;
  created_at: string;
};

const MAX_UPLOAD_MB = 25;

/** Parse "[m:ss] text" lines back into segments after the CD edits the transcript. */
function parseTimedText(text: string): TranscriptSegment[] {
  const out: TranscriptSegment[] = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^\s*\[(\d+):(\d{2})\]\s*(.*)$/);
    if (!m) continue;
    const start = Number(m[1]) * 60 + Number(m[2]);
    const t = m[3].trim();
    if (!t) continue;
    if (out.length) out[out.length - 1].end = start;
    out.push({ start, end: start + 3, text: t });
  }
  return out;
}

function humanize(v: string | undefined | null): string {
  return (v ?? "").replace(/_/g, " ");
}

function Section({
  title,
  children,
  accent,
}: {
  title: string;
  children: React.ReactNode;
  accent?: "gold" | "green" | "rose";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        accent === "gold"
          ? "border-[#D4AF8C]/35 bg-[#D4AF8C]/[0.06]"
          : accent === "green"
            ? "border-emerald-400/25 bg-emerald-500/[0.05]"
            : accent === "rose"
              ? "border-rose-400/25 bg-rose-500/[0.05]"
              : "border-white/[0.08] bg-black/25",
      )}
    >
      <p
        className={cn(
          "mb-2.5 text-[11px] font-semibold uppercase tracking-[0.14em]",
          accent === "gold"
            ? "text-[#E8D5B5]"
            : accent === "green"
              ? "text-emerald-200/85"
              : accent === "rose"
                ? "text-rose-200/85"
                : "text-[#D4AF8C]/75",
        )}
      >
        {title}
      </p>
      <div className="space-y-2 text-sm text-white/80">{children}</div>
    </div>
  );
}

function Chip({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "pink" | "gold" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-lg border px-2.5 py-1 text-[11px] font-medium",
        tone === "pink"
          ? "border-[#FF1493]/40 bg-[#FF1493]/12 text-white"
          : tone === "gold"
            ? "border-[#D4AF8C]/35 bg-[#D4AF8C]/10 text-[#E8D5B5]"
            : "border-white/10 bg-white/[0.04] text-white/65",
      )}
    >
      {children}
    </span>
  );
}

type WinnerContext = {
  id: string;
  video_id: string;
  video_link: string;
  note: string;
  reference_model_name: string;
  views_at_submission: number | null;
  status: string;
  video_file_url: string | null;
  video_file_name: string | null;
  transcript: string;
};

export function CreativeStudioWinnerBreakdown({
  modelId,
  modelName,
  winnerVideoId = null,
  onUseForCaptions,
  onUseForTos,
  renderActions,
}: Props) {
  const [step, setStep] = React.useState<Step>("idle");
  const [status, setStatus] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [sttWarning, setSttWarning] = React.useState<string | null>(null);

  const [sourceUrl, setSourceUrl] = React.useState("");
  const [caption, setCaption] = React.useState("");
  const [notes, setNotes] = React.useState("");

  const [file, setFile] = React.useState<File | null>(null);
  const [frames, setFrames] = React.useState<SampledFrame[]>([]);
  const [duration, setDuration] = React.useState<number | null>(null);
  const [transcriptText, setTranscriptText] = React.useState("");
  const [transcriptLang, setTranscriptLang] = React.useState("");
  const [sttModel, setSttModel] = React.useState("");
  const [transcriptDirty, setTranscriptDirty] = React.useState(false);

  const [resultId, setResultId] = React.useState<string | null>(null);
  const [breakdown, setBreakdown] = React.useState<WinnerBreakdownJson | null>(null);
  const [breakdownModel, setBreakdownModel] = React.useState("");
  const [cover, setCover] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  const [history, setHistory] = React.useState<HistoryItem[]>([]);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [historyBusy, setHistoryBusy] = React.useState(false);

  const [winner, setWinner] = React.useState<WinnerContext | null>(null);
  const [winnerNote, setWinnerNote] = React.useState<string | null>(null);

  const busy = step === "preparing" || step === "breaking";

  const loadHistory = React.useCallback(async () => {
    setHistoryBusy(true);
    try {
      const res = await fetch(
        `/api/creative-studio/breakdown?modelId=${encodeURIComponent(modelId)}&limit=30`,
      );
      const data = (await res.json().catch(() => ({}))) as { items?: HistoryItem[] };
      setHistory(Array.isArray(data.items) ? data.items : []);
    } catch {
      /* ignore */
    } finally {
      setHistoryBusy(false);
    }
  }, [modelId]);

  React.useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  // Prefill from a Fill Bunches winner (?winner=). Tries to fetch an uploaded file; else asks for a drop.
  const winnerLoadedRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!winnerVideoId || winnerLoadedRef.current === winnerVideoId) return;
    winnerLoadedRef.current = winnerVideoId;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/creative-studio/breakdown/winner-context?winnerId=${encodeURIComponent(winnerVideoId)}`,
        );
        const data = (await res.json().catch(() => ({}))) as { winner?: WinnerContext; error?: string };
        if (cancelled || !data.winner) {
          if (!cancelled) setWinnerNote(data.error ?? "Could not load that winner.");
          return;
        }
        const w = data.winner;
        setWinner(w);
        setSourceUrl(w.video_link ?? "");
        const noteParts: string[] = [];
        if (w.reference_model_name) noteParts.push(`Reference account: ${w.reference_model_name}`);
        if (w.views_at_submission != null) noteParts.push(`Views at submission: ${w.views_at_submission.toLocaleString()}`);
        if (w.note?.trim()) noteParts.push(`Research note: ${w.note.trim()}`);
        setNotes(noteParts.join("\n"));
        if (w.video_file_url) {
          try {
            const fileRes = await fetch(w.video_file_url);
            if (!fileRes.ok) throw new Error("fetch failed");
            const blob = await fileRes.blob();
            if (cancelled) return;
            const file = new File([blob], w.video_file_name || `winner-${w.video_id || w.id}.mp4`, {
              type: blob.type || "video/mp4",
            });
            setWinnerNote(`Loaded winner ${w.video_id || ""} from Fill Bunches.`);
            await onFile(file);
            return;
          } catch {
            /* fall through to manual drop */
          }
        }
        setWinnerNote(
          `Winner ${w.video_id || ""} loaded from Fill Bunches. Download the reel from the reference link and drop it here to break it down.`,
        );
      } catch {
        if (!cancelled) setWinnerNote("Could not load that winner.");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winnerVideoId]);

  function resetAll() {
    setStep("idle");
    setStatus(null);
    setError(null);
    setSttWarning(null);
    setFile(null);
    setFrames([]);
    setDuration(null);
    setTranscriptText("");
    setTranscriptLang("");
    setSttModel("");
    setTranscriptDirty(false);
    setResultId(null);
    setBreakdown(null);
    setBreakdownModel("");
    setCover(null);
  }

  async function transcribe(f: File): Promise<{
    text: string;
    segments: TranscriptSegment[];
    language: string;
    durationSec: number | null;
    sttModel: string;
  } | null> {
    const form = new FormData();
    form.append("file", f, f.name || "video.mp4");
    const res = await fetch("/api/creative-studio/breakdown/transcribe", {
      method: "POST",
      body: form,
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      code?: string;
      text?: string;
      segments?: TranscriptSegment[];
      language?: string;
      durationSec?: number | null;
      sttModel?: string;
    };
    if (!res.ok) {
      setSttWarning(
        data.error ??
          "Transcription failed — you can type the spoken words below and run the breakdown.",
      );
      return null;
    }
    return {
      text: data.text ?? "",
      segments: Array.isArray(data.segments) ? data.segments : [],
      language: data.language ?? "",
      durationSec: typeof data.durationSec === "number" ? data.durationSec : null,
      sttModel: data.sttModel ?? "",
    };
  }

  async function runBreakdown(opts: {
    framesToSend: SampledFrame[];
    transcript: string;
    segments: TranscriptSegment[];
    language: string;
    sttModel: string;
    durationSec: number | null;
  }) {
    setStep("breaking");
    setStatus("Breaking down the winner…");
    setError(null);
    try {
      const res = await fetch("/api/creative-studio/breakdown", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          modelId: modelId || null,
          winnerVideoId: winner?.id ?? winnerVideoId ?? null,
          sourceUrl,
          sourceCaption: caption,
          notes,
          durationSec: opts.durationSec,
          transcript: opts.transcript,
          transcriptSegments: opts.segments,
          transcriptLanguage: opts.language,
          sttModel: opts.sttModel,
          frames: opts.framesToSend.map((f) => f.jpeg),
          frameHashes: opts.framesToSend.map((f) => f.hash),
          coverThumbnailBase64: opts.framesToSend[0]?.jpeg,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        id?: string | null;
        breakdown?: WinnerBreakdownJson;
        model?: string;
        refused?: boolean;
      };
      if (!res.ok || !data.breakdown || data.breakdown.refusal) {
        setError(
          data.breakdown?.refusal_message ??
            data.error ??
            "Breakdown failed. Try again or add the caption / notes.",
        );
        setStep("done");
        return;
      }
      setBreakdown(data.breakdown);
      setResultId(data.id ?? null);
      setBreakdownModel(data.model ?? "");
      setCover(opts.framesToSend[0]?.previewUrl ?? null);
      setStep("done");
      void loadHistory();
    } catch {
      setError("Breakdown failed. Check your connection and try again.");
      setStep("done");
    } finally {
      setStatus(null);
    }
  }

  async function onFile(f: File | null) {
    if (!f) return;
    resetAll(); // keeps source / caption / notes — they belong to the next run too
    setFile(f);
    if (f.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setSttWarning(
        `This file is over ${MAX_UPLOAD_MB} MB, so it will not be transcribed. Frames still work — paste the spoken words below if there are any.`,
      );
    }
    setStep("preparing");
    setStatus("Sampling frames in your browser + transcribing audio…");
    try {
      const canTranscribe = f.size <= MAX_UPLOAD_MB * 1024 * 1024;
      const [sampled, stt] = await Promise.all([
        sampleVideoFrames(f),
        canTranscribe ? transcribe(f) : Promise.resolve(null),
      ]);
      setFrames(sampled.frames);
      setDuration(sampled.duration);
      const timed = stt?.segments.length ? segmentsToTimedText(stt.segments) : stt?.text ?? "";
      setTranscriptText(timed);
      setTranscriptLang(stt?.language ?? "");
      setSttModel(stt?.sttModel ?? "");
      setTranscriptDirty(false);
      await runBreakdown({
        framesToSend: sampled.frames,
        transcript: stt?.text ?? "",
        segments: stt?.segments ?? [],
        language: stt?.language ?? "",
        sttModel: stt?.sttModel ?? "",
        durationSec: stt?.durationSec ?? sampled.duration,
      });
    } catch {
      setError("Could not read that video. Try an MP4 or MOV export.");
      setStep("idle");
      setStatus(null);
    }
  }

  async function rerunWithEdits() {
    if (!frames.length && !transcriptText.trim()) return;
    const segments = parseTimedText(transcriptText);
    const plain = segments.length
      ? segments.map((s) => s.text).join(" ")
      : transcriptText.replace(/\[\d+:\d{2}\]\s*/g, "").trim();
    await runBreakdown({
      framesToSend: frames,
      transcript: plain,
      segments,
      language: transcriptLang,
      sttModel: sttModel,
      durationSec: duration,
    });
    setTranscriptDirty(false);
  }

  async function openHistory(item: HistoryItem) {
    setHistoryBusy(true);
    try {
      const res = await fetch(`/api/creative-studio/breakdown/${encodeURIComponent(item.id)}`);
      const data = (await res.json().catch(() => ({}))) as { item?: LoadedBreakdown };
      const row = data.item;
      if (!row) return;
      resetAll();
      setSourceUrl(row.source_url);
      setCaption(row.source_caption);
      setNotes(row.notes);
      setDuration(row.duration_sec);
      setTranscriptText(
        row.transcript_segments.length
          ? segmentsToTimedText(row.transcript_segments)
          : row.transcript,
      );
      setTranscriptLang(row.transcript_language);
      setBreakdown(row.breakdown);
      setResultId(row.id);
      setBreakdownModel(row.breakdown_model);
      setCover(
        row.cover_thumbnail_base64 ? `data:image/jpeg;base64,${row.cover_thumbnail_base64}` : null,
      );
      setStep("done");
      setHistoryOpen(false);
    } finally {
      setHistoryBusy(false);
    }
  }

  async function deleteHistory(id: string) {
    if (!window.confirm("Delete this breakdown?")) return;
    const res = await fetch(`/api/creative-studio/breakdown/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setHistory((h) => h.filter((x) => x.id !== id));
      if (resultId === id) resetAll();
    }
  }

  async function copyMarkdown() {
    if (!breakdown) return;
    try {
      await navigator.clipboard.writeText(
        breakdownToMarkdown(breakdown, { sourceUrl: sourceUrl || undefined }),
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  const ideaCtx = breakdown ? breakdownToIdeaContext(breakdown) : "";

  return (
    <div className="space-y-4">
      {/* Intro + history toggle */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <p className="text-sm text-white/80">
            Drop a winner from research. You get the transcript, the hook, the structure, the
            exact elements that made it spread, and what must stay vs what can change when{" "}
            <span className="text-white">{modelName || "the creator"}</span> recreates it.
          </p>
          <p className="mt-1 text-[12px] text-white/40">
            Frames are sampled in your browser. The clip is streamed once for transcription only
            and never stored. Faces are never identified.
          </p>
        </div>
        <button
          type="button"
          className={cn(VA_BTN_SECONDARY, "min-h-10 px-3 text-xs")}
          onClick={() => setHistoryOpen((o) => !o)}
        >
          <History className="mr-1.5 h-3.5 w-3.5" />
          Recent ({history.length})
        </button>
      </div>

      {historyOpen && (
        <div className="rounded-2xl border border-white/[0.08] bg-black/25 p-3">
          {historyBusy && !history.length ? (
            <p className="flex items-center gap-2 text-xs text-white/50">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
            </p>
          ) : history.length === 0 ? (
            <p className="text-xs text-white/45">No breakdowns yet.</p>
          ) : (
            <ul className="divide-y divide-white/[0.06]">
              {history.map((h) => (
                <li key={h.id} className="flex items-center gap-3 py-2">
                  {h.cover_thumbnail_base64 ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`data:image/jpeg;base64,${h.cover_thumbnail_base64}`}
                      alt=""
                      className="h-12 w-8 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <div className="h-12 w-8 shrink-0 rounded-md bg-white/[0.05]" />
                  )}
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => void openHistory(h)}
                  >
                    <p className="truncate text-sm text-white/85">{h.title || h.hook || "Untitled"}</p>
                    <p className="truncate text-[11px] text-white/40">
                      {new Date(h.created_at).toLocaleString()}
                      {h.duration_sec ? ` · ${formatSeconds(h.duration_sec)}` : ""}
                      {h.summary ? ` · ${h.summary}` : ""}
                    </p>
                  </button>
                  <button
                    type="button"
                    className="rounded-lg p-2 text-white/35 hover:bg-white/[0.06] hover:text-rose-300"
                    title="Delete"
                    onClick={() => void deleteHistory(h.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Inputs */}
      <div className="grid gap-3 md:grid-cols-[1.1fr_1fr]">
        <label
          className={cn(
            "flex min-h-[160px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[#FF1493]/40 bg-[#FF1493]/[0.05] px-4 py-8 text-center transition",
            busy && "pointer-events-none opacity-50",
          )}
        >
          {busy ? (
            <Loader2 className="h-8 w-8 animate-spin text-[#FF1493]/80" />
          ) : (
            <Film className="h-8 w-8 text-[#FF1493]/80" />
          )}
          <span className="text-sm font-medium text-white/85">
            {busy ? status : file ? "Drop another winner" : "Drop the winner video or tap to choose"}
          </span>
          <span className="text-[11px] text-white/35">
            MP4 / MOV · up to {MAX_UPLOAD_MB} MB for transcription
          </span>
          <input
            type="file"
            accept="video/*"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              e.target.value = "";
              void onFile(f);
            }}
          />
        </label>

        <div className="space-y-2">
          <input
            className={cn(VA_FILTER_INPUT, "w-full")}
            placeholder="Source link (Instagram / TikTok) — optional"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            disabled={busy}
          />
          <textarea
            className={cn(VA_FILTER_INPUT, "min-h-[60px] w-full resize-y")}
            placeholder="Original caption / post text — optional, helps a lot"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            disabled={busy}
          />
          <textarea
            className={cn(VA_FILTER_INPUT, "min-h-[48px] w-full resize-y")}
            placeholder="Notes for the AI — e.g. views, why research flagged it, what you noticed"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={busy}
          />
        </div>
      </div>

      {winnerNote && (
        <div className="flex items-start gap-2 rounded-xl border border-[#D4AF8C]/30 bg-[#D4AF8C]/[0.07] px-3 py-2.5 text-sm text-[#E8D5B5]">
          <Film className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{winnerNote}</span>
        </div>
      )}
      {sttWarning && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-100/90">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{sttWarning}</span>
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-100/90">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Frames strip */}
      {frames.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {frames.map((f, i) => (
            <div
              key={`${f.timeSec}-${i}`}
              className="relative shrink-0 overflow-hidden rounded-lg border border-white/10"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.previewUrl} alt="" className="h-16 w-auto object-cover" />
              <span className="absolute bottom-0 left-0 right-0 bg-black/65 px-1 py-0.5 text-center text-[10px] text-white/85">
                {formatSeconds(f.timeSec)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Transcript (editable) */}
      {(step === "done" || step === "breaking" || (step === "idle" && file)) && (
        <div className="rounded-2xl border border-white/[0.08] bg-black/25 p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#D4AF8C]/75">
              <Mic className="h-3.5 w-3.5" /> Transcript
              {transcriptLang ? <Chip>{transcriptLang.toUpperCase()}</Chip> : null}
              {duration ? (
                <Chip>
                  <Clock3 className="mr-1 h-3 w-3" />
                  {formatSeconds(duration)}
                </Chip>
              ) : null}
            </p>
            <button
              type="button"
              className={cn(VA_BTN_SECONDARY, "min-h-9 px-3 text-xs")}
              disabled={busy || (!frames.length && !transcriptText.trim())}
              onClick={() => void rerunWithEdits()}
              title="Fix misheard words, then run the breakdown again"
            >
              <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", step === "breaking" && "animate-spin")} />
              {transcriptDirty ? "Re-run with edits" : "Re-run breakdown"}
            </button>
          </div>
          <textarea
            className={cn(VA_FILTER_INPUT, "min-h-[120px] w-full resize-y font-mono text-[12px] leading-relaxed")}
            placeholder="No speech detected. Type the spoken / on-screen words here (optional) and re-run."
            value={transcriptText}
            onChange={(e) => {
              setTranscriptText(e.target.value);
              setTranscriptDirty(true);
            }}
            disabled={busy}
          />
        </div>
      )}

      {step === "breaking" && (
        <div className="flex items-center gap-2 rounded-xl border border-[#FF1493]/25 bg-[#FF1493]/[0.06] px-3 py-3 text-sm text-white/75">
          <Loader2 className="h-4 w-4 animate-spin text-[#FF1493]" />
          Reading the transcript and frames, finding the viral elements… ~20–40 s
        </div>
      )}

      {/* Result */}
      {breakdown && !breakdown.refusal && (
        <div className="space-y-3">
          {/* Header row */}
          <div className="flex flex-wrap items-center gap-2">
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cover} alt="" className="h-14 w-10 rounded-md object-cover" />
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="text-sm text-white/90">{breakdown.summary}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {breakdown.format ? <Chip tone="pink">{humanize(breakdown.format)}</Chip> : null}
                {breakdown.sound?.type ? <Chip>sound: {humanize(breakdown.sound.type)}</Chip> : null}
                {breakdown.text_on_screen_role && breakdown.text_on_screen_role !== "none" ? (
                  <Chip>text on screen: {humanize(breakdown.text_on_screen_role)}</Chip>
                ) : null}
                {breakdown.confidence ? (
                  <Chip tone={breakdown.confidence === "high" ? "gold" : "neutral"}>
                    confidence: {breakdown.confidence}
                  </Chip>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={cn(VA_BTN_SECONDARY, "min-h-10 px-3 text-xs")}
                onClick={() => void copyMarkdown()}
              >
                {copied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy breakdown"}
              </button>
            </div>
          </div>

          {breakdown.missing_info?.length ? (
            <p className="text-[12px] text-amber-200/75">
              Missing: {breakdown.missing_info.join(" · ")}
            </p>
          ) : null}

          {/* Hook */}
          {breakdown.hook?.text ? (
            <Section title="Hook (first 3 seconds)" accent="gold">
              <p className="text-base font-medium text-white">“{breakdown.hook.text}”</p>
              <p className="text-white/60">
                <Chip>{humanize(breakdown.hook.type)}</Chip>{" "}
                <span className="ml-1">{breakdown.hook.why_it_stops_scroll}</span>
              </p>
            </Section>
          ) : null}

          {/* Must keep / flexible */}
          <div className="grid gap-3 md:grid-cols-2">
            <Section title="Must keep — the viral element" accent="green">
              {breakdown.must_keep?.length ? (
                <ul className="space-y-1.5">
                  {breakdown.must_keep.map((m, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300/80" />
                      <span>{m}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-white/45">—</p>
              )}
            </Section>
            <Section title="Flexible — safe to change">
              {breakdown.flexible?.length ? (
                <ul className="space-y-1.5">
                  {breakdown.flexible.map((m, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Unlock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/40" />
                      <span>{m}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-white/45">—</p>
              )}
            </Section>
          </div>

          {/* Why it works */}
          {breakdown.why_it_works ? (
            <Section title="Why it works" accent="gold">
              <p className="leading-relaxed">{breakdown.why_it_works}</p>
              {breakdown.audience_trigger ? (
                <p className="text-white/65">
                  <span className="text-white/40">Audience trigger · </span>
                  {breakdown.audience_trigger}
                </p>
              ) : null}
              {breakdown.share_driver ? (
                <p className="text-white/65">
                  <span className="text-white/40">Share driver · </span>
                  {breakdown.share_driver}
                </p>
              ) : null}
            </Section>
          ) : null}

          {/* Viral elements */}
          {breakdown.viral_elements?.length ? (
            <Section title="Viral elements">
              <ul className="space-y-2.5">
                {breakdown.viral_elements.map((v, i) => (
                  <li key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <p className="flex flex-wrap items-center gap-2 text-white">
                      <Zap className="h-3.5 w-3.5 text-[#FF1493]" />
                      <span className="font-medium">{v.element}</span>
                      <Chip>{humanize(v.category)}</Chip>
                    </p>
                    <p className="mt-1 text-white/70">{v.why_it_works}</p>
                    {v.evidence ? (
                      <p className="mt-1 text-[12px] text-white/40">Evidence: {v.evidence}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {/* Structure */}
          {breakdown.beats?.length ? (
            <Section title="Structure">
              <ol className="space-y-2">
                {breakdown.beats.map((b, i) => (
                  <li key={i} className="grid grid-cols-[64px_1fr] gap-2">
                    <span className="pt-0.5 font-mono text-[11px] text-[#D4AF8C]/80">
                      {formatSeconds(b.t_start)}–{formatSeconds(b.t_end)}
                    </span>
                    <div>
                      <p className="text-white/85">{b.what_happens}</p>
                      {b.spoken ? <p className="text-white/60">🗣 “{b.spoken}”</p> : null}
                      {b.on_screen_text ? (
                        <p className="text-white/60">🔤 “{b.on_screen_text}”</p>
                      ) : null}
                      <p className="text-[12px] text-white/40">→ {b.purpose}</p>
                    </div>
                  </li>
                ))}
              </ol>
              {breakdown.turn?.what ? (
                <p className="mt-2 rounded-xl border border-[#FF1493]/25 bg-[#FF1493]/[0.06] px-3 py-2 text-white/85">
                  <span className="text-[#FF1493]">The turn · {formatSeconds(breakdown.turn.at_sec)}</span>{" "}
                  {breakdown.turn.what}
                  <span className="block text-[12px] text-white/50">{breakdown.turn.why}</span>
                </p>
              ) : null}
            </Section>
          ) : null}

          {/* Variation angles */}
          {breakdown.variation_angles?.length ? (
            <Section title={`Variation angles for ${modelName || "the creator"}`}>
              <ol className="space-y-2.5">
                {breakdown.variation_angles.map((v, i) => (
                  <li key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <p className="font-medium text-white">
                      {i + 1}. {v.title}
                    </p>
                    <p className="mt-1 text-white/75">{v.premise}</p>
                    <p className="mt-1 text-[12px] text-emerald-200/70">Keeps: {v.keeps}</p>
                    <p className="text-[12px] text-white/45">Changes: {v.changes}</p>
                  </li>
                ))}
              </ol>
            </Section>
          ) : null}

          {breakdown.risks?.length ? (
            <Section title="Risks" accent="rose">
              <ul className="list-disc space-y-1 pl-5">
                {breakdown.risks.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </Section>
          ) : null}

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {renderActions?.({ id: resultId, breakdown })}
            <button
              type="button"
              className={cn(VA_BTN_SECONDARY, "min-h-11 px-4 text-xs")}
              onClick={() => onUseForCaptions(ideaCtx)}
              disabled={!ideaCtx}
            >
              Write captions from this
            </button>
            <button
              type="button"
              className={cn(VA_BTN_SECONDARY, "min-h-11 px-4 text-xs")}
              onClick={() => onUseForTos(ideaCtx)}
              disabled={!ideaCtx}
            >
              Write text on screen from this
            </button>
            <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-white/30">
              <Sparkles className="h-3 w-3" />
              {breakdownModel || "AI"}
            </span>
          </div>
        </div>
      )}

      {step === "idle" && !file && !breakdown && (
        <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-4 text-[12px] text-white/45">
          <p className="font-medium text-white/65">How it works</p>
          <ol className="mt-1.5 list-decimal space-y-1 pl-5">
            <li>Download the winner from the research link (any reel downloader) and drop it here.</li>
            <li>Paste the original caption if you have it — it sharpens the breakdown.</li>
            <li>Check the transcript, fix any misheard words, re-run if needed.</li>
            <li>Use the must-keep list and variation angles to brief the creator.</li>
          </ol>
        </div>
      )}
    </div>
  );
}
