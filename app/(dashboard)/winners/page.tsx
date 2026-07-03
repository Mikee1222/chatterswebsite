import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { getWinnerVideosBySubmitter } from "@/services/winner-videos";
import { VaWinnerVideosClient } from "@/components/va-winner-videos-client";

export default async function WinnersSubmitPage() {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);
  if (!(await hasPermission(user, PERMISSIONS.WINNER_VIDEOS_SUBMIT))) {
    redirect(ROUTES.dashboard);
  }

  const submissions = await getWinnerVideosBySubmitter(user.airtableUserId ?? user.id).catch(() => []);

  return (
    <div className="w-full max-w-full px-4 py-6 md:px-6">
      <VaWinnerVideosClient initialSubmissions={submissions} />
    </div>
  );
}
