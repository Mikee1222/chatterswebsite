"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Activity, DollarSign, FileText, Heart, Loader2, Package, Radio, Sparkles, TrendingUp } from "lucide-react";
import { ROUTES } from "@/lib/routes";
import {
  MODEL_GO_LIVE_PLATFORM_OPTIONS,
  MODEL_LIVE_STREAM_REASON_OPTIONS,
  type ModelGoLivePlatformOption,
  type ModelLiveStreamReasonOption,
  modelLiveStreamPlatformLabel,
} from "@/lib/airtable-options";
import { VA_BTN_PRIMARY, VA_CARD } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/use-translations";
import { useRealtime } from "@/contexts/realtime-context";

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.08 + i * 0.06, duration: 0.38, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

export type ModelHomeActiveLive = {
  id: string;
  platform: string;
  started_at: string;
  reason?: string | null;
  reason_note?: string | null;
};

export type ModelHomeClientProps = {
  displayName: string;
  userEmail?: string | null;
  activeLive: ModelHomeActiveLive | null;
  /** Accepted customs in `waiting_schedule` (needs model schedule). */
  pendingCustomRequestsCount: number;
  /** VA content assignments with status `pending` for this model. */
  pendingVaAssignmentsCount: number;
};

function formatLiveDuration(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function isOptimisticLiveId(id: string): boolean {
  return id.startsWith("optimistic-");
}

export function ModelHomeClient({
  displayName,
  userEmail,
  activeLive: activeLiveProp,
  pendingCustomRequestsCount,
  pendingVaAssignmentsCount,
}: ModelHomeClientProps) {
  const { t } = useTranslations();
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  const realtime = useRealtime();
  const [activeLive, setActiveLive] = React.useState<ModelHomeActiveLive | null>(activeLiveProp);
  const [platform, setPlatform] = React.useState<ModelGoLivePlatformOption>("instagram");
  const [reason, setReason] = React.useState<ModelLiveStreamReasonOption | "">("");
  const [reasonNote, setReasonNote] = React.useState("");
  const [isStarting, setIsStarting] = React.useState(false);
  const [isEnding, setIsEnding] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = React.useState(0);
  const fetchSeqRef = React.useRef(0);
  /** Live id we just started — prevents a stale active fetch from clearing optimistic UI. */
  const pendingLiveIdRef = React.useRef<string | null>(null);
  /** SSR-seeded live — first client fetch must not clear until server confirms absent. */
  const ssrActiveLiveRef = React.useRef<ModelHomeActiveLive | null>(activeLiveProp ?? null);
  /** Snapshot for rolling back optimistic End Live. */
  const endRollbackRef = React.useRef<ModelHomeActiveLive | null>(null);

  const setLiveState = React.useCallback((live: ModelHomeActiveLive | null) => {
    setActiveLive(live);
    if (!live) pendingLiveIdRef.current = null;
  }, []);

  const fetchActiveLive = React.useCallback(async (options?: { confirmAbsent?: boolean }) => {
    const seq = ++fetchSeqRef.current;
    try {
      const res = await fetch("/api/model/live/active", {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as { live?: ModelHomeActiveLive | null };
      if (seq !== fetchSeqRef.current) return;
      if (!res.ok) return;
      const live = data.live ?? null;
      if (live) {
        pendingLiveIdRef.current = null;
        ssrActiveLiveRef.current = null;
        setLiveState(live);
        return;
      }
      const skipClearForSsrSeed = !options?.confirmAbsent && ssrActiveLiveRef.current != null;
      if (skipClearForSsrSeed) {
        ssrActiveLiveRef.current = null;
        return;
      }
      if (!pendingLiveIdRef.current) {
        setLiveState(null);
      }
    } catch {
      /* keep current UI on transient fetch errors */
    }
  }, [setLiveState]);

  React.useEffect(() => {
    if (pendingLiveIdRef.current) return;
    if (endRollbackRef.current) return;
    if (activeLiveProp) {
      setActiveLive(activeLiveProp);
      ssrActiveLiveRef.current = activeLiveProp;
    }
  }, [activeLiveProp]);

  // SSR already seeds live state — avoid racing first paint. When SSR said not-live,
  // confirm immediately; when SSR said live, defer a quiet reconcile.
  React.useEffect(() => {
    const delayMs = activeLiveProp ? 2200 : 0;
    const id = window.setTimeout(() => {
      void fetchActiveLive();
    }, delayMs);
    return () => window.clearTimeout(id);
  }, [fetchActiveLive, activeLiveProp]);

  React.useEffect(() => {
    if (!realtime?.subscribe) return;
    return realtime.subscribe((event) => {
      if (event.type === "model_live_started" || event.type === "model_live_ended") {
        // Skip while our own start/end is in flight — optimistic UI owns the card.
        if (pendingLiveIdRef.current || endRollbackRef.current) return;
        void fetchActiveLive();
      }
    });
  }, [realtime, fetchActiveLive]);

  const startedMs = React.useMemo(() => {
    if (!activeLive?.started_at) return null;
    const ts = Date.parse(activeLive.started_at);
    return Number.isFinite(ts) ? ts : null;
  }, [activeLive?.started_at]);

  React.useEffect(() => {
    if (startedMs == null) {
      setElapsedSec(0);
      return;
    }
    const tick = () => {
      setElapsedSec(Math.max(0, Math.floor((Date.now() - startedMs) / 1000)));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [startedMs]);

  const handleStartLive = React.useCallback(async () => {
    setActionError(null);
    if (!reason || !MODEL_LIVE_STREAM_REASON_OPTIONS.includes(reason)) {
      setActionError(t("home.reasonRequired"));
      return;
    }
    const noteForRequest = reason === "other" ? reasonNote.trim() || null : null;
    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticStartedAt = new Date().toISOString();
    pendingLiveIdRef.current = optimisticId;
    // Instant visual confirmation — don't wait for the network.
    setLiveState({
      id: optimisticId,
      platform,
      reason,
      reason_note: noteForRequest,
      started_at: optimisticStartedAt,
    });
    setIsStarting(true);
    try {
      const res = await fetch("/api/model/live/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          reason,
          reason_note: noteForRequest,
        }),
      });
      const raw = await res.text();
      let data: {
        error?: string;
        live_id?: string;
        platform?: string;
        reason?: string;
        reason_note?: string | null;
        started_at?: string;
      } = {};
      try {
        data = raw ? (JSON.parse(raw) as typeof data) : {};
      } catch {
        pendingLiveIdRef.current = null;
        setLiveState(null);
        setActionError(t("common.invalidResponse"));
        return;
      }
      if (!res.ok) {
        pendingLiveIdRef.current = null;
        setLiveState(null);
        if (res.status === 409) {
          setActionError("A live stream is already active. Please end it first.");
          void fetchActiveLive();
        } else if (res.status === 403) {
          setActionError("You don't have permission to start a live stream.");
        } else {
          setActionError(data.error ?? t("home.couldNotStartLive"));
        }
        return;
      }
      if (data.live_id) {
        pendingLiveIdRef.current = data.live_id;
        setLiveState({
          id: data.live_id,
          platform: data.platform ?? platform,
          reason: data.reason ?? reason,
          reason_note: data.reason_note ?? noteForRequest,
          started_at: data.started_at ?? optimisticStartedAt,
        });
      }
      setActionError(null);
      // Reconcile in the background — don't block the live UI.
      void fetchActiveLive();
      router.refresh();
    } finally {
      setIsStarting(false);
    }
  }, [fetchActiveLive, platform, reason, reasonNote, router, setLiveState, t]);

  const handleEndLive = React.useCallback(async () => {
    setActionError(null);
    const previous = activeLive;
    const liveId = previous?.id && !isOptimisticLiveId(previous.id) ? previous.id : undefined;
    endRollbackRef.current = previous;
    pendingLiveIdRef.current = null;
    ssrActiveLiveRef.current = null;
    // Instant not-live confirmation.
    setLiveState(null);
    setIsEnding(true);
    try {
      const res = await fetch("/api/model/live/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(liveId ? { live_id: liveId } : {}),
      });
      const raw = await res.text();
      let data: { error?: string } = {};
      try {
        data = raw ? (JSON.parse(raw) as { error?: string }) : {};
      } catch {
        if (endRollbackRef.current) setLiveState(endRollbackRef.current);
        endRollbackRef.current = null;
        setActionError(t("common.invalidResponse"));
        return;
      }
      if (!res.ok) {
        if (endRollbackRef.current) setLiveState(endRollbackRef.current);
        endRollbackRef.current = null;
        setActionError(data.error ?? t("home.couldNotEndLive"));
        return;
      }
      endRollbackRef.current = null;
      setActionError(null);
      void fetchActiveLive({ confirmAbsent: true });
      router.refresh();
    } finally {
      setIsEnding(false);
    }
  }, [activeLive, fetchActiveLive, router, setLiveState, t]);

  const comingSoonCards = [
    { key: "today" as const, title: t("home.todayEarnings"), Icon: DollarSign },
    { key: "week" as const, title: t("home.weekEarnings"), Icon: TrendingUp },
    { key: "fans" as const, title: t("home.totalFans"), Icon: Heart },
  ] as const;

  const isLive = activeLive != null;
  const platformLabel = activeLive
    ? modelLiveStreamPlatformLabel(activeLive.platform)
    : modelLiveStreamPlatformLabel(platform);

  const reasonLabelFor = React.useCallback(
    (r: string | null | undefined, note?: string | null) => {
      const key = (r ?? "").trim();
      let label = "";
      if (key === "going_out") label = t("home.reasonGoingOut");
      else if (key === "gym") label = t("home.reasonGym");
      else if (key === "at_home") label = t("home.reasonAtHome");
      else if (key === "other") label = t("home.reasonOther");
      else if (key) label = key;
      const n = note?.trim();
      if (key === "other" && n) return `${label} — ${n}`;
      return label;
    },
    [t]
  );

  const liveReasonLabel = activeLive ? reasonLabelFor(activeLive.reason, activeLive.reason_note) : "";
  const liveStatusLine =
    isLive && liveReasonLabel
      ? t("home.liveStatusLine", { platform: platformLabel, reason: liveReasonLabel })
      : isLive
        ? `LIVE · ${platformLabel}`
        : null;

  return (
    <div className="space-y-8 md:space-y-10">
      <motion.section
        initial={reduceMotion ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/75 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl md:p-8"
        )}
      >
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-pink-500/25 text-pink-200 ring-1 ring-pink-400/30">
              <Sparkles className="h-7 w-7" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-medium uppercase tracking-wider text-pink-200/85">{t("home.welcomeBack")}</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-white md:text-3xl">
                {displayName}
              </h1>
              {userEmail ? <p className="mt-2 text-xs text-white/40">{userEmail}</p> : null}
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/55">{t("home.subtitle")}</p>
            </div>
          </div>
        </div>
      </motion.section>

      <motion.section
        initial={reduceMotion ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: reduceMotion ? 0 : 0.08, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          VA_CARD,
          "relative overflow-hidden p-5 md:p-7",
          isLive
            ? "border border-[#FF1493]/35 bg-gradient-to-br from-[#FF1493]/18 via-[#151315] to-[#0D0B0D] shadow-[0_24px_64px_-28px_rgba(255,20,147,0.45),inset_0_1px_0_rgba(255,255,255,0.08)]"
            : "border border-[#D4AF8C]/20 bg-gradient-to-br from-white/[0.06] via-[#151315] to-[#0D0B0D]"
        )}
      >
        {isLive && !reduceMotion ? (
          <>
            <div
              className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#FF1493]/25 blur-3xl motion-safe:animate-pulse"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -bottom-20 left-0 h-36 w-36 rounded-full bg-[#D4AF8C]/12 blur-3xl"
              aria-hidden
            />
          </>
        ) : !isLive ? (
          <div
            className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-[#D4AF8C]/10 blur-3xl"
            aria-hidden
          />
        ) : null}

        <div className="relative space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span
                className={cn(
                  "relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1",
                  isLive
                    ? "bg-[#FF1493]/20 text-[#FF1493] ring-[#FF1493]/40"
                    : "bg-[#D4AF8C]/12 text-[#D4AF8C] ring-[#D4AF8C]/30"
                )}
              >
                {isLive && !reduceMotion ? (
                  <span className="absolute inset-0 rounded-2xl bg-[#FF1493]/25 motion-safe:animate-ping opacity-40" aria-hidden />
                ) : null}
                <Radio className="relative h-6 w-6" aria-hidden />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p
                    className={cn(
                      "text-[10px] font-semibold uppercase tracking-[0.2em]",
                      isLive ? "text-[#FF1493]/90" : "text-[#D4AF8C]/85"
                    )}
                  >
                    {t("live.sectionLabel")}
                  </p>
                  {isLive ? (
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-[#FF1493]/45 bg-[#FF1493]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#FF1493]">
                      <span className="relative flex h-1.5 w-1.5">
                        {!reduceMotion ? (
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FF1493] opacity-75" />
                        ) : null}
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#FF1493] shadow-[0_0_10px_rgba(255,20,147,0.9)]" />
                      </span>
                      {t("home.liveBadge")}
                    </span>
                  ) : (
                    <span className="inline-flex rounded-md border border-[#D4AF8C]/25 bg-[#D4AF8C]/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#D4AF8C]/90">
                      {t("home.notLive")}
                    </span>
                  )}
                </div>
                <h2 className="mt-1.5 text-lg font-semibold tracking-tight text-white md:text-xl">
                  {isLive ? t("home.youAreLive") : t("home.startLiveStream")}
                </h2>
                {liveStatusLine ? (
                  <p className="mt-1.5 text-sm font-medium tracking-wide text-[#FF1493]/95">
                    {liveStatusLine}
                  </p>
                ) : null}
                <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-white/50">
                  {isLive ? t("home.liveNotifyTeam") : t("home.livePickPlatform")}
                </p>
              </div>
            </div>
          </div>

          {actionError ? (
            <p className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-100" role="alert">
              {actionError}
            </p>
          ) : null}

          {isLive && activeLive ? (
            <div className="space-y-4">
              <div
                className="grid grid-cols-2 gap-3 rounded-2xl border border-white/10 bg-black/35 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:gap-4"
                aria-live="polite"
              >
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#D4AF8C]/80">
                    {t("home.platform")}
                  </p>
                  <p className="mt-1 truncate text-base font-semibold text-white sm:text-lg">{platformLabel}</p>
                </div>
                <div className="min-w-0 text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#D4AF8C]/80">
                    {t("home.liveDuration")}
                  </p>
                  <p className="mt-1 font-mono text-2xl font-semibold tabular-nums tracking-tight text-[#FF1493] sm:text-3xl">
                    {formatLiveDuration(elapsedSec)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void handleEndLive()}
                disabled={isEnding || isStarting}
                className={cn(
                  "inline-flex w-full min-h-12 items-center justify-center gap-2 rounded-xl border border-[#FF1493]/45 bg-[#FF1493]/15 px-6 text-sm font-semibold text-white",
                  "shadow-[0_8px_28px_-12px_rgba(255,20,147,0.55)] transition hover:bg-[#FF1493]/25 active:scale-[0.99]",
                  "disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:active:scale-100"
                )}
              >
                {isEnding ? (
                  <>
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                    {t("home.ending")}
                  </>
                ) : (
                  t("home.endLive")
                )}
              </button>
              {isStarting ? (
                <p className="text-center text-xs text-white/40">{t("home.starting")}</p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#D4AF8C]/75">
                  {t("home.platform")}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {MODEL_GO_LIVE_PLATFORM_OPTIONS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      disabled={isStarting}
                      onClick={() => setPlatform(p)}
                      className={cn(
                        "min-h-11 rounded-xl border px-2 py-2.5 text-xs font-semibold transition sm:text-sm",
                        platform === p
                          ? "border-[#FF1493]/50 bg-[#FF1493]/18 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
                          : "border-white/10 bg-black/30 text-white/65 hover:border-[#D4AF8C]/35 hover:text-white/90",
                        isStarting && "cursor-not-allowed opacity-45",
                        "motion-reduce:transition-none"
                      )}
                    >
                      {modelLiveStreamPlatformLabel(p)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label
                  htmlFor="model-live-reason"
                  className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.16em] text-[#D4AF8C]/75"
                >
                  {t("home.reason")}
                </label>
                <select
                  id="model-live-reason"
                  value={reason}
                  disabled={isStarting}
                  onChange={(e) => setReason(e.target.value as ModelLiveStreamReasonOption | "")}
                  required
                  className={cn(
                    "min-h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-sm text-white",
                    "outline-none focus:border-[#FF1493]/45 focus:ring-1 focus:ring-[#FF1493]/30",
                    isStarting && "cursor-not-allowed opacity-45"
                  )}
                >
                  <option value="" disabled>
                    {t("home.reason")}
                  </option>
                  <option value="going_out">{t("home.reasonGoingOut")}</option>
                  <option value="gym">{t("home.reasonGym")}</option>
                  <option value="at_home">{t("home.reasonAtHome")}</option>
                  <option value="other">{t("home.reasonOther")}</option>
                </select>
                {reason === "other" ? (
                  <input
                    type="text"
                    value={reasonNote}
                    disabled={isStarting}
                    onChange={(e) => setReasonNote(e.target.value)}
                    placeholder={t("home.reasonNotePlaceholder")}
                    maxLength={500}
                    className={cn(
                      "mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-sm text-white placeholder:text-white/35",
                      "outline-none focus:border-[#FF1493]/45 focus:ring-1 focus:ring-[#FF1493]/30",
                      isStarting && "cursor-not-allowed opacity-45"
                    )}
                  />
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => void handleStartLive()}
                disabled={isStarting || !reason}
                className={cn(
                  VA_BTN_PRIMARY,
                  "inline-flex w-full min-h-[52px] items-center justify-center gap-2 text-base font-bold tracking-tight"
                )}
              >
                {isStarting ? (
                  <>
                    <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
                    {t("home.starting")}
                  </>
                ) : (
                  <>
                    <Radio className="h-5 w-5 shrink-0" aria-hidden />
                    {t("home.startLive")}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </motion.section>

      <div>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-white/45">{t("home.overview")}</h2>
        <div className="mb-4 flex flex-col gap-4">
          <Link
            href={ROUTES.model.customs}
            className={cn(
              "group relative flex items-center justify-between gap-4 overflow-hidden rounded-2xl border border-white/10 bg-black/45 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl transition-[border-color,transform] duration-300",
              "hover:-translate-y-0.5 hover:border-pink-400/35"
            )}
          >
            <div className="relative flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-pink-500/20 text-pink-100 ring-1 ring-pink-400/25">
                <Package className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">{t("home.customRequests")}</p>
                <p className="mt-0.5 text-xs text-white/55">{t("home.customRequestsSub")}</p>
              </div>
            </div>
            <div className="relative flex shrink-0 flex-col items-end gap-0.5">
              <span className="text-2xl font-bold tabular-nums text-pink-100">{pendingCustomRequestsCount}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-pink-200/80">{t("common.pending")}</span>
            </div>
          </Link>

          <Link
            href={ROUTES.model.contentAssignments}
            className={cn(
              "group relative flex items-center justify-between gap-4 overflow-hidden rounded-2xl border p-5 transition-[border-color,transform] duration-300",
              pendingVaAssignmentsCount > 0
                ? "border-pink-400/30 bg-black/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-pink-500/15"
                : "border-white/10 bg-black/40",
              "hover:-translate-y-0.5 hover:border-pink-400/35"
            )}
          >
            <div className="relative flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-pink-500/20 text-pink-100 ring-1 ring-pink-400/25">
                <FileText className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">{t("home.vaDeliveries")}</p>
                <p className="mt-0.5 text-xs text-white/55">{t("home.vaDeliveriesSub")}</p>
              </div>
            </div>
            <div className="relative flex shrink-0 flex-col items-end gap-0.5">
              <span className="text-2xl font-bold tabular-nums text-pink-100">{pendingVaAssignmentsCount}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-pink-200/80">{t("common.pending")}</span>
            </div>
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {comingSoonCards.map(({ key, title, Icon }, i) => (
            <motion.div
              key={key}
              custom={i}
              initial={reduceMotion ? false : "hidden"}
              animate={reduceMotion ? false : "show"}
              variants={reduceMotion ? undefined : cardVariants}
              className={cn(
                "relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl",
                "transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-pink-400/25"
              )}
            >
              <div className="relative flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pink-500/15 text-pink-200 ring-1 ring-pink-400/20">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white/90">{title}</p>
                  <p className="mt-2 inline-flex rounded-full border border-pink-400/25 bg-pink-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-pink-200/95">
                    {t("home.comingSoon")}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <motion.section
        initial={reduceMotion ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: reduceMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="rounded-2xl border border-white/10 bg-black/35 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl"
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] text-white/50 ring-1 ring-white/10">
            <Activity className="h-5 w-5" aria-hidden />
          </span>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white/55">{t("home.recentActivity")}</h2>
        </div>
        <p className="mt-6 text-center text-sm leading-relaxed text-white/45">{t("home.noRecentActivity")}</p>
      </motion.section>
    </div>
  );
}
