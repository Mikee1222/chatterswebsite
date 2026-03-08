import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { listAllModelss } from "@/services/modelss";
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
            {modelss.length === 0 ? (
              <tr>
                <td colSpan={3} className="p-8 text-center text-white/50">
                  No models
                </td>
              </tr>
            ) : (
              modelss.map((m) => {
                const chatterStatus = m.current_status === "occupied" ? (m.current_chatter_name || "Occupied") : "Free";
                const vaNames = modelIdToVaNames[m.id] ?? [];
                return (
                  <tr key={m.id} className="hover:bg-white/[0.03]">
                    <td className="p-3 font-medium text-white/90">{m.model_name}</td>
                    <td className="p-3">
                      <span
                        className={
                          m.current_status === "occupied"
                            ? "rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-amber-300"
                            : "rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-emerald-300"
                        }
                      >
                        {chatterStatus}
                      </span>
                    </td>
                    <td className="p-3">
                      {vaNames.length > 0 ? (
                        <span className="rounded-full border border-[hsl(330,80%,55%)]/30 bg-[hsl(330,80%,55%)]/15 px-2 py-0.5 text-[hsl(330,90%,75%)]">
                          {vaNames.join(", ")}
                        </span>
                      ) : (
                        <span className="text-white/45">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
