import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { getPipelineAnalytics, humanDuration } from "@/services/pipeline-analytics";

const STAGE_LABEL: Record<string, string> = {
  creative: "Creative",
  filming: "Filming",
  icloud_raw: "iCloud/RAW",
  editing: "Editing",
  icloud_edited: "iCloud (edited)",
  post: "Post",
};

export default async function PipelineAnalyticsPage() {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);
  if (!(await hasPermission(user, PERMISSIONS.CONTENT_PIPELINE_MANAGE))) redirect(ROUTES.dashboard);

  const a = await getPipelineAnalytics();

  const card = "rounded-2xl border border-white/10 bg-white/5 p-5";
  const kpi = "rounded-2xl border border-white/10 bg-white/5 px-5 py-4";

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 md:px-6">
      <h1 className="text-[26px] font-semibold tracking-tight text-white">Pipeline KPIs</h1>

      {/* Totals */}
      <div className="grid grid-cols-3 gap-3">
        <div className={kpi}><p className="text-2xl font-semibold text-white">{a.totals.itemsInFlight}</p><p className="text-xs text-white/45">σε εξέλιξη</p></div>
        <div className={kpi}><p className="text-2xl font-semibold text-white">{a.totals.itemsDone}</p><p className="text-xs text-white/45">ολοκληρωμένα</p></div>
        <div className={kpi}><p className="text-2xl font-semibold text-amber-200">{a.totals.blocked}</p><p className="text-xs text-white/45">blocked</p></div>
      </div>

      {/* Per-stage cycle time */}
      <div className={card}>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/50">Χρόνος ανά στάδιο</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/10 text-left text-white/50">
              <th className="py-2 pr-4 font-medium">Στάδιο</th>
              <th className="py-2 pr-4 font-medium">Μέσος χρόνος</th>
              <th className="py-2 pr-4 font-medium">Ολοκληρωμένα</th>
              <th className="py-2 font-medium">Τώρα εδώ</th>
            </tr></thead>
            <tbody>
              {a.stages.map((s) => (
                <tr key={s.stage} className="border-b border-white/5 last:border-0">
                  <td className="py-2 pr-4 text-white/90">{STAGE_LABEL[s.stage] ?? s.stage}</td>
                  <td className="py-2 pr-4 text-white/70">{humanDuration(s.avgSeconds)}</td>
                  <td className="py-2 pr-4 text-white/70">{s.completed}</td>
                  <td className="py-2 text-white/70">{s.current}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-person throughput (VA monetization proxy) */}
      <div className={card}>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/50">Παραγωγικότητα ανά άτομο</h2>
        {a.people.length === 0 ? (
          <p className="text-sm text-white/40">Καμία ολοκληρωμένη ενέργεια ακόμα.</p>
        ) : (
          <ul className="space-y-1.5">
            {a.people.map((p) => (
              <li key={p.name} className="flex justify-between text-sm">
                <span className="text-white/80">{p.name}</span>
                <span className="text-white/50">{p.completed} steps</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Per-bunch */}
      <div className={card}>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/50">Research bunches</h2>
        {a.bunches.length === 0 ? (
          <p className="text-sm text-white/40">Κανένα bunch ακόμα.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-white/10 text-left text-white/50">
                <th className="py-2 pr-4 font-medium">Creator</th>
                <th className="py-2 pr-4 font-medium">Εβδομάδα</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 font-medium">Χρόνος ως έγκριση</th>
              </tr></thead>
              <tbody>
                {a.bunches.map((b, i) => (
                  <tr key={i} className="border-b border-white/5 last:border-0">
                    <td className="py-2 pr-4 text-white/90">{b.creator_name}</td>
                    <td className="py-2 pr-4 text-white/70">{b.week}</td>
                    <td className="py-2 pr-4 text-white/70">{b.status}</td>
                    <td className="py-2 text-white/70">{b.durationSeconds != null ? humanDuration(b.durationSeconds) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
