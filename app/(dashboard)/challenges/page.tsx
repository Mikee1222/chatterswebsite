import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getTodayYmdAthens } from "@/lib/airtable-datetime";
import { daysRemainingYmd } from "@/lib/challenges";
import { getAllChallengesWithProgress } from "@/services/challenges";

const METRIC_ICON: Record<string, string> = {
  transactions: "💰",
  whales_added: "🐋",
  shift_hours: "⏰",
  customs_completed: "🎯",
  whale_status_upgrades: "⬆️",
};

export default async function ChallengesPage() {
  const user = await getSessionFromCookies();
  if (!user || user.role !== "chatter") redirect(ROUTES.dashboard);

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
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/5 text-4xl">
            🎯
          </div>
          <h3 className="mb-2 font-medium text-white/60">No active challenges</h3>
          <p className="text-sm text-white/30">Check back soon for new challenges!</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {rows.map((c) => {
            const target = Math.max(1, c.target_value);
            const current = c.completed ? target : Math.min(target, c.current_value);
            const pct = Math.min(100, (current / target) * 100);
            const daysLeft = daysRemainingYmd(c.end_date, todayYmd);
            const icon = METRIC_ICON[c.target_metric] ?? "✨";
            return (
              <li
                key={c.id}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition-all duration-300 hover:border-pink-500/30 hover:bg-white/[0.08]"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-pink-500/0 via-pink-500/0 to-purple-500/0 transition-all duration-500 group-hover:from-pink-500/5 group-hover:to-purple-500/5" />

                <div className="relative">
                  <div className="absolute -left-2 -top-2 flex h-12 w-12 items-center justify-center rounded-full border border-pink-500/30 bg-gradient-to-br from-pink-500/20 to-purple-500/20 text-2xl">
                    {icon}
                  </div>

                  <div className="mb-3 flex items-start justify-between gap-3 pl-12">
                    <div>
                      <h2 className="text-lg font-semibold text-white">{c.title}</h2>
                      {c.description ? <p className="mt-1 text-sm text-white/50">{c.description}</p> : null}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="rounded-full border border-yellow-500/30 bg-gradient-to-r from-yellow-500/20 to-amber-500/20 px-3 py-1 text-sm font-semibold text-yellow-400">
                        +{c.reward_points} pts
                      </div>
                      {daysLeft > 0 ? <span className="text-xs text-white/30">Ends in {daysLeft}d</span> : null}
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm text-white/60">Your progress</span>
                      <span className="text-sm font-medium text-white">
                        {current} / {target}
                      </span>
                    </div>

                    <div className="h-3 overflow-hidden rounded-full bg-white/5">
                      <div
                        className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-pink-500 to-purple-500 transition-all duration-700 ease-out"
                        style={{ width: `${pct}%` }}
                      >
                        <div className="animate-shimmer absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                      </div>
                    </div>
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
                  {daysLeft <= 0 && !c.completed ? (
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
