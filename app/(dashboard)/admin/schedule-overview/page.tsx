import { ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
