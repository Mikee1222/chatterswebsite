"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Loader2, Send, Trophy } from "lucide-react";
import { useToast } from "@/contexts/toast-context";
import { winnerVideoLocalToast } from "@/components/winner-videos-shared";
import { VA_BTN_PRIMARY, VA_CARD, VA_CARD_GLOW, VA_FILTER_INPUT } from "@/lib/va-tasks-tokens";
import type { VideoBunch } from "@/services/winner-sourcing";
import { cn } from "@/lib/utils";

function BunchProgress({ bunch }: { bunch: VideoBunch }) {
  const filled = bunch.provided_count ?? 0;
  const pending = bunch.pending_review_count ?? 0;
  const remaining = bunch.remaining_count ?? Math.max(0, bunch.target_video_count - filled - pending);
  return (
    <p className="text-xs text-[#B8B4B8]/50">
      Filled {filled} · Pending review {pending} · Still needed {remaining} / {bunch.target_video_count}
    </p>
  );
}

export function WinnerRecreatesClient({ initialBunches }: { initialBunches: VideoBunch[] }) {
  const { addToast } = useToast();
  const [bunches, setBunches] = React.useState(initialBunches);
  const [bunchId, setBunchId] = React.useState(initialBunches[0]?.id ?? "");
  const [description, setDescription] = React.useState("");
  const [videoLink, setVideoLink] = React.useState("");
  const [videoType, setVideoType] = React.useState<"skit" | "ugc" | "other" | "">("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const selected = bunches.find((b) => b.id === bunchId);

  async function refreshBunches() {
    const res = await fetch("/api/winner-sourcing/bunches?status=open", { credentials: "include" });
    if (!res.ok) return;
    const d = await res.json();
    const list = (d.bunches ?? []) as VideoBunch[];
    setBunches(list);
    if (!list.find((b) => b.id === bunchId)) {
      setBunchId(list[0]?.id ?? "");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!bunchId) {
      setError("Select an open bunch with remaining capacity");
      return;
    }
    if (!videoType) {
      setError("Select video type");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/winner-sourcing/bunches/${bunchId}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          video_link: videoLink,
          video_type: videoType,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Submit failed");
        return;
      }
      addToast(
        winnerVideoLocalToast(
          `ws-rs-${Date.now()}`,
          "Submitted for review",
          `Pending in Research Manage · ${selected?.name ?? "bunch"}`,
          "normal",
        ),
      );
      setDescription("");
      setVideoLink("");
      setVideoType("");
      await refreshBunches();
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-[#D4AF8C]/15 bg-gradient-to-br from-[#151315] to-[#0D0B0D] px-6 py-8">
        <div
          className="pointer-events-none absolute -right-10 top-0 h-40 w-40 rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(255,20,147,0.3), transparent 70%)" }}
        />
        <div className="relative flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FF1493]/15 text-[#FF1493]">
            <Trophy className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">Fill Bunches</h1>
            <p className="mt-1 text-sm text-[#B8B4B8]/65">
              Submit finds into open bunches. Admins approve in Research Manage before a slot is created.
            </p>
          </div>
        </div>
      </div>

      {bunches.length > 0 ? (
        <div className={cn(VA_CARD, "space-y-2 p-4")}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#D4AF8C]/70">
            Bunch progress
          </p>
          <ul className="space-y-2">
            {bunches.map((b) => (
              <li key={b.id} className="flex flex-col gap-0.5 border-b border-white/[0.04] pb-2 last:border-0 last:pb-0">
                <span className="text-sm text-white">{b.name}</span>
                <span className="text-xs text-[#B8B4B8]/45">{b.model_name}</span>
                <BunchProgress bunch={b} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <motion.form
        onSubmit={(e) => void handleSubmit(e)}
        className={cn(VA_CARD, VA_CARD_GLOW, "space-y-4 p-5 md:p-6")}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <label className="block space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#D4AF8C]/70">
            Open bunch
          </span>
          <select
            className={cn(VA_FILTER_INPUT, "w-full")}
            value={bunchId}
            onChange={(e) => setBunchId(e.target.value)}
            required
            disabled={submitting}
          >
            <option value="">Select bunch…</option>
            {bunches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} — {b.model_name} ({b.remaining_count ?? 0} remaining / {b.target_video_count})
              </option>
            ))}
          </select>
          {selected ? <BunchProgress bunch={selected} /> : null}
          {!bunches.length ? (
            <p className="text-xs text-amber-300/80">No open bunches with remaining capacity.</p>
          ) : null}
        </label>

        <label className="block space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#D4AF8C]/70">
            Description
          </span>
          <textarea
            className={cn(VA_FILTER_INPUT, "min-h-[88px] w-full py-2")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What should be recreated?"
            required
            disabled={submitting}
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#D4AF8C]/70">
            Video link
          </span>
          <input
            type="url"
            className={cn(VA_FILTER_INPUT, "w-full")}
            value={videoLink}
            onChange={(e) => setVideoLink(e.target.value)}
            placeholder="https://…"
            required
            disabled={submitting}
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#D4AF8C]/70">
            Video type
          </span>
          <select
            className={cn(VA_FILTER_INPUT, "w-full")}
            value={videoType}
            onChange={(e) => setVideoType(e.target.value as typeof videoType)}
            required
            disabled={submitting}
          >
            <option value="">Select…</option>
            <option value="skit">Skit</option>
            <option value="ugc">UGC</option>
            <option value="other">Other</option>
          </select>
        </label>

        {error ? <p className="text-sm text-red-300">{error}</p> : null}

        <button
          type="submit"
          disabled={submitting || !bunches.length}
          className={cn(VA_BTN_PRIMARY, "flex w-full items-center justify-center gap-2")}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {submitting ? "Submitting…" : "Submit for review"}
        </button>
      </motion.form>
    </div>
  );
}
