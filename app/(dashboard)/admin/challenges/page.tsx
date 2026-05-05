import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getTodayYmdAthens } from "@/lib/airtable-datetime";
import {
  activeChatterCount,
  getAllChallengesForAdmin,
  getCompletionCountsByChallenge,
} from "@/services/challenges";
import { listAllUsers } from "@/services/users";
import { AdminChallengesClient } from "@/components/admin-challenges-client";

export default async function AdminChallengesPage() {
  const user = await getSessionFromCookies();
  if (!user || user.role !== "admin") redirect(ROUTES.dashboard);

  const todayYmd = getTodayYmdAthens();
  const [challenges, completionByChallenge, activeChatterDenominator, users] = await Promise.all([
    getAllChallengesForAdmin().catch(() => []),
    getCompletionCountsByChallenge().catch(() => ({})),
    activeChatterCount().catch(() => 1),
    listAllUsers().catch(() => []),
  ]);

  const chatters = users
    .filter((u) => u.role === "chatter")
    .map((u) => ({ id: u.id, name: u.full_name?.trim() || u.email || u.id }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 md:max-w-4xl md:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Challenges</h1>
        <p className="mt-1 text-sm text-white/55">Create and manage rewards challenges. Progress updates from chatters’ activity.</p>
      </div>
      <AdminChallengesClient
        challenges={challenges}
        completionByChallenge={completionByChallenge}
        activeChatterDenominator={activeChatterDenominator}
        todayYmd={todayYmd}
        chatters={chatters}
      />
    </div>
  );
}
