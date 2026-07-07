import { getSessionFromCookies } from "@/lib/auth";
import { requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";
import { getPointsConfig } from "@/services/points-config";
import { getAllSpinPrizes } from "@/services/spin-wheel";
import { listAllUsers, filterActiveUsersForAssignment } from "@/services/users";
import { RewardsConfigClient } from "@/components/rewards-config-client";

export default async function AdminRewardsConfigPage() {
  const user = await getSessionFromCookies();
  

  const [config, users, spinPrizes] = await Promise.all([
    getPointsConfig(),
    listAllUsers().catch(() => []),
    getAllSpinPrizes().catch(() => []),
  ]);

  const chatters = filterActiveUsersForAssignment(users)
    .filter((u) => u.role === "chatter")
    .map((u) => ({ id: u.id, name: u.full_name?.trim() || u.email || u.id }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 md:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Rewards configuration</h1>
        <p className="mt-1 text-sm text-white/55">Manage point values, level thresholds, and spin wheel prizes.</p>
      </div>
      <RewardsConfigClient initialConfig={config} chatters={chatters} spinPrizes={spinPrizes} />
    </div>
  );
}
