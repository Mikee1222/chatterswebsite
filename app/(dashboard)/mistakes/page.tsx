import { Suspense } from "react";
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
      <Suspense
        fallback={
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-16 text-center text-sm text-white/45">
            Loading mistakes…
          </div>
        }
      >
        <ChatterMistakesClient initialMistakes={mistakes} />
      </Suspense>
    </div>
  );
}
