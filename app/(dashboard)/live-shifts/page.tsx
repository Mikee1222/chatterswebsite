import { redirect } from "next/navigation";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getLiveShifts } from "@/services/shifts";
import { getActiveShiftModelsForShiftIds } from "@/services/shifts";
import { LiveShiftsPageLists } from "@/components/live-shifts-page-lists";
import { RouterRefreshInterval } from "@/components/router-refresh-interval";
import { SupabaseLiveShiftsRealtime } from "@/components/supabase-live-shifts-realtime";
import type { ShiftModel } from "@/types";

export default async function LiveShiftsPage() {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);
  const staffVa = getEffectiveStaffRole(user) === "virtual_assistant";
  if (!staffVa && user.role !== "admin" && user.role !== "manager") redirect(ROUTES.dashboard);

  const shifts = await getLiveShifts().catch(() => []);

  const activeModelsByShiftId = await getActiveShiftModelsForShiftIds(shifts.map((s) => s.id)).catch(
    () => ({} as Record<string, ShiftModel[]>)
  );
  const withModelNames = shifts.map((s) => ({
    ...s,
    modelNames: (activeModelsByShiftId[s.id] ?? []).map((m) => m.model_name).filter(Boolean),
  }));

  return (
    <RouterRefreshInterval intervalMs={60_000}>
    <SupabaseLiveShiftsRealtime />
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
