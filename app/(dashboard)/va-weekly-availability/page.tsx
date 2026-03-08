import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";
import { normalizeWeekStart, getThisWeekMonday } from "@/lib/weekly-program";
import { vaWeeklyAvailabilityUrl } from "@/lib/routes";
import { getRequestsForWeekVa } from "@/services/weekly-availability-requests-va";
import { VaWeeklyAvailabilityClient } from "@/components/va-weekly-availability-client";
import type { WeeklyAvailabilityRequest } from "@/types";

export default async function VaWeeklyAvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ week_start?: string }>;
}) {
  const user = await getSessionFromCookies();
  if (!user || user.role !== "virtual_assistant") redirect(ROUTES.dashboard);

  const params = await searchParams;
  const rawWeek = params.week_start?.trim();
  const weekStart = normalizeWeekStart(rawWeek || getThisWeekMonday());
  if (rawWeek && rawWeek !== weekStart) redirect(vaWeeklyAvailabilityUrl(weekStart));

  const vaId = user.airtableUserId ?? user.id;
  const requests = await getRequestsForWeekVa(weekStart, vaId).catch(() => []);

  return (
    <VaWeeklyAvailabilityClient
      weekStart={weekStart}
      initialRequests={requests as WeeklyAvailabilityRequest[]}
    />
  );
}
