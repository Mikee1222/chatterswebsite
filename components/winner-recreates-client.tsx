"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ExternalLink, Loader2, Send, Trophy } from "lucide-react";
import { useToast } from "@/contexts/toast-context";
import {
  QualityRatingAggregate,
  QualityRatingBadge,
  winnerVideoLocalToast,
} from "@/components/winner-videos-shared";
import { WinnerVideoStatusBadge } from "@/components/manager-review-ui";
import { formatDateTimeAthens } from "@/lib/format";
import { VA_BTN_PRIMARY, VA_CARD, VA_CARD_GLOW, VA_FILTER_INPUT } from "@/lib/va-tasks-tokens";
import {
  bunchUrgencyTone,
  getBunchFulfillment,
} from "@/lib/winner-sourcing-helpers";
import type { VideoBunch } from "@/services/winner-sourcing";
import type { WinnerVideoRecord } from "@/services/winner-videos";
import { cn } from "@/lib/utils";

function sortByUrgency(list: VideoBunch[]): VideoBunch[] {
  return [...list].sort((a, b) => {
    const fa = getBunchFulfillment(a);
    const fb = getBunchFulfillment(b);
    if (fb.remaining !== fa.remaining) return fb.remaining - fa.remaining;
    if (fb.needRatio !== fa.needRatio) return fb.needRatio - fa.needRatio;
    return a.name.localeCompare(b.name);
  });
}

