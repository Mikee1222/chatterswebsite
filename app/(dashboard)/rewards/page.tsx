import { redirect } from "next/navigation";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import {
  getChatterPoints,
  getLeaderboard,
  getRecentPointsTransactions,
} from "@/services/points-engine";
import { getPointsConfig } from "@/services/points-config";
import { getActiveSpinPrizes, getRecentSpinsForUser } from "@/services/spin-wheel";
import { RewardsClient } from "@/components/rewards-client";

export default async function RewardsPage() {
  const user = await getSessionFromCookies();
  if (!user || getEffectiveStaffRole(user) !== "chatter") redirect(ROUTES.dashboard);

  const userId = user.airtableUserId ?? user.id;

  const [points, leaderboardWeekly, recent, spinPrizes, recentSpins, pointsConfig] = await Promise.all([
    getChatterPoints(userId),
    getLeaderboard("weekly"),
    getRecentPointsTransactions(userId, 10),
    getActiveSpinPrizes(),
    getRecentSpinsForUser(userId, 12),
    getPointsConfig(),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6 md:max-w-3xl md:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Rewards</h1>
        <p className="mt-1 text-sm text-white/55">Your points, leaderboard, and recent activity.</p>
      </div>
      <RewardsClient
        currentUserId={userId}
        initialPoints={points}
        initialLeaderboard={leaderboardWeekly}
        initialRecent={recent}
        pointsConfig={pointsConfig}
        spinPrizes={spinPrizes.map((p) => ({
          id: p.id,
          label: p.label,
          color: p.color,
          prize_type: p.prize_type,
          prize_value: p.prize_value,
          probability: p.probability,
        }))}
        spinRecentWins={recentSpins.map((s) => ({
          id: s.id,
          prize_label: s.prize_label,
          created_at: s.created_at,
        }))}
      />
    </div>
  );
}
