import { getSessionFromCookies } from "@/lib/auth";
import { requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";
import { getLiveShifts, getActiveShiftModelsForShiftIds } from "@/services/shifts";
import { listAllShiftQueueWaiting } from "@/services/shift-queue";
import { listAllUsers } from "@/services/users";
import { AdminLiveShiftsClient } from "@/components/admin-live-shifts-client";
import type { AdminShiftQueueRow } from "@/types";
import { RouterRefreshInterval } from "@/components/router-refresh-interval";
import { SupabaseLiveShiftsRealtime } from "@/components/supabase-live-shifts-realtime";
import type { ShiftModel } from "@/types";

export default async function AdminLiveShiftsPage() {
  const user = await requireAdminRoute(await getSessionFromCookies(), PERMISSIONS.SHIFTS_ACTIVE_VIEW);

  const shifts = await getLiveShifts().catch(() => []);
  const users = await listAllUsers().catch(() => []);
  const telegramByUserId = Object.fromEntries(
    users
      .filter((u) => u.telegram_username)
      .map((u) => [u.id, u.telegram_username!.replace(/^@/, "")])
  );
  const activeModelsByShiftId = await getActiveShiftModelsForShiftIds(shifts.map((s) => s.id)).catch(
    () => ({} as Record<string, ShiftModel[]>)
  );
  const withModelNames = shifts.map((s) => ({
    ...s,
    modelNames: (activeModelsByShiftId[s.id] ?? []).map((m) => m.model_name).filter(Boolean),
  }));

  const queueRows = await listAllShiftQueueWaiting().catch(() => []);
  const shiftQueue: AdminShiftQueueRow[] = queueRows.map((e) => ({
    id: e.id,
    chatter_name: e.chatter_name,
    waitingForChatterName: e.waiting_for_chatter_name,
    waiting_for_shift_id: e.waiting_for_shift_id,
    selectedModelNames: e.selected_model_names.filter(Boolean),
    queue_type: e.queue_type ?? "full_start",
  }));

  return (
    <RouterRefreshInterval intervalMs={60_000}>
      <SupabaseLiveShiftsRealtime />
      <AdminLiveShiftsClient
        shiftsWithModels={withModelNames}
        shiftQueue={shiftQueue}
        telegramByUserId={telegramByUserId}
      />
    </RouterRefreshInterval>
  );
}
