import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { ChatterPerformanceClient } from "@/components/chatter-performance-client";
import {
  getChatterInflowwPerformance,
  resolveInflowwStatsRange,
} from "@/services/infloww-performance";

export default async function MyPerformancePage() {
  const user = await getSessionFromCookies();
  if (!user || !(await hasPermission(user, PERMISSIONS.INFLOWW_STATS_VIEW_OWN))) {
    redirect(ROUTES.dashboard);
  }

  const range = resolveInflowwStatsRange("this_week");
  const initial = await getChatterInflowwPerformance(user.id, range);

  return <ChatterPerformanceClient initial={initial} />;
}
