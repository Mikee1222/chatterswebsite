import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";
import { getPointsConfig } from "@/services/points-config";
import { getAllSpinPrizes } from "@/services/spin-wheel";
import { listAllUsers } from "@/services/users";
import { RewardsConfigClient } from "@/components/rewards-config-client";

export default async function AdminRewardsConfigPage() {
  const user = await getSessionFromCookies();
  if (!user || user.role !== "admin") redirect(ROUTES.dashboard);

  const [config, users, spinPrizes] = await Promise.all([
    getPointsConfig(),
    listAllUsers().catch(() => []),
    getAllSpinPrizes().catch(() => []),
  ]);

  const chatters = users
    .filter((u) => u.role === "chatter")
    .map((u) => ({ id: u.id, name: u.full_name?.trim() || u.email || u.id }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8 md:max-w-5xl md:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Rewards configuration</h1>
        <p className="mt-1 text-sm text-white/55">Point values used when awarding chatters. Changes apply to new awards only.</p>
      </div>
      <RewardsConfigClient initialConfig={config} chatters={chatters} spinPrizes={spinPrizes} />
    </div>
  );
}
