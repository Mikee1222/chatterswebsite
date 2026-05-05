import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { listAllModelss } from "@/services/modelss";
import { ModelsDirectoryTable } from "@/components/models-directory-table";
import { RouterRefreshInterval } from "@/components/router-refresh-interval";
import { getActiveShifts, getActiveShiftModels } from "@/services/shifts";

export default async function ModelsPage() {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);
  if (user.role !== "virtual_assistant" && user.role !== "admin" && user.role !== "manager") redirect(ROUTES.dashboard);

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
    <RouterRefreshInterval intervalMs={60_000}>
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-white">Models free / taken</h1>
        <p className="mt-1 text-sm text-white/60">
          Chatter occupancy is exclusive. Virtual assistants can be in a model at the same time as a chatter (mistake-checking).
        </p>
      </div>
      <div className="glass-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-white/10 bg-black/40 text-left text-xs font-medium uppercase tracking-wider text-white/50">
            <tr>
              <th className="p-3 font-medium">Model</th>
              <th className="p-3 font-medium">Chatter</th>
              <th className="p-3 font-medium">Virtual assistant</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            <ModelsDirectoryTable modelss={modelss} modelIdToVaNames={modelIdToVaNames} />
          </tbody>
        </table>
      </div>
    </div>
    </RouterRefreshInterval>
  );
}
