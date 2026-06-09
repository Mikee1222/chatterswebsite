import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";
import { getCachedModelss } from "@/services/modelss";
import { getActiveShifts, getActiveShiftModels } from "@/services/shifts";
import { listAllModelPeriods } from "@/services/model-periods";
import { addDays, getTodayYmd } from "@/lib/weekly-program";
import { AdminModelsClient } from "@/components/admin-models-client";
import type { ModelRecord, ModelPeriodRecord } from "@/types";
import { listAllUsers } from "@/services/users";

export const revalidate = 30;

const stagger = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export default async function AdminModelsPage() {
  const user = await getSessionFromCookies();
  if (!user || (user.role !== "admin" && user.role !== "manager")) redirect(ROUTES.dashboard);

  const modelss = await getCachedModelss();
  await stagger(150);
  const vaShifts = await getActiveShifts("virtual_assistant").catch(() => []);
  await stagger(150);
  const allPeriods = await listAllModelPeriods().catch(() => [] as ModelPeriodRecord[]);
  await stagger(150);
  const allUsers = await listAllUsers().catch(() => []);
  const linkedModelIds = new Set(
    allUsers
      .filter((u) => u.role === "model")
      .map((u) => u.linked_model_id)
      .filter((id): id is string => Boolean(id?.trim()))
  );
  const modelsWithAccountStatus = modelss.map((m) => ({
    ...m,
    hasLinkedAccount: linkedModelIds.has(m.id),
  }));

  const todayYmd = getTodayYmd();
  const periodsByModel = new Map<string, ModelPeriodRecord[]>();
  for (const p of allPeriods) {
    if (!p.model_id) continue;
    if (!periodsByModel.has(p.model_id)) periodsByModel.set(p.model_id, []);
    periodsByModel.get(p.model_id)!.push(p);
  }
  for (const rows of periodsByModel.values()) {
    rows.sort((a, b) => b.start_date.localeCompare(a.start_date));
  }

  const periodSummaryByModelId: Record<
    string,
    { current: ModelPeriodRecord | null; predictedNextStart: string | null; history: ModelPeriodRecord[] }
  > = {};
  for (const m of modelss) {
    const rows = periodsByModel.get(m.id) ?? [];
    const current = rows.find((r) => r.start_date <= todayYmd && r.end_date >= todayYmd) ?? null;
    const lastStart = rows[0]?.start_date;
    const cycle =
      typeof m.avg_cycle_length === "number" && m.avg_cycle_length > 0 ? m.avg_cycle_length : 28;
    const predictedNextStart = lastStart ? addDays(lastStart, cycle) : null;
    periodSummaryByModelId[m.id] = {
      current,
      predictedNextStart,
      history: rows.slice(0, 12),
    };
  }

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
      modelss={modelsWithAccountStatus as (ModelRecord & { hasLinkedAccount: boolean })[]}
      modelIdToVaNames={modelIdToVaNames}
      periodSummaryByModelId={periodSummaryByModelId}
    />
  );
}