function BunchProgressRing({
  filledPct,
  pendingPct,
  accentStroke,
}: {
  filledPct: number;
  pendingPct: number;
  accentStroke: string;
}) {
  const reduce = useReducedMotion();
  const r = 34;
  const c = 2 * Math.PI * r;
  const filledLen = (Math.min(100, filledPct) / 100) * c;
  const pendingLen = (Math.min(100 - filledPct, pendingPct) / 100) * c;

  return (
    <svg viewBox="0 0 88 88" className="h-[4.5rem] w-[4.5rem] -rotate-90 shrink-0">
      <circle cx="44" cy="44" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
      <motion.circle
        cx="44"
        cy="44"
        r={r}
        fill="none"
        stroke="#34d399"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${filledLen} ${c - filledLen}`}
        initial={reduce ? false : { strokeDashoffset: c }}
        animate={{ strokeDashoffset: 0 }}
        transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
      />
      {pendingLen > 0 ? (
        <motion.circle
          cx="44"
          cy="44"
          r={r}
          fill="none"
          stroke="#fbbf24"
          strokeWidth="8"
          strokeLinecap="butt"
          strokeDasharray={`${pendingLen} ${c - pendingLen}`}
          strokeDashoffset={-filledLen}
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.35 }}
        />
      ) : null}
      {/* Accent tick for remaining urgency — thin outer glow ring */}
      <circle
        cx="44"
        cy="44"
        r={r + 6}
        fill="none"
        stroke={accentStroke}
        strokeWidth="1.5"
        strokeOpacity={0.35}
        strokeDasharray="2 4"
      />
    </svg>
  );
}

function BunchOverviewCard({
  bunch,
  selected,
  index,
  onSelect,
}: {
  bunch: VideoBunch;
  selected: boolean;
  index: number;
  onSelect: (id: string) => void;
}) {
  const reduce = useReducedMotion();
  const f = getBunchFulfillment(bunch);
  const tone = bunchUrgencyTone(f.needRatio, f.remaining);
  const accentText =
    tone.accent === "amber"
      ? "text-amber-300"
      : tone.accent === "champagne"
        ? "text-[#D4AF8C]"
        : tone.accent === "emerald"
          ? "text-emerald-400"
          : "text-[#FF1493]";
  const canSubmit = f.remaining > 0;

  return (
    <motion.button
      type="button"
      onClick={() => onSelect(bunch.id)}
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
      whileTap={{ scale: 0.985 }}
      className={cn(
        VA_CARD,
        "relative w-full overflow-hidden p-4 text-left md:p-5",
        "border border-white/10 bg-white/[0.04]",
        "transition-[transform,border-color,box-shadow] duration-200",
        "hover:-translate-y-0.5 hover:border-white/18 active:translate-y-0",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF1493]/40",
        selected && cn("ring-1 border-[#FF1493]/40 ring-[#FF1493]/30", tone.ring),
        !canSubmit && "opacity-80",
      )}
      style={
        selected
          ? { boxShadow: `0 0 36px -10px ${tone.glow}` }
          : undefined
      }
    >
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-50 blur-3xl"
        style={{ background: `radial-gradient(circle, ${tone.glow}, transparent 70%)` }}
      />

      <div className="relative flex items-start gap-3">
        <div className="relative">
          <BunchProgressRing
            filledPct={f.filledPct}
            pendingPct={f.pendingPct}
            accentStroke={
              tone.accent === "amber"
                ? "#fbbf24"
                : tone.accent === "champagne"
                  ? "#D4AF8C"
                  : tone.accent === "emerald"
                    ? "#34d399"
                    : "#FF1493"
            }
          />
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center rotate-0">
            <span className={cn("text-lg font-semibold tabular-nums leading-none", accentText)}>
              {f.remaining}
            </span>
            <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/35">
              need
            </span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-base font-semibold tracking-tight text-white">{bunch.name}</p>
              <p className="mt-0.5 truncate text-xs text-[#B8B4B8]/55">{bunch.model_name}</p>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]",
                tone.accent === "amber" && "border-amber-400/30 bg-amber-400/10 text-amber-300",
                tone.accent === "champagne" &&
                  "border-[#D4AF8C]/30 bg-[#D4AF8C]/10 text-[#D4AF8C]",
                tone.accent === "emerald" &&
                  "border-emerald-400/30 bg-emerald-400/10 text-emerald-400",
                tone.accent === "pink" && "border-[#FF1493]/30 bg-[#FF1493]/10 text-[#FF1493]",
              )}
            >
              {tone.label}
            </span>
          </div>

          <p className="mt-3 text-sm font-medium tabular-nums tracking-tight text-white/90">
            <span className="text-emerald-400">{f.filled}</span>
            <span className="text-white/35"> / {f.target} filled</span>
            <span className="mx-1.5 text-white/20">·</span>
            <span className="text-amber-300">{f.pending}</span>
            <span className="text-white/35"> pending review</span>
            <span className="mx-1.5 text-white/20">·</span>
            <span className={accentText}>{f.remaining}</span>
            <span className="text-white/35"> still needed</span>
          </p>

          <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <motion.div
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400"
              initial={reduce ? false : { width: 0 }}
              animate={{ width: `${f.filledPct}%` }}
              transition={{ duration: 0.75, delay: 0.1 + index * 0.04, ease: [0.22, 1, 0.36, 1] }}
            />
            <motion.div
              className="h-full bg-gradient-to-r from-amber-400 to-amber-300"
              initial={reduce ? false : { width: 0 }}
              animate={{ width: `${f.pendingPct}%` }}
              transition={{ duration: 0.75, delay: 0.2 + index * 0.04, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] uppercase tracking-[0.1em] text-white/30">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Filled
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-300" /> Pending
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-white/15" /> Needed
            </span>
          </div>
        </div>
      </div>
    </motion.button>
  );
}

export function WinnerRecreatesClient({
  initialBunches,
  initialSubmissions = [],
}: {
  initialBunches: VideoBunch[];
  initialSubmissions?: WinnerVideoRecord[];
}) {
  const { addToast } = useToast();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [bunches, setBunches] = React.useState(() => sortByUrgency(initialBunches));
  const [submissions, setSubmissions] = React.useState(initialSubmissions);
  const [bunchId, setBunchId] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [videoLink, setVideoLink] = React.useState("");
  const [videoType, setVideoType] = React.useState<
    "skit" | "ugc" | "text_on_screen" | "interview" | "clips" | "other" | ""
  >("");
  const [videoTypeOther, setVideoTypeOther] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => setSubmissions(initialSubmissions), [initialSubmissions]);

  const ratingAggregate = submissions.map((v) => v.quality_rating);

  const selected = bunches.find((b) => b.id === bunchId);
  const selectedFulfillment = selected ? getBunchFulfillment(selected) : null;
  const submittable = bunches.filter((b) => getBunchFulfillment(b).remaining > 0);

  function selectBunch(id: string) {
    setBunchId(id);
    setError(null);
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function refreshBunches() {
    const res = await fetch("/api/winner-sourcing/bunches?status=open", { credentials: "include" });
    if (!res.ok) return;
    const d = await res.json();
    const list = sortByUrgency((d.bunches ?? []) as VideoBunch[]);
    setBunches(list);
    if (bunchId && !list.find((b) => b.id === bunchId)) {
      setBunchId("");
    } else if (bunchId) {
      const still = list.find((b) => b.id === bunchId);
      if (still && getBunchFulfillment(still).remaining <= 0) {
        setBunchId("");
      }
    }
  }

  async function refreshSubmissions() {
    const res = await fetch("/api/winner-videos", { credentials: "include" });
    if (!res.ok) return;
    const d = (await res.json()) as { videos?: WinnerVideoRecord[] };
    setSubmissions(d.videos ?? []);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!bunchId) {
      setError("Select an open bunch with remaining capacity");
      return;
    }
    if (selectedFulfillment && selectedFulfillment.remaining <= 0) {
      setError("This bunch is full — pick another open bunch");
      return;
    }
    if (!videoType) {
      setError("Select video type");
      return;
    }
    if (videoType === "other" && !videoTypeOther.trim()) {
      setError("Enter a custom type when Other is selected");
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
          video_type_other: videoType === "other" ? videoTypeOther.trim() : "",
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
      setVideoTypeOther("");
      await Promise.all([refreshBunches(), refreshSubmissions()]);
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="relative overflow-hidden rounded-3xl border border-[#D4AF8C]/15 bg-gradient-to-br from-[#151315] to-[#0D0B0D] px-6 py-8 md:px-8">
        <div
          className="pointer-events-none absolute -right-10 top-0 h-40 w-40 rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(255,20,147,0.3), transparent 70%)" }}
        />
        <div
          className="pointer-events-none absolute -left-8 bottom-0 h-28 w-28 rounded-full opacity-30 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(212,175,140,0.25), transparent 70%)" }}
        />
        <div className="relative flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FF1493]/15 text-[#FF1493]">
            <Trophy className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">Fill Bunches</h1>
            <p className="mt-1 max-w-xl text-sm text-[#B8B4B8]/65">
              Scan open bunches by urgency, then submit finds. Admins approve in Research Manage before a
              slot is created.
            </p>
          </div>
        </div>
      </div>

      <section className="space-y-4" aria-labelledby="bunch-overview-heading">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#D4AF8C]/70">
              Overview
            </p>
            <h2 id="bunch-overview-heading" className="mt-1 text-lg font-semibold tracking-tight text-white">
              Open bunches
            </h2>
            <p className="mt-0.5 text-xs text-[#B8B4B8]/45">
              Sorted by remaining need — tap a card to pre-select the form below.
            </p>
          </div>
          <p className="text-xs tabular-nums text-white/35">
            {bunches.length} open · {submittable.length} needing finds
          </p>
        </div>

        {bunches.length === 0 ? (
          <div className={cn(VA_CARD, "border border-white/10 bg-white/[0.03] px-5 py-14 text-center")}>
            <p className="text-sm text-[#B8B4B8]/50">No open bunches right now.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {bunches.map((b, i) => (
              <BunchOverviewCard
                key={b.id}
                bunch={b}
                selected={bunchId === b.id}
                index={i}
                onSelect={selectBunch}
              />
            ))}
          </div>
        )}
      </section>

      <motion.form
        ref={formRef}
        id="fill-bunches-form"
        onSubmit={(e) => void handleSubmit(e)}
        className={cn(VA_CARD, VA_CARD_GLOW, "mx-auto max-w-xl scroll-mt-24 space-y-4 p-5 md:p-6")}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#D4AF8C]/70">
            Submit find
          </p>
          <p className="mt-1 text-xs text-[#B8B4B8]/45">
            {selected
              ? `Selected: ${selected.name}`
              : "Choose a bunch from the overview or the dropdown."}
          </p>
        </div>

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
            {submittable.map((b) => {
              const f = getBunchFulfillment(b);
              return (
                <option key={b.id} value={b.id}>
                  {b.name} — {b.model_name} ({f.remaining} remaining / {f.target})
                </option>
              );
            })}
          </select>
          {selectedFulfillment ? (
            <p className="text-xs tabular-nums text-[#B8B4B8]/50">
              {selectedFulfillment.filled} / {selectedFulfillment.target} filled ·{" "}
              {selectedFulfillment.pending} pending review · {selectedFulfillment.remaining} still
              needed
            </p>
          ) : null}
          {!submittable.length ? (
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
            onChange={(e) => {
              const next = e.target.value as typeof videoType;
              setVideoType(next);
              if (next !== "other") setVideoTypeOther("");
            }}
            required
            disabled={submitting}
          >
            <option value="">Select…</option>
            <option value="skit">Skit</option>
            <option value="ugc">UGC</option>
            <option value="text_on_screen">Text on screen</option>
            <option value="interview">Interview</option>
            <option value="clips">Clips</option>
            <option value="other">Other</option>
          </select>
        </label>

        {videoType === "other" ? (
          <label className="block space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#D4AF8C]/70">
              Custom type <span className="text-red-300/80">*</span>
            </span>
            <input
              type="text"
              className={cn(VA_FILTER_INPUT, "w-full")}
              value={videoTypeOther}
              onChange={(e) => setVideoTypeOther(e.target.value)}
              placeholder="Describe the video type…"
              required
              disabled={submitting}
            />
          </label>
        ) : null}

        {error ? <p className="text-sm text-red-300">{error}</p> : null}

        <button
          type="submit"
          disabled={submitting || !submittable.length}
          className={cn(VA_BTN_PRIMARY, "flex w-full items-center justify-center gap-2")}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {submitting ? "Submitting…" : "Submit for review"}
        </button>
      </motion.form>

      {submissions.length > 0 ? (
        <section className="space-y-4" aria-labelledby="my-submissions-heading">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#D4AF8C]/70">
                History
              </p>
              <h2 id="my-submissions-heading" className="mt-1 text-lg font-semibold tracking-tight text-white">
                Your submissions
              </h2>
              <p className="mt-0.5 text-xs text-[#B8B4B8]/45">
                Approved finds show the quality rating from Research Manage.
              </p>
            </div>
            <QualityRatingAggregate ratings={ratingAggregate} />
          </div>

          <ul className="space-y-2">
            {submissions.slice(0, 20).map((v) => (
              <li
                key={v.id}
                className={cn(
                  VA_CARD,
                  "flex flex-wrap items-center justify-between gap-3 border border-white/[0.06] bg-white/[0.03] px-4 py-3",
                )}
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <WinnerVideoStatusBadge status={v.status} />
                    <QualityRatingBadge rating={v.quality_rating} />
                    <span className="truncate text-sm font-medium text-white">
                      {v.reference_model_name?.trim() || "—"}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#B8B4B8]/45">
                    {v.bunch_name?.trim() ? `${v.bunch_name} · ` : ""}
                    {v.submitted_at ? formatDateTimeAthens(v.submitted_at) : "—"}
                  </p>
                </div>
                {v.video_link ? (
                  <a
                    href={v.video_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#FF1493] hover:underline"
                  >
                    Video <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
