import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getLiveShifts } from "@/services/shifts";
import { getActiveShiftModels } from "@/services/shifts";
import { LiveShiftsPageLists } from "@/components/live-shifts-page-lists";
import { RouterRefreshInterval } from "@/components/router-refresh-interval";

export default async function LiveShiftsPage() {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);
  if (user.role !== "virtual_assistant" && user.role !== "admin" && user.role !== "manager") redirect(ROUTES.dashboard);

  const shifts = await getLiveShifts().catch(() => []);

  const withModelNames = await Promise.all(
    shifts.map(async (s) => {
      const models = await getActiveShiftModels(s.id).catch(() => []);
      return { ...s, modelNames: models.map((m) => m.model_name).filter(Boolean) };
    })
  );

  return (
    <RouterRefreshInterval intervalMs={60_000}>
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-white">Live shifts</h1>
        <p className="mt-1 text-sm text-white/60">All currently active and on-break shifts (chatter + virtual assistant).</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <LiveShiftsPageLists
          chatterRows={withModelNames.filter((s) => s.staff_role === "chatter")}
          vaRows={withModelNames.filter((s) => s.staff_role === "virtual_assistant")}
        />
      </div>
    </div>
    </RouterRefreshInterval>
  );
}
