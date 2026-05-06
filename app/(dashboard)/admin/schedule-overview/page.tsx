import { ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";

/** Optional alias: `/admin/schedule-overview` → canonical model-schedules overview. */
export default function AdminScheduleOverviewAliasPage({
  searchParams,
}: {
  searchParams?: { week?: string };
}) {
  const week = typeof searchParams?.week === "string" ? searchParams.week.trim() : "";
  const q = week ? `?week=${encodeURIComponent(week)}` : "";
  redirect(`${ROUTES.admin.modelSchedulesOverview}${q}`);
}
