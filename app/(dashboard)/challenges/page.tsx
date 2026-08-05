import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import {
  ArrowUp,
  BarChart3,
  Calendar,
  CheckSquare,
  Clock,
  DollarSign,
  MessageSquare,
  Percent,
  RefreshCw,
  Send,
  Star,
  Target,
  TrendingUp,
  Unlock,
  Users,
  Zap,
} from "lucide-react";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getTodayYmdAthens } from "@/lib/airtable-datetime";
import {
  CHALLENGE_METRIC_LABELS,
  daysRemainingYmd,
  formatChallengeProgress,
  formatChallengeValue,
  isInflowwChallengeMetric,
  type ChallengeMetric,
} from "@/lib/challenges";
import { getAllChallengesWithProgress } from "@/services/challenges";
import { cn } from "@/lib/utils";

const METRIC_ICON: Record<ChallengeMetric, ReactNode> = {
  transactions: <TrendingUp className="h-6 w-6" aria-hidden />,
  whales_added: <Star className="h-6 w-6" aria-hidden />,
  shift_hours: <Clock className="h-6 w-6" aria-hidden />,
  customs_completed: <CheckSquare className="h-6 w-6" aria-hidden />,
  whale_status_upgrades: <ArrowUp className="h-6 w-6" aria-hidden />,
  rebills_verified: <RefreshCw className="h-6 w-6" aria-hidden />,
  infloww_sales: <DollarSign className="h-6 w-6" aria-hidden />,
  infloww_ppv_sales: <DollarSign className="h-6 w-6" aria-hidden />,
  infloww_tips: <DollarSign className="h-6 w-6" aria-hidden />,
  infloww_messages: <MessageSquare className="h-6 w-6" aria-hidden />,
  infloww_ppvs_sent: <Send className="h-6 w-6" aria-hidden />,
  infloww_ppvs_unlocked: <Unlock className="h-6 w-6" aria-hidden />,
  infloww_unlock_rate: <Percent className="h-6 w-6" aria-hidden />,
  infloww_golden_ratio: <BarChart3 className="h-6 w-6" aria-hidden />,
  infloww_fans_chatted: <Users className="h-6 w-6" aria-hidden />,
  infloww_rev_per_hour: <Zap className="h-6 w-6" aria-hidden />,
  infloww_rev_per_fan: <TrendingUp className="h-6 w-6" aria-hidden />,
};

export default async function ChallengesPage() {
  const user = await getSessionFromCookies();
  if (!user || getEffectiveStaffRole(user) !== "chatter") redirect(ROUTES.dashboard);

  const userId = user.airtableUserId ?? user.id;
  const todayYmd = getTodayYmdAthens();
  const rows = await getAllChallengesWithProgress(userId).catch(() => []);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 md:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Challenges</h1>
        <p className="mt-1 text-sm text-white/55">Active goals. Complete them to earn bonus points.</p>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/5">
            <Target className="h-10 w-10 text-white/40" aria-hidden />
          </div>
          <h3 className="mb-2 font-medium text-white/60">No active challenges</h3>
          <p className="text-sm text-white/30">Check back soon for new challenges!</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {rows.map((c) => {
            const target = Math.max(0.01, c.target_value);
            const unavailable = Boolean(c.progress_unavailable);
            const current = c.completed
              ? target
              : unavailable
                ? 0
                : Math.min(target, c.current_value);
            const pct = unavailable ? 0 : Math.min(100, (current / target) * 100);
            const daysLeft = daysRemainingYmd(c.end_date, todayYmd);
            const icon = METRIC_ICON[c.target_metric] ?? <Target className="h-6 w-6" aria-hidden />;
            const metricLabel = CHALLENGE_METRIC_LABELS[c.target_metric];

            return (
              <li
                key={c.id}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition-all duration-300 hover:border-pink-500/30 hover:bg-white/[0.08]"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-pink-500/0 via-pink-500/0 to-purple-500/0 transition-all duration-500 group-hover:from-pink-500/5 group-hover:to-purple-500/5" />

                <div className="relative">
                  <div className="absolute -left-2 -top-2 flex h-12 w-12 items-center justify-center rounded-full border border-pink-500/30 bg-gradient-to-br from-pink-500/20 to-purple-500/20 text-pink-300">
                    {icon}
                  </div>

                  <div className="mb-3 flex items-start justify-between gap-3 pl-12">
                    <div>
                      <h2 className="text-lg font-semibold text-white">{c.title}</h2>
                      <p className="mt-0.5 text-xs text-white/40">{metricLabel}</p>
                      {c.description ? <p className="mt-1 text-sm text-white/50">{c.description}</p> : null}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="rounded-full border border-yellow-500/30 bg-gradient-to-r from-yellow-500/20 to-amber-500/20 px-3 py-1 text-sm font-semibold text-yellow-400">
                        +{c.reward_points} pts
                      </div>
                      {daysLeft > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs text-white/30">
                          <Calendar className="h-3 w-3" aria-hidden />
                          Ends in {daysLeft}d
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-sm text-white/60">Your progress</span>
                      {unavailable ? (
                        <span className="text-sm font-medium text-amber-200/90">Data pending</span>
                      ) : (
                        <span className="text-sm font-medium tabular-nums text-white">
                          {formatChallengeProgress(c.target_metric, current, target)}
                        </span>
                      )}
                    </div>

                    {unavailable ? (
                      <div
                        className={cn(
                          "rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-100/90"
                        )}
                      >
                        {c.progress_unavailable_reason ??
                          (isInflowwChallengeMetric(c.target_metric)
                            ? "Infloww stats are not available yet for this challenge window."
                            : "Progress is temporarily unavailable.")}
                      </div>
                    ) : (
                      <>
                        <div className="h-3 overflow-hidden rounded-full bg-white/5">
                          <div
                            className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-pink-500 to-purple-500 transition-all duration-700 ease-out"
                            style={{ width: `${pct}%` }}
                          >
                            <div className="animate-shimmer absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                          </div>
                        </div>
                        {!c.completed && current > 0 ? (
                          <p className="mt-2 text-xs text-white/40">
                            {formatChallengeValue(c.target_metric, Math.max(0, target - current))} to go
                          </p>
                        ) : null}
                      </>
                    )}
                  </div>

                  {c.completed ? (
                    <div className="mt-3 flex items-center gap-2 text-green-400">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full border border-green-500/40 bg-green-500/20">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-sm font-medium">Completed!</span>
                    </div>
                  ) : null}
                  {daysLeft <= 0 && !c.completed && !unavailable ? (
                    <div className="mt-3 text-xs text-rose-300/80">Ends today</div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
