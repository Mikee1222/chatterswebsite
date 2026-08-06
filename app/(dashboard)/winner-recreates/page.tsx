import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { listVideoBunches } from "@/services/winner-sourcing";
import { WinnerRecreatesClient } from "@/components/winner-recreates-client";

export default async function WinnerRecreatesPage() {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);
  if (!(await hasPermission(user, PERMISSIONS.WINNER_SOURCING_SUBMIT))) {
    redirect(ROUTES.dashboard);
  }
  // Managers use the hub instead.
  if (await hasPermission(user, PERMISSIONS.WINNER_SOURCING_MANAGE)) {
    redirect(ROUTES.admin.winnerVideosHub);
  }

  const bunches = await listVideoBunches({ status: "open" }).catch(() => []);
  const openWithRoom = bunches.filter((b) => (b.remaining_count ?? 0) > 0);

  return (
    <div className="w-full max-w-full px-4 py-6 md:px-6">
      <WinnerRecreatesClient initialBunches={openWithRoom} />
    </div>
  );
}
