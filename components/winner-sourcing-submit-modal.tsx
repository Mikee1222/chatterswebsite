"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Trophy, X } from "lucide-react";
import { useToast } from "@/contexts/toast-context";
import { winnerVideoLocalToast } from "@/components/winner-videos-shared";
import { VA_BTN_PRIMARY, VA_FILTER_INPUT } from "@/lib/va-tasks-tokens";
import {
  SUPER_WINNER_VIEW_THRESHOLD,
  WINNER_VIEW_THRESHOLD,
  tierFromViewCount,
  tierLabel,
} from "@/lib/winner-sourcing-helpers";
import { cn } from "@/lib/utils";

type ModelOption = { model_id: string; model_name: string };

export type WinnerSourcingSubmitModalProps = {
  open: boolean;
  onClose: () => void;
};

export function WinnerSourcingSubmitModal({ open, onClose }: WinnerSourcingSubmitModalProps) {
  const { addToast } = useToast();
  const [models, setModels] = React.useState<ModelOption[]>([]);
  const [loadingModels, setLoadingModels] = React.useState(false);
  const [modelId, setModelId] = React.useState("");
  const [videoLink, setVideoLink] = React.useState("");
  const [viewCountRaw, setViewCountRaw] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingModels(true);
    setError(null);
    fetch("/api/winner-sourcing/my-models", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load models"))))
      .then((d: { models?: ModelOption[] }) => {
        if (!cancelled) setModels(d.models ?? []);
      })
      .catch(() => {
        if (!cancelled) setModels([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingModels(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) {
      setModelId("");
      setVideoLink("");
      setViewCountRaw("");
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  const viewCount = Number(String(viewCountRaw).replace(/,/g, "").trim());
  const previewTier = Number.isFinite(viewCount) ? tierFromViewCount(viewCount) : null;
  const belowThreshold =
    viewCountRaw.trim() !== "" && Number.isFinite(viewCount) && viewCount < WINNER_VIEW_THRESHOLD;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const model = models.find((m) => m.model_id === modelId);
    if (!model) {
      setError("Select an assigned model");
      return;
    }
    if (!videoLink.trim()) {
      setError("Video link is required");
      return;
    }
    if (!Number.isFinite(viewCount) || viewCount < 0) {
      setError("Enter a valid view count");
      return;
    }
    if (viewCount < WINNER_VIEW_THRESHOLD) {
      setError(`Needs at least ${WINNER_VIEW_THRESHOLD.toLocaleString()} views`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/winner-sourcing/submissions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model_id: model.model_id,
          model_name: model.model_name,
          video_link: videoLink.trim(),
          view_count: viewCount,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        submission?: { tier: string; view_count: number };
      };
      if (!res.ok) {
        setError(data.error || "Submit failed");
        return;
      }
      const tier = data.submission?.tier === "super_winner" ? "Super Winner" : "Winner";
      addToast(
        winnerVideoLocalToast(
          `ws-ok-${Date.now()}`,
          `${tier} submitted`,
          `Logged as ${tier} (${(data.submission?.view_count ?? viewCount).toLocaleString()} views).`,
          "normal",
        ),
      );
      onClose();
    } catch {
      setError("Network error — try again");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label="Close"
            className="fixed inset-0 z-[120] cursor-default bg-black/70 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ws-submit-title"
            className="fixed inset-x-4 top-[8%] z-[121] mx-auto max-h-[min(85dvh,640px)] w-full max-w-md overflow-y-auto rounded-2xl border border-[#D4AF8C]/20 bg-[#0D0B0D] p-5 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.8)] sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#FF1493]/25 to-[#D4AF8C]/15 text-[#FF1493]">
                  <Trophy className="h-5 w-5" />
                </span>
                <div>
                  <h2 id="ws-submit-title" className="text-lg font-semibold tracking-tight text-white">
                    Add a Winner / Super Winner
                  </h2>
                  <p className="mt-0.5 text-xs text-[#B8B4B8]/60">
                    {WINNER_VIEW_THRESHOLD.toLocaleString()}+ views → Winner ·{" "}
                    {SUPER_WINNER_VIEW_THRESHOLD.toLocaleString()}+ → Super Winner
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-white/50 transition hover:bg-white/10 hover:text-white"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#D4AF8C]/70">
                  Model
                </span>
                <select
                  className={cn(VA_FILTER_INPUT, "w-full")}
                  value={modelId}
                  onChange={(e) => setModelId(e.target.value)}
                  disabled={loadingModels || submitting}
                  required
                >
                  <option value="">
                    {loadingModels ? "Loading assigned models…" : "Select assigned model"}
                  </option>
                  {models.map((m) => (
                    <option key={m.model_id} value={m.model_id}>
                      {m.model_name}
                    </option>
                  ))}
                </select>
                {!loadingModels && models.length === 0 ? (
                  <p className="text-xs text-amber-300/80">No models assigned to you yet.</p>
                ) : null}
              </label>

              <label className="block space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#D4AF8C]/70">
                  Video link
                </span>
                <input
                  type="url"
                  className={cn(VA_FILTER_INPUT, "w-full")}
                  placeholder="https://…"
                  value={videoLink}
                  onChange={(e) => setVideoLink(e.target.value)}
                  disabled={submitting}
                  required
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#D4AF8C]/70">
                  View count
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  className={cn(
                    VA_FILTER_INPUT,
                    "w-full",
                    belowThreshold && "border-red-500/50 focus:border-red-500/60 focus:ring-red-500/20",
                  )}
                  placeholder="e.g. 250000"
                  value={viewCountRaw}
                  onChange={(e) => setViewCountRaw(e.target.value)}
                  disabled={submitting}
                  required
                />
                {belowThreshold ? (
                  <p className="text-xs text-red-300">
                    Below {WINNER_VIEW_THRESHOLD.toLocaleString()} views — cannot submit.
                  </p>
                ) : previewTier ? (
                  <p
                    className={cn(
                      "text-xs font-medium",
                      previewTier === "super_winner" ? "text-amber-300" : "text-emerald-300",
                    )}
                  >
                    Will submit as {tierLabel(previewTier)}
                  </p>
                ) : null}
              </label>

              {error ? <p className="text-sm text-red-300">{error}</p> : null}

              <button
                type="submit"
                disabled={submitting || belowThreshold || !models.length}
                className={cn(VA_BTN_PRIMARY, "flex w-full items-center justify-center gap-2")}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
                {submitting ? "Submitting…" : "Submit"}
              </button>
            </form>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
