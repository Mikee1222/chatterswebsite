import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";
import { listAllModelss } from "@/services/modelss";
import { getActiveShifts, getActiveShiftModels } from "@/services/shifts";
import { AdminModelsClient } from "@/components/admin-models-client";
import type { ModelRecord } from "@/types";

export default async function AdminModelsPage() {
  const user = await getSessionFromCookies();
  if (!user || (user.role !== "admin" && user.role !== "manager")) redirect(ROUTES.dashboard);

  const [modelss, vaShifts] = await Promise.all([
    listAllModelss(),
    getActiveShifts("virtual_assistant").catch(() => []),
  ]);

  const modelIdToVaNames: Record<string, string[]> = {};
  for (const shift of vaShifts) {
    const shiftModels = await getActiveShiftModels(shift.id).catch(() => []);
    for (const sm of shiftModels) {
      if (!sm.left_at && sm.model_id) {
        const name = sm.chatter_name?.trim() || "VA";
        if (!modelIdToVaNames[sm.model_id]) modelIdToVaNames[sm.model_id] = [];
        if (!modelIdToVaNames[sm.model_id].includes(name)) modelIdToVaNames[sm.model_id].push(name);
      }
    }
  }

  return (
    <AdminModelsClient
      modelss={modelss as ModelRecord[]}
      modelIdToVaNames={modelIdToVaNames}
    />
  );
}
