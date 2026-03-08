import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";
import { normalizeWeekStart, getThisWeekMonday } from "@/lib/weekly-program";
import { weeklyAvailabilityUrl } from "@/lib/routes";
import { getRequestsForWeek } from "@/services/weekly-availability-requests";
import { WeeklyAvailabilityClient } from "@/components/weekly-availability-client";
import type { WeeklyAvailabilityRequest } from "@/types";

export default async function WeeklyAvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ week_start?: string }>;
}) {
  const user = await getSessionFromCookies();
  if (!user || user.role !== "chatter") redirect(ROUTES.dashboard);

  const params = await searchParams;
  const rawWeek = params.week_start?.trim();
  const weekStart = normalizeWeekStart(rawWeek || getThisWeekMonday());
  if (rawWeek && rawWeek !== weekStart) redirect(weeklyAvailabilityUrl(weekStart));

  const chatterId = user.airtableUserId ?? user.id;
  const requests = await getRequestsForWeek(weekStart, chatterId).catch((err) => {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[weekly-availability page] getRequestsForWeek failed", err);
    }
    return [];
  });

  return (
    <WeeklyAvailabilityClient
      weekStart={weekStart}
      initialRequests={requests as WeeklyAvailabilityRequest[]}
    />
  );
}
