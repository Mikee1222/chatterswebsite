import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import {
  calculateLevel,
  getAllChatterPointsSummaries,
  getGlobalRecentPointsLedger,
  type ChatterPointsSummaryRow,
} from "@/services/points-engine";
import { listAllUsers } from "@/services/users";
import { AdminRewardsClient } from "@/components/admin-rewards-client";

export default async function AdminRewardsPage() {
  const user = await getSessionFromCookies();
  if (!user || (user.role !== "admin" && user.role !== "manager")) redirect(ROUTES.dashboard);

  const [summaries, users, ledger] = await Promise.all([
    getAllChatterPointsSummaries().catch(() => []),
    listAllUsers().catch(() => []),
    getGlobalRecentPointsLedger(50).catch(() => []),
  ]);

  const chatters = users
    .filter((u) => u.role === "chatter")
    .map((u) => ({ id: u.id, name: u.full_name?.trim() || u.email || u.id }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const byId = new Map(summaries.map((s) => [s.userId, s]));
  const bronzeLevel = await calculateLevel(0);
  const merged: ChatterPointsSummaryRow[] = chatters.map((c) => {
    const existing = byId.get(c.id);
    if (existing) return existing;
    return {
      userId: c.id,
      userName: c.name,
      total_points: 0,
      level: bronzeLevel,
      streak_days: 0,
      spins_available: 0,
      last_active: "—",
    };
  });
  merged.sort((a, b) => b.total_points - a.total_points);

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 md:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Rewards</h1>
        <p className="mt-1 text-sm text-white/55">Chatter points overview and manual adjustments.</p>
      </div>
      <AdminRewardsClient
        summaries={merged}
        chatters={chatters}
        ledger={ledger}
        isAdmin={user.role === "admin"}
        showAdminInfoCard={user.role === "admin"}
      />
    </div>
  );
}
