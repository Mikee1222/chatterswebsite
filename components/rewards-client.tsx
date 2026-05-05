"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Trophy,
  Sparkles,
  TrendingUp,
  Clock,
  Gift,
  Briefcase,
  Fish,
  FileText,
  Star,
  CircleDot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { checkLevelMigration, getLeaderboardForPeriodAction } from "@/app/actions/rewards";
import type { LeaderboardRow, PointsTransactionActivity } from "@/services/points-engine";
import type { PointsConfig } from "@/services/points-config";
import { SpinWheel, type SpinPrizeClient, type SpinRecentWin } from "@/components/spin-wheel";

const REWARDS_ONBOARDED_KEY = "rewards_onboarded";

const LEVEL_COLORS: Record<string, string> = {
  Bronze: "#cd7f32",
  Silver: "#c0c0c0",
  Gold: "#ffd700",
  Diamond: "#b9f2ff",
};

type Period = "weekly" | "monthly" | "alltime";

function getLevelProgressClient(totalPoints: number, level: string, config: PointsConfig) {
  const floors = {
    Bronze: Math.max(0, Math.floor(config.LEVEL_BRONZE_MIN)),
    Silver: Math.max(0, Math.floor(config.LEVEL_SILVER_MIN)),
    Gold: Math.max(0, Math.floor(config.LEVEL_GOLD_MIN)),
    Diamond: Math.max(0, Math.floor(config.LEVEL_DIAMOND_MIN)),
  } as const;
  const order = ["Bronze", "Silver", "Gold", "Diamond"] as const;
  const normalized = (order as readonly string[]).includes(level) ? level : "Bronze";
  const idx = order.indexOf(normalized as (typeof order)[number]);
  const safeIdx = idx >= 0 ? idx : 0;
  const t = Math.max(0, Math.floor(totalPoints));
  if (safeIdx >= order.length - 1) {
    return { pct: 100, nextLabel: null as string | null, pointsToNext: 0 };
  }
  const currentFloor = floors[order[safeIdx]];
  const nextThreshold = floors[order[safeIdx + 1]];
  const span = nextThreshold - currentFloor;
  const pct = span <= 0 ? 100 : Math.min(100, Math.max(0, ((t - currentFloor) / span) * 100));
  return {
    pct,
    nextLabel: order[safeIdx + 1] as string,
    pointsToNext: Math.max(0, nextThreshold - t),
  };
}

function formatTimeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (sec < 45) return "Just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

function categoryIcon(category: string) {
  const c = category.toLowerCase();
  if (c === "shift") return Briefcase;
  if (c === "whale") return Fish;
  if (c === "custom") return Gift;
  if (c === "streak") return TrendingUp;
  if (c === "manual") return Star;
  if (c === "penalty") return CircleDot;
  if (c === "spin") return Sparkles;
  return FileText;
}

function podiumCardClasses(rank: number, isSelf: boolean): string {
  const base =
    rank === 1
      ? "border-amber-400/45 bg-gradient-to-br from-amber-500/15 via-zinc-900/40 to-zinc-900/60"
      : rank === 2
        ? "border-slate-300/35 bg-gradient-to-br from-slate-400/12 via-zinc-900/40 to-zinc-900/60"
        : rank === 3
          ? "border-amber-800/40 bg-gradient-to-br from-amber-800/15 via-zinc-900/40 to-zinc-900/60"
          : "border-white/10 bg-white/5";
  const you = isSelf ? "ring-2 ring-[hsl(330,75%,58%)]/45 shadow-[0_0_0_1px_rgba(244,114,182,0.2)]" : "";
  return cn(base, you);
}

function podiumTableRowClasses(rank: number, isSelf: boolean): string {
  const podium =
    rank === 1
      ? "border-l-4 border-l-amber-400/90 bg-amber-500/[0.07]"
      : rank === 2
        ? "border-l-4 border-l-slate-300/80 bg-slate-400/[0.06]"
        : rank === 3
          ? "border-l-4 border-l-amber-700/90 bg-amber-900/[0.08]"
          : "";
  const you = isSelf ? "bg-[hsl(330,70%,55%)]/12 ring-1 ring-inset ring-[hsl(330,75%,58%)]/35" : "";
  return cn(podium, you, !podium && !you && "hover:bg-white/[0.03]");
}

