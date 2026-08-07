import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { listFilmingSchedule } from "@/services/filming";
import { listActiveGunzoTeamModelss } from "@/services/modelss";
import {
  FilmingCalendarClient,
  type FilmingCalendarModelOption,
} from "@/components/filming-calendar-client";

export default async function FilmingCalendarPage() {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);
  const canView = await hasPermission(user, PERMISSIONS.FILMING_VIEW_ASSIGNMENTS);
  const canManage = await hasPermission(user, PERMISSIONS.FILMING_MANAGE);
  if (!canView && !canManage) redirect(ROUTES.dashboard);

  const now = new Date();
  const day = (now.getDay() + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - day);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const ymd = (d: Date) => d.toISOString().slice(0, 10);

  const [entries, gunzoModels] = await Promise.all([
    listFilmingSchedule({ fromDate: ymd(monday), toDate: ymd(sunday) }).catch(() => []),
    listActiveGunzoTeamModelss().catch(() => []),
  ]);

  const models: FilmingCalendarModelOption[] = gunzoModels.map((m) => ({
    model_id: m.id || m.model_id,
    model_name: m.model_name || m.model_id || "Creator",
  }));

  return (
    <div className="w-full max-w-full px-4 py-6 md:px-6">
      <FilmingCalendarClient initialEntries={entries} models={models} canManage={canManage} />
    </div>
  );
}
