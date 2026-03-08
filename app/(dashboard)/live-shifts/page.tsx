import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getLiveShifts } from "@/services/shifts";
import { getActiveShiftModels } from "@/services/shifts";
import { formatDateTimeEuropean } from "@/lib/format";

export default async function LiveShiftsPage() {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);
  if (user.role !== "virtual_assistant" && user.role !== "admin" && user.role !== "manager") redirect(ROUTES.dashboard);

  const shifts = await getLiveShifts().catch(() => []);
  const chatterShifts = shifts.filter((s) => s.staff_role === "chatter");
  const vaShifts = shifts.filter((s) => s.staff_role === "virtual_assistant");

  const withModelNames = await Promise.all(
    shifts.map(async (s) => {
      const models = await getActiveShiftModels(s.id).catch(() => []);
      return { ...s, modelNames: models.map((m) => m.model_name).filter(Boolean) };
    })
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-white">Live shifts</h1>
        <p className="mt-1 text-sm text-white/60">All currently active and on-break shifts (chatter + virtual assistant).</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="glass-card overflow-hidden">
          <h2 className="border-b border-white/10 px-5 py-4 text-sm font-semibold uppercase tracking-wider text-white/70">
            Chatter shifts
          </h2>
          <ul className="divide-y divide-white/5">
            {chatterShifts.length === 0 ? (
              <li className="px-5 py-8 text-center text-sm text-white/50">No live chatter shifts</li>
            ) : (
              withModelNames
                .filter((s) => s.staff_role === "chatter")
                .map((s) => (
                  <li key={s.id} className="px-5 py-4">
                    <p className="font-medium text-white/95">{s.chatter_name || "—"}</p>
                    <p className="mt-0.5 text-xs text-white/50">
                      Started {s.start_time ? formatDateTimeEuropean(s.start_time) : "—"}
                    </p>
                    <p className="mt-1 text-xs text-white/60">
                      Models: {s.modelNames.length > 0 ? s.modelNames.join(", ") : s.models_count ?? 0}
                    </p>
                    <span
                      className={`mt-2 inline-block rounded-full border px-2 py-0.5 text-xs ${
                        s.status === "on_break"
                          ? "border-amber-500/30 bg-amber-500/20 text-amber-300"
                          : "border-emerald-500/30 bg-emerald-500/20 text-emerald-300"
                      }`}
                    >
                      {s.status === "on_break" ? "On break" : "Running"}
                    </span>
                  </li>
                ))
            )}
          </ul>
        </div>
        <div className="glass-card overflow-hidden">
          <h2 className="border-b border-white/10 px-5 py-4 text-sm font-semibold uppercase tracking-wider text-white/70">
            Virtual assistant shifts
          </h2>
          <ul className="divide-y divide-white/5">
            {vaShifts.length === 0 ? (
              <li className="px-5 py-8 text-center text-sm text-white/50">No live VA mistake shifts</li>
            ) : (
              withModelNames
                .filter((s) => s.staff_role === "virtual_assistant")
                .map((s) => (
                  <li key={s.id} className="px-5 py-4">
                    <p className="font-medium text-white/95">{s.chatter_name || "—"}</p>
                    <p className="mt-0.5 text-xs text-white/50">
                      Started {s.start_time ? formatDateTimeEuropean(s.start_time) : "—"}
                    </p>
                    <p className="mt-1 text-xs text-white/60">
                      Models: {s.modelNames.length > 0 ? s.modelNames.join(", ") : s.models_count ?? 0}
                    </p>
                    <span
                      className={`mt-2 inline-block rounded-full border px-2 py-0.5 text-xs ${
                        s.status === "on_break"
                          ? "border-amber-500/30 bg-amber-500/20 text-amber-300"
                          : "border-emerald-500/30 bg-emerald-500/20 text-emerald-300"
                      }`}
                    >
                      {s.status === "on_break" ? "On break" : "Running"}
                    </span>
                  </li>
                ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
