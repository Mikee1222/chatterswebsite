import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { listWinnerLibrary } from "@/services/winner-recreates";
import { WinnerLibraryClient } from "@/components/winner-library-client";

/** Manos' winner library: annotate winners + pull N recreates into bunches; rest stay archived. */
export default async function WinnerLibraryPage() {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);
  const ok =
    (await hasPermission(user, PERMISSIONS.WINNER_VIDEOS_MANAGE)) ||
    (await hasPermission(user, PERMISSIONS.CONTENT_PIPELINE_MANAGE));
  if (!ok) redirect(ROUTES.dashboard);

  const entries = await listWinnerLibrary().catch(() => []);

  return (
    <div className="w-full max-w-full px-4 py-6 md:px-6">
      <WinnerLibraryClient entries={entries} />
    </div>
  );
}
