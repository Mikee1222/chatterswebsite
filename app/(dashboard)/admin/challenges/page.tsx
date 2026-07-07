import { getSessionFromCookies } from "@/lib/auth";
import { requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { getTodayYmdAthens } from "@/lib/airtable-datetime";
import {
  activeChatterCount,
  getAllChallengesForAdmin,
  getCompletionCountsByChallenge,
} from "@/services/challenges";
import { filterActiveUsersForAssignment } from "@/lib/assignment-filters";
import { listAllUsers } from "@/services/users";
import { AdminChallengesClient } from "@/components/admin-challenges-client";

export default async function AdminChallengesPage() {
  await requireAdminRoute(await getSessionFromCookies(), PERMISSIONS.CHALLENGES_MANAGE);

  const todayYmd = getTodayYmdAthens();
  const [challenges, completionByChallenge, activeChatterDenominator, users] = await Promise.all([
    getAllChallengesForAdmin().catch(() => []),
    getCompletionCountsByChallenge().catch(() => ({})),
    activeChatterCount().catch(() => 1),
    listAllUsers().catch(() => []),
  ]);

  const chatters = filterActiveUsersForAssignment(users)
    .filter((u) => u.role === "chatter")
    .map((u) => ({ id: u.id, name: u.full_name?.trim() || u.email || u.id }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
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
