import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { listActiveGunzoTeamModelss } from "@/services/modelss";
import { listActiveUsers } from "@/services/users";
import { listActiveAssignments, CREATOR_ASSIGNED_ROLES } from "@/services/creator-assignments";
import { listBunchesAwaitingQa, listIdeasForBunch, type ResearchBunch } from "@/services/research-bunches";
import { listActiveContentItems } from "@/services/content-items";
import { listWinnerLibrary } from "@/services/winner-recreates";
import { getPipelineAnalytics, humanDuration } from "@/services/pipeline-analytics";
import { PipelineAdminTabs } from "@/components/pipeline-admin-tabs";
import { PipelineQaClient } from "@/components/pipeline-qa-client";
import { ManosBunchForm } from "@/components/manos-bunch-form";
import { PipelineAssignmentsClient } from "@/components/pipeline-assignments-client";
import { WinnerLibraryClient } from "@/components/winner-library-client";

const STAGE_LABEL: Record<string, string> = { creative: "Creative", filming: "Filming", icloud_raw: "iCloud/RAW", editing: "Editing", icloud_edited: "iCloud (edited)", post: "Post" };

export default async function PipelineAdminPage({ searchParams }: { searchParams?: { tab?: string } }) {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);
  if (!(await hasPermission(user, PERMISSIONS.CONTENT_PIPELINE_QA))) redirect(ROUTES.dashboard);
  const tab = searchParams?.tab ?? "kpis";
  const card = "rounded-2xl border border-white/10 bg-white/5 p-5";

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6">
      <h1 className="text-[26px] font-semibold tracking-tight text-white">Content Pipeline · Admin</h1>
      <div className="mt-4"><PipelineAdminTabs current={tab} /></div>

      {tab === "kpis" && <KpisTab card={card} />}
      {tab === "qa" && <QaTab />}
      {tab === "assignments" && <AssignmentsTab />}
      {tab === "winners" && <WinnersTab />}
    </div>
  );
}

async function KpisTab({ card }: { card: string }) {
  const a = await getPipelineAnalytics();
  const kpi = "rounded-2xl border border-white/10 bg-white/5 px-5 py-4";
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <div className={kpi}><p className="text-2xl font-semibold text-white">{a.totals.itemsInFlight}</p><p className="text-xs text-white/45">σε εξέλιξη</p></div>
        <div className={kpi}><p className="text-2xl font-semibold text-white">{a.totals.itemsDone}</p><p className="text-xs text-white/45">ολοκληρωμένα</p></div>
        <div className={kpi}><p className="text-2xl font-semibold text-amber-200">{a.totals.blocked}</p><p className="text-xs text-white/45">blocked</p></div>
      </div>
      <div className={card}>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/50">Χρόνος ανά στάδιο</h2>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-white/10 text-left text-white/50"><th className="py-2 pr-4 font-medium">Στάδιο</th><th className="py-2 pr-4 font-medium">Μέσος χρόνος</th><th className="py-2 pr-4 font-medium">Ολοκληρωμένα</th><th className="py-2 font-medium">Τώρα εδώ</th></tr></thead>
          <tbody>{a.stages.map((s) => (<tr key={s.stage} className="border-b border-white/5 last:border-0"><td className="py-2 pr-4 text-white/90">{STAGE_LABEL[s.stage] ?? s.stage}</td><td className="py-2 pr-4 text-white/70">{humanDuration(s.avgSeconds)}</td><td className="py-2 pr-4 text-white/70">{s.completed}</td><td className="py-2 text-white/70">{s.current}</td></tr>))}</tbody>
        </table>
      </div>
      <div className={card}>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/50">Παραγωγικότητα ανά άτομο</h2>
        {a.people.length === 0 ? <p className="text-sm text-white/40">—</p> : <ul className="space-y-1.5">{a.people.map((p) => (<li key={p.name} className="flex justify-between gap-3 text-sm"><span className="text-white/80">{p.name}</span><span className="text-white/50">{p.completed} steps · μέσος {humanDuration(p.avgSeconds)} · σύνολο {humanDuration(p.totalSeconds)}</span></li>))}</ul>}
      </div>
    </div>
  );
}

async function QaTab() {
  async function withIdeas(bunches: ResearchBunch[]) {
    return Promise.all(bunches.map(async (b) => ({ bunch: b, ideas: await listIdeasForBunch(b.id) })));
  }
  const [bunchesRaw, items, creators] = await Promise.all([
    listBunchesAwaitingQa().catch(() => []),
    listActiveContentItems().catch(() => []),
    listActiveGunzoTeamModelss().catch(() => []),
  ]);
  const bunches = (await withIdeas(bunchesRaw)).map(({ bunch, ideas }) => ({ id: bunch.id, creator_name: bunch.creator_name, researcher_name: bunch.researcher_name, ideas: ideas.map((i) => ({ id: i.id, idea_text: i.idea_text, platform: i.platform, checked: i.checked })) }));
  const qaItems = items.map((it) => ({ id: it.id, title: it.title, creator_name: it.creator_name, stage: it.stage, status: it.status, assignee_name: it.assignee_name, film_type: it.film_type }));
  const creatorList = creators.filter((c) => c.model_id && c.model_name).map((c) => ({ model_id: c.model_id, model_name: c.model_name }));
  return (
    <div>
      <ManosBunchForm creators={creatorList} />
      <PipelineQaClient bunches={bunches} items={qaItems} />
    </div>
  );
}

async function AssignmentsTab() {
  const [creatorRecords, users, assignments] = await Promise.all([
    listActiveGunzoTeamModelss().catch(() => []),
    listActiveUsers().catch(() => []),
    listActiveAssignments().catch(() => []),
  ]);
  const creators = creatorRecords.filter((c) => c.model_id && c.model_name).map((c) => ({ model_id: c.model_id, model_name: c.model_name })).sort((a, b) => a.model_name.localeCompare(b.model_name));
  const usersByRole: Record<string, { user_id: string; full_name: string }[]> = {};
  for (const role of CREATOR_ASSIGNED_ROLES) {
    usersByRole[role] = users.filter((u) => (u.role ?? "").trim().toLowerCase() === role && u.id).map((u) => ({ user_id: u.id, full_name: u.full_name || u.user_id })).sort((a, b) => a.full_name.localeCompare(b.full_name));
  }
  const current: Record<string, string> = {};
  for (const a of assignments) if (a.user_id) current[`${a.role}__${a.creator_model_id}`] = a.user_id;
  return <PipelineAssignmentsClient creators={creators} roles={[...CREATOR_ASSIGNED_ROLES]} usersByRole={usersByRole} initialAssignments={current} />;
}

async function WinnersTab() {
  const entries = await listWinnerLibrary().catch(() => []);
  return <WinnerLibraryClient entries={entries} />;
}
