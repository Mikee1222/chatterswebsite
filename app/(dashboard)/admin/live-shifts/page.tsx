import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";
import { getLiveShifts, getActiveShiftModels } from "@/services/shifts";
import { AdminLiveShiftsClient } from "@/components/admin-live-shifts-client";

export default async function AdminLiveShiftsPage() {
  const user = await getSessionFromCookies();
  if (!user || (user.role !== "admin" && user.role !== "manager")) redirect(ROUTES.dashboard);

  const shifts = await getLiveShifts().catch(() => []);
  const withModelNames = await Promise.all(
    shifts.map(async (s) => {
      const models = await getActiveShiftModels(s.id).catch(() => []);
      return { ...s, modelNames: models.map((m) => m.model_name).filter(Boolean) };
    })
  );

  return <AdminLiveShiftsClient shiftsWithModels={withModelNames} />;
}
