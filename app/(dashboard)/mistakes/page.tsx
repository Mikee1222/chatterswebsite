import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { getMistakesByChatter } from "@/services/chatter-mistakes";
import { ChatterMistakesClient } from "@/components/chatter-mistakes-client";

export default async function ChatterMistakesPage() {
  const session = await getSessionFromCookies();
  if (!session) redirect(ROUTES.dashboard);
  if (!(await hasPermission(session, PERMISSIONS.MISTAKES_VIEW))) {
    redirect(ROUTES.dashboard);
  }

  const chatterId = (session.airtableUserId ?? session.id)?.trim();
  if (!chatterId) redirect(ROUTES.dashboard);

  const mistakes = await getMistakesByChatter(chatterId).catch(() => []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <ChatterMistakesClient initialMistakes={mistakes} />
    </div>
  );
}