function LeaderboardSkeleton() {
  return (
    <div className="w-full space-y-3" aria-hidden>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex animate-pulse items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3 min-h-[52px] sm:p-4"
        >
          <div className="h-11 w-11 shrink-0 rounded-full bg-white/10" />
          <div className="h-11 w-11 shrink-0 rounded-full bg-white/10" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-2/5 max-w-[140px] rounded bg-white/10" />
            <div className="h-3 w-1/3 max-w-[100px] rounded bg-white/[0.06]" />
          </div>
          <div className="h-7 w-14 shrink-0 rounded bg-white/10" />
        </div>
      ))}
    </div>
  );
}

function getActivityIcon(type: string): string {
  const icons: Record<string, string> = {
    challenge_completed: "🎯",
    shift_worked: "💼",
    no_break_taken: "⚡",
    whale_added: "🐋",
    whale_upgraded: "⬆️",
    whale_relationship: "💕",
    transaction_logged: "💰",
    custom_completed: "✨",
    spin_wheel: "🎰",
    level_up: "🏆",
    points_awarded: "⭐",
    test: "🔧",
  };
  return icons[type] || "📝";
}

function inferActivityType(tx: PointsTransactionActivity): string {
  const reason = tx.reason.toLowerCase();
  const category = tx.category.toLowerCase();
  if (reason.includes("challenge")) return "challenge_completed";
  if (reason.includes("no break")) return "no_break_taken";
  if (reason.includes("level")) return "level_up";
  if (category === "spin" || reason.includes("spin")) return "spin_wheel";
  if (category === "shift") return "shift_worked";
  if (category === "whale") return reason.includes("upgrad") ? "whale_upgraded" : "whale_added";
  if (category === "custom") return "custom_completed";
  if (category === "transaction" || reason.includes("transaction")) return "transaction_logged";
  if (reason.includes("point")) return "points_awarded";
  return category || "test";
}

function AnimatedPoints({ value }: { value: number }) {
  const [n, setN] = React.useState(0);
  React.useEffect(() => {
    const start = performance.now();
    const dur = 750;
    let frame: number;
    const run = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - (1 - t) ** 2.4;
      setN(Math.round(value * eased));
      if (t < 1) frame = requestAnimationFrame(run);
    };
    frame = requestAnimationFrame(run);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return (
    <motion.span
      key={value}
      initial={{ scale: 0.94, opacity: 0.65 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 220, damping: 22 }}
      className="tabular-nums tracking-tight"
    >
      {n}
    </motion.span>
  );
}

function LevelBadge({ level }: { level: string }) {
  const color = LEVEL_COLORS[level] ?? LEVEL_COLORS.Bronze;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider"
      style={{
        color,
        borderColor: `${color}55`,
        backgroundColor: `${color}18`,
        boxShadow: `0 0 20px ${color}22`,
      }}
    >
      <Trophy className="h-3.5 w-3.5" aria-hidden />
      {level}
    </span>
  );
}

function RewardsOnboardingModal({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rewards-onboard-title"
    >
      <div className="max-h-[90vh] max-w-md overflow-y-auto rounded-2xl border border-white/12 bg-gradient-to-b from-zinc-900 to-black p-6 shadow-2xl">
        <h2 id="rewards-onboard-title" className="text-xl font-bold text-white">
          Welcome to Gunzo Rewards! 🎉
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-white/70">
          You earn points for shifts, whales, customs, and more. Points unlock tiers and spin wheel credits—check your
          balance anytime on this page.
        </p>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-white/45">Top ways to earn</p>
        <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-white/80">
          <li>Complete shifts (hours worked, on-time bonuses, streaks).</li>
          <li>Grow whales: new adds, notes, relationship upgrades, returned actives.</li>
          <li>Finish custom requests when models mark them complete.</li>
          <li>Submit your weekly availability on time.</li>
          <li>Hit live challenges and daily streak milestones.</li>
        </ol>
        <button
          type="button"
          onClick={onDismiss}
          className="mt-6 w-full rounded-xl bg-gradient-to-r from-[hsl(330,75%,52%)] to-[hsl(280,55%,48%)] py-3 text-sm font-semibold text-white"
        >
          Let&apos;s go!
        </button>
      </div>
    </div>
  );
}

