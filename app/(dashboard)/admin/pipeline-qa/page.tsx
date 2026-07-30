import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { listActiveContentItems } from "@/services/content-items";
import { listBunchesAwaitingQa, listIdeasForBunch } from "@/services/research-bunches";
import { PipelineQaClient, type QaItem, type QaBunch } from "@/components/pipeline-qa-client";

/** Manos' QA cockpit: everything waiting for QA + live progress of every band. */
export default async function PipelineQaPage() {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);
  if (!(await hasPermission(user, PERMISSIONS.CONTENT_PIPELINE_QA))) redirect(ROUTES.dashboard);

  const [bunchesRaw, items] = await Promise.all([
    listBunchesAwaitingQa().catch(() => []),
    listActiveContentItems().catch(() => []),
  ]);

  const bunches: QaBunch[] = await Promise.all(
    bunchesRaw.map(async (b) => ({
      id: b.id,
      creator_name: b.creator_name,
      researcher_name: b.researcher_name,
      ideas: (await listIdeasForBunch(b.id)).map((i) => ({ id: i.id, idea_text: i.idea_text, platform: i.platform, checked: i.checked })),
    }))
  );

  const qaItems: QaItem[] = items.map((it) => ({
    id: it.id,
    title: it.title,
    creator_name: it.creator_name,
    stage: it.stage,
    status: it.status,
    assignee_name: it.assignee_name,
    film_type: it.film_type,
  }));

  return (
    <div className="w-full max-w-full px-4 py-6 md:px-6">
      <PipelineQaClient bunches={bunches} items={qaItems} />
    </div>
  );
}
