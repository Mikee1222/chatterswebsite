"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Activity, DollarSign, FileText, Heart, Loader2, Package, Radio, Sparkles, TrendingUp } from "lucide-react";
import { ROUTES } from "@/lib/routes";
import {
  MODEL_GO_LIVE_PLATFORM_OPTIONS,
  type ModelGoLivePlatformOption,
  modelLiveStreamPlatformLabel,
} from "@/lib/airtable-options";
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
  const [isStarting, setIsStarting] = React.useState(false);
  const [isEnding, setIsEnding] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = React.useState(0);
  const fetchSeqRef = React.useRef(0);
  /** Live id we just started — prevents a stale active fetch from clearing optimistic UI. */
  const pendingLiveIdRef = React.useRef<string | null>(null);
  /** SSR-seeded live — first client fetch must not clear until server confirms absent. */
  const ssrActiveLiveRef = React.useRef<ModelHomeActiveLive | null>(activeLiveProp ?? null);

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
    if (activeLiveProp) {
      setActiveLive(activeLiveProp);
      ssrActiveLiveRef.current = activeLiveProp;
    }
  }, [activeLiveProp]);

  React.useEffect(() => {
    void fetchActiveLive();
  }, [fetchActiveLive]);

  React.useEffect(() => {
    if (!realtime?.subscribe) return;
    return realtime.subscribe((event) => {
      if (event.type === "model_live_started" || event.type === "model_live_ended") {
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
    setIsStarting(true);
    try {
      const res = await fetch("/api/model/live/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      });
      const raw = await res.text();
      let data: { error?: string; live_id?: string; platform?: string; started_at?: string } = {};
      try {
        data = raw ? (JSON.parse(raw) as typeof data) : {};
      } catch {
        setActionError(t("common.invalidResponse"));
        return;
      }
      if (!res.ok) {
        if (res.status === 409) {
          setActionError("A live stream is already active. Please end it first.");
          await fetchActiveLive();
        } else if (res.status === 403) {
          setActionError("You don't have permission to start a live stream.");
        } else {
          setActionError(data.error ?? "Could not start live stream. Please try again.");
        }
        return;
      }
      if (data.live_id) {
        pendingLiveIdRef.current = data.live_id;
        setLiveState({
          id: data.live_id,
          platform: data.platform ?? platform,
          started_at: data.started_at ?? new Date().toISOString(),
        });
      }
      setActionError(null);
      await fetchActiveLive();
      router.refresh();
    } finally {
      setIsStarting(false);
    }
  }, [fetchActiveLive, platform, router, setLiveState, t]);

  const handleEndLive = React.useCallback(async () => {
    setActionError(null);
    setIsEnding(true);
    try {
      const res = await fetch("/api/model/live/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(activeLive?.id ? { live_id: activeLive.id } : {}),
      });
      const raw = await res.text();
      let data: { error?: string } = {};
      try {
        data = raw ? (JSON.parse(raw) as { error?: string }) : {};
      } catch {
        setActionError(t("common.invalidResponse"));
        return;
      }
      if (!res.ok) {
        setActionError(data.error ?? t("home.couldNotEndLive"));
        return;
      }
      pendingLiveIdRef.current = null;
      ssrActiveLiveRef.current = null;
      setLiveState(null);
      setActionError(null);
      await fetchActiveLive({ confirmAbsent: true });
      router.refresh();
    } finally {
      setIsEnding(false);
    }
  }, [activeLive?.id, fetchActiveLive, router, setLiveState, t]);

  const comingSoonCards = [
    { key: "today" as const, title: t("home.todayEarnings"), Icon: DollarSign },
    { key: "week" as const, title: t("home.weekEarnings"), Icon: TrendingUp },
    { key: "fans" as const, title: t("home.totalFans"), Icon: Heart },
  ] as const;

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
        transition={{ duration: 0.4, delay: reduceMotion ? 0 : 0.12, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "relative overflow-hidden rounded-3xl border p-6 md:p-8",
          activeLive
            ? "border-red-500/35 bg-gradient-to-br from-red-950/40 via-black/50 to-zinc-950/40 shadow-[0_20px_70px_-36px_rgba(239,68,68,0.35),inset_0_1px_0_rgba(255,255,255,0.06)]"
            : "border-white/10 bg-zinc-950/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl"
        )}
      >
        {!activeLive ? null : (
          <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-red-500/20 blur-3xl" aria-hidden />
        )}
        <div className="relative space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1",
                  activeLive
                    ? "bg-red-500/20 text-red-200 ring-red-400/35"
                    : "bg-fuchsia-500/20 text-fuchsia-100 ring-fuchsia-400/25"
                )}
              >
                <Radio className="h-6 w-6" aria-hidden />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/50">{t("live.sectionLabel")}</p>
                <h2 className="mt-1 text-lg font-semibold text-white md:text-xl">
                  {activeLive ? t("home.youAreLive") : t("home.startLiveStream")}
                </h2>
                <p className="mt-2 max-w-lg text-sm text-white/55">
                  {activeLive ? t("home.liveNotifyTeam") : t("home.livePickPlatform")}
                </p>
              </div>
            </div>
          </div>

          {actionError ? (
            <p className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-2 text-sm text-amber-100" role="alert">
              {actionError}
            </p>
          ) : null}

          {activeLive ? (
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-4">
                <span className="flex items-center gap-2" aria-live="polite">
                  <span className="relative flex h-3 w-3 shrink-0">
                    {!reduceMotion ? (
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-70" />
                    ) : null}
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.9)]" />
                  </span>
                  <span className="text-sm font-medium text-white/90">{modelLiveStreamPlatformLabel(activeLive.platform)}</span>
                  <span className="rounded-lg bg-white/10 px-3 py-1 font-mono text-sm tabular-nums text-white">
                    {formatLiveDuration(elapsedSec)}
                  </span>
                </span>
              </div>
              <button
                type="button"
                onClick={() => void handleEndLive()}
                disabled={isEnding}
                className={cn(
                  "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-red-400/40 px-6 text-sm font-semibold text-red-100",
                  "bg-red-500/15 transition hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-50"
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
            </div>
          ) : (
            <>
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-white/40">{t("home.platform")}</p>
                <div className="flex flex-wrap gap-2">
                  {MODEL_GO_LIVE_PLATFORM_OPTIONS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      disabled={isStarting}
                      onClick={() => setPlatform(p)}
                      className={cn(
                        "rounded-xl border px-4 py-2.5 text-sm font-medium transition",
                        platform === p
                          ? "border-pink-400/50 bg-pink-500/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                          : "border-white/10 bg-black/30 text-white/70 hover:border-white/20 hover:text-white/90",
                        isStarting && "cursor-not-allowed opacity-45"
                      )}
                    >
                      {modelLiveStreamPlatformLabel(p)}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleStartLive()}
                disabled={isStarting}
                className={cn(
                  "inline-flex w-full min-h-[52px] items-center justify-center gap-2 rounded-2xl px-6 py-4 text-base font-bold tracking-tight text-white shadow-lg transition",
                  "bg-gradient-to-r from-pink-500 via-fuchsia-600 to-violet-600 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60",
                  "ring-1 ring-white/15"
                )}
              >
                {isStarting ? (
                  <>
                    <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
                    {t("home.starting")}
                  </>
                ) : (
                  t("home.startLive")
                )}
              </button>
            </>
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