export function RewardsClient({
  currentUserId,
  initialPoints,
  initialLeaderboard,
  initialRecent,
  pointsConfig,
  spinPrizes,
  spinRecentWins,
}: {
  currentUserId: string;
  initialPoints: { total_points: number; level: string; streak_days: number; spins_available: number };
  initialLeaderboard: LeaderboardRow[];
  initialRecent: PointsTransactionActivity[];
  pointsConfig: PointsConfig;
  spinPrizes: SpinPrizeClient[];
  spinRecentWins: SpinRecentWin[];
}) {
  const router = useRouter();
  const [period, setPeriod] = React.useState<Period>("weekly");

  const withCurrentUser = React.useCallback(
    (list: LeaderboardRow[]) => list.map((r) => ({ ...r, isCurrentUser: r.userId === currentUserId })),
    [currentUserId]
  );

  const [rows, setRows] = React.useState<LeaderboardRow[]>(() => withCurrentUser(initialLeaderboard));
  const [loadingBoard, setLoadingBoard] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [showOnboarding, setShowOnboarding] = React.useState(false);
  const [howItWorksOpen, setHowItWorksOpen] = React.useState(false);
  const [showAllActivity, setShowAllActivity] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    try {
      if (typeof window !== "undefined" && !window.localStorage.getItem(REWARDS_ONBOARDED_KEY)) {
        setShowOnboarding(true);
      }
    } catch {
      /* private mode */
    }
  }, []);

  React.useEffect(() => {
    checkLevelMigration().catch((err) => console.error("[rewards] checkLevelMigration failed", err));
  }, []);

  function dismissOnboarding() {
    try {
      window.localStorage.setItem(REWARDS_ONBOARDED_KEY, "1");
    } catch {
      /* ignore */
    }
    setShowOnboarding(false);
  }

  React.useEffect(() => {
    if (period === "weekly") {
      setRows(withCurrentUser(initialLeaderboard));
      return;
    }
    let cancelled = false;
    setLoadingBoard(true);
    getLeaderboardForPeriodAction(period).then((res) => {
      if (cancelled) return;
      if (res.success) setRows(withCurrentUser(res.rows));
      setLoadingBoard(false);
    });
    return () => {
      cancelled = true;
    };
  }, [period, initialLeaderboard, withCurrentUser]);

  const progress = getLevelProgressClient(initialPoints.total_points, initialPoints.level, pointsConfig);
  const ACTIVITY_PREVIEW_COUNT = 6;
  const visibleRecent = showAllActivity ? initialRecent : initialRecent.slice(0, ACTIVITY_PREVIEW_COUNT);
  const canShowMoreActivity = initialRecent.length > ACTIVITY_PREVIEW_COUNT;

  const onboardingPortal =
    mounted && showOnboarding ? createPortal(<RewardsOnboardingModal onDismiss={dismissOnboarding} />, document.body) : null;

  return (
    <div className="space-y-6">
      {onboardingPortal}
      {/* MY REWARDS */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-zinc-900/95 to-black/85 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.45)]"
      >
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-white/45">My rewards</h2>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-white/50">Total points</p>
            <p className="mt-1 text-5xl font-bold text-white sm:text-6xl">
              <AnimatedPoints value={initialPoints.total_points} />
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <LevelBadge level={initialPoints.level} />
            </div>
          </div>
          <div className="flex w-full flex-col gap-3 sm:max-w-xs">
            <div>
              <div className="mb-1 flex justify-between text-xs text-white/50">
                <span>Next level</span>
                {progress.nextLabel ? (
                  <span>
                    {progress.nextLabel} · {progress.pointsToNext} pts to go
                  </span>
                ) : (
                  <span>Max tier</span>
                )}
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-[hsl(330,80%,55%)] to-[hsl(280,60%,50%)]"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress.pct}%` }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-4 py-3">
              <div>
                <p className="text-xs text-white/45">Spins available</p>
                <p className="text-lg font-semibold text-white">{initialPoints.spins_available}</p>
              </div>
              {spinPrizes.length > 0 ? (
                <p className="max-w-[11rem] text-right text-xs text-white/45">
                  Use the spin wheel below when you have spins.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </motion.section>

      {spinPrizes.length > 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.04 }}
        >
          <SpinWheel
            prizes={spinPrizes}
            initialSpinsAvailable={initialPoints.spins_available}
            recentWins={spinRecentWins}
            onAfterSpin={() => router.refresh()}
          />
        </motion.div>
      ) : null}

      {/* LEADERBOARD */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.08 }}
        className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-zinc-900/95 to-black/85 p-5 shadow-[0_20px_50px_rgba(0,0,0,0.45)]"
      >
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Leaderboard</h2>
            <p className="mt-1.5 text-xs text-white/45">
              Sorted by lifetime total points (same as My Rewards).
              {period !== "alltime" ? " The smaller line shows points earned in the selected period." : ""}
            </p>
          </div>
          <div
            className="flex shrink-0 flex-wrap gap-1 rounded-xl border border-white/10 bg-black/40 p-1"
            role="tablist"
            aria-label="Leaderboard period"
          >
            {(
              [
                ["weekly", "Weekly"],
                ["monthly", "Monthly"],
                ["alltime", "All time"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={period === key}
                onClick={() => setPeriod(key)}
                className={cn(
                  "min-h-11 min-w-[5.5rem] rounded-lg px-3 py-2 text-xs font-semibold transition active:scale-[0.98] sm:min-w-0",
                  period === key ? "bg-white/15 text-white" : "text-white/50 hover:text-white/85"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {loadingBoard ? (
          <div className="w-full min-w-0">
            <LeaderboardSkeleton />
          </div>
        ) : (
          <div className="mx-auto w-full min-w-0 max-w-4xl scroll-smooth">
            {/* Mobile: rank + name + score only — card stack */}
            <motion.ul
              className="space-y-3 md:hidden"
              initial="hidden"
              animate="show"
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.03 } } }}
            >
              {rows.map((row, index) => {
                const rank = index + 1;
                const isSelf = row.isCurrentUser || row.userId === currentUserId;
                const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
                return (
                  <motion.li
                    key={`m-${row.userId}`}
                    variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
                    className={cn(
                      "rounded-xl border p-3 backdrop-blur-sm transition-colors min-h-[52px]",
                      podiumCardClasses(rank, isSelf)
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-11 min-w-[44px] shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/30 text-base font-bold tabular-nums text-white"
                        aria-label={`Rank ${rank}`}
                      >
                        {medal ?? rank}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className="truncate text-base font-medium leading-tight text-white"
                          title={row.userName}
                        >
                          {row.userName}
                          {isSelf ? <span className="ml-1.5 text-xs font-normal text-pink-400">(you)</span> : null}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="tabular-nums text-xl font-bold leading-none text-white">{row.totalPoints}</p>
                        <p className="text-[10px] uppercase tracking-wide text-white/40">pts</p>
                      </div>
                    </div>
                  </motion.li>
                );
              })}
            </motion.ul>

            {/* Tablet/desktop: full table + sticky header */}
            <div className="hidden md:block">
              <div className="overflow-x-auto overscroll-x-contain rounded-xl border border-white/10 [-webkit-overflow-scrolling:touch]">
                <table className="w-full min-w-[600px] border-collapse text-left text-sm">
                  <thead className="sticky top-0 z-10 border-b border-white/10 bg-zinc-950/95 backdrop-blur-md">
                    <tr className="text-xs uppercase tracking-wider text-white/50">
                      <th scope="col" className="whitespace-nowrap px-4 py-3 font-semibold">
                        Rank
                      </th>
                      <th scope="col" className="px-4 py-3 font-semibold">
                        Chatter
                      </th>
                      <th scope="col" className="hidden lg:table-cell whitespace-nowrap px-4 py-3 font-semibold">
                        Level
                      </th>
                      <th scope="col" className="hidden sm:table-cell whitespace-nowrap px-4 py-3 text-right font-semibold">
                        {period === "weekly" ? "This week" : period === "monthly" ? "This month" : "Period"}
                      </th>
                      <th scope="col" className="whitespace-nowrap px-4 py-3 text-right font-semibold">
                        Total pts
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => {
                      const rank = index + 1;
                      const isSelf = row.isCurrentUser || row.userId === currentUserId;
                      const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
                      const initial = row.userName.trim().charAt(0).toUpperCase() || "?";
                      return (
                        <tr
                          key={row.userId}
                          className={cn(
                            "border-b border-white/[0.06] transition-colors last:border-0",
                            podiumTableRowClasses(rank, isSelf)
                          )}
                        >
                          <td className="whitespace-nowrap px-4 py-3 align-middle tabular-nums">
                            <span className="inline-flex h-10 min-w-[2.5rem] items-center justify-center font-semibold text-white">
                              {medal ?? rank}
                            </span>
                          </td>
                          <td className="max-w-[1px] px-4 py-3 align-middle">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white">
                                {initial}
                              </div>
                              <span className="min-w-0 truncate font-medium text-white" title={row.userName}>
                                {row.userName}
                                {isSelf ? (
                                  <span className="ml-1.5 text-xs font-normal text-pink-400">(you)</span>
                                ) : null}
                              </span>
                            </div>
                          </td>
                          <td className="hidden lg:table-cell whitespace-nowrap px-4 py-3 align-middle">
                            <span className="inline-flex rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-300">
                              {row.level}
                            </span>
                          </td>
                          <td className="hidden sm:table-cell whitespace-nowrap px-4 py-3 text-right align-middle tabular-nums text-white/80">
                            {period === "alltime" ? "—" : row.periodPoints}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right align-middle">
                            <span className="text-base font-bold tabular-nums text-white">{row.totalPoints}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </motion.section>

      {/* RECENT ACTIVITY */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.16 }}
        className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-zinc-900/95 to-black/85 p-5 shadow-[0_20px_50px_rgba(0,0,0,0.45)]"
      >
        <div className="mb-6">
          <div className="mb-2 flex items-center gap-3">
            <div className="h-6 w-1 rounded-full bg-gradient-to-b from-pink-500 to-purple-600" />
            <h2 className="text-lg font-bold text-white">Recent Activity</h2>
          </div>
          <p className="ml-7 text-sm text-white/40">Your latest achievements and actions</p>
        </div>
        {initialRecent.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5 text-3xl">
              📊
            </div>
            <h3 className="mb-2 font-medium text-white/60">No activity yet</h3>
            <p className="text-sm text-white/30">Complete shifts and challenges to see your activity here</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {visibleRecent.map((tx, i) => {
                const positive = tx.points >= 0;
                const activityType = inferActivityType(tx);
                return (
                  <motion.div
                    key={tx.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 + i * 0.03 }}
                    className="group relative rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm transition-all duration-300 hover:border-pink-500/30 hover:bg-white/[0.08]"
                  >
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-pink-500/0 via-purple-500/0 to-pink-500/0 transition-all duration-500 group-hover:from-pink-500/5 group-hover:via-purple-500/5 group-hover:to-pink-500/5" />
                    <div className="relative flex items-center gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-gradient-to-br from-white/10 to-white/5 text-lg">
                        {getActivityIcon(activityType)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white">{tx.reason}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <Clock className="h-3 w-3 text-white/30" aria-hidden />
                          <span className="text-xs text-white/40">{formatTimeAgo(tx.created_at)}</span>
                        </div>
                      </div>
                      {tx.points !== 0 ? (
                        <div
                          className={cn(
                            "shrink-0 rounded-lg border px-3 py-1.5 text-sm font-semibold",
                            positive
                              ? "border-green-500/30 bg-green-500/20 text-green-400"
                              : "border-red-500/30 bg-red-500/20 text-red-400"
                          )}
                        >
                          {positive ? "+" : ""}
                          {tx.points}
                        </div>
                      ) : null}
                    </div>
                  </motion.div>
                );
              })}
            </div>
            {canShowMoreActivity ? (
              <button
                type="button"
                onClick={() => setShowAllActivity((v) => !v)}
                className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-medium text-white/60 transition-all hover:bg-white/10 hover:text-white"
              >
                {showAllActivity ? "Show less activity" : "Show more activity"}
              </button>
            ) : null}
          </>
        )}
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.2 }}
        className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-zinc-900/95 to-black/85 shadow-[0_20px_50px_rgba(0,0,0,0.45)]"
      >
        <button
          type="button"
          onClick={() => setHowItWorksOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left text-sm font-semibold text-white/90 transition hover:bg-white/[0.04]"
          aria-expanded={howItWorksOpen}
        >
          <span>How it works {howItWorksOpen ? "↑" : "↓"}</span>
        </button>
        {howItWorksOpen ? (
          <div className="border-t border-white/[0.06] px-5 pb-5 pt-2">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-white/[0.06] bg-black/35 p-4">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.06] text-amber-200/90">
                  <Star className="h-4 w-4" aria-hidden />
                </div>
                <h3 className="text-sm font-semibold text-white">Earn points</h3>
                <p className="mt-2 text-xs leading-relaxed text-white/55">
                  Complete shifts, add whales, log transactions and submit availability to earn points automatically.
                </p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-black/35 p-4">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.06] text-amber-200/90">
                  <Trophy className="h-4 w-4" aria-hidden />
                </div>
                <h3 className="text-sm font-semibold text-white">Level up</h3>
                <p className="mt-2 text-xs leading-relaxed text-white/55">
                  Reach Silver ({pointsConfig.LEVEL_SILVER_MIN}pts), Gold ({pointsConfig.LEVEL_GOLD_MIN}pts) or Diamond (
                  {pointsConfig.LEVEL_DIAMOND_MIN}pts) to unlock better perks and rewards.
                </p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-black/35 p-4">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.06] text-pink-200/90">
                  <Gift className="h-4 w-4" aria-hidden />
                </div>
                <h3 className="text-sm font-semibold text-white">Spin &amp; win</h3>
                <p className="mt-2 text-xs leading-relaxed text-white/55">
                  Every {pointsConfig.POINTS_PER_SPIN} points earns you a free spin. Win cash bonuses, extra break time,
                  double points and more.
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </motion.section>
    </div>
  );
}
