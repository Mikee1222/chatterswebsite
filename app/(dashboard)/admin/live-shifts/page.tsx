import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";
import { getLiveShifts, getActiveShiftModels } from "@/services/shifts";
import { listAllShiftQueueWaiting } from "@/services/shift-queue";
import { AdminLiveShiftsClient } from "@/components/admin-live-shifts-client";
import type { AdminShiftQueueRow } from "@/types";

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

  const queueRows = await listAllShiftQueueWaiting().catch(() => []);
  const shiftQueue: AdminShiftQueueRow[] = queueRows.map((e) => ({
    id: e.id,
    chatter_name: e.chatter_name,
    waitingForChatterName: e.waiting_for_chatter_name,
    waiting_for_shift_id: e.waiting_for_shift_id,
    selectedModelNames: e.selected_model_names.filter(Boolean),
  }));

  return <AdminLiveShiftsClient shiftsWithModels={withModelNames} shiftQueue={shiftQueue} />;
}
