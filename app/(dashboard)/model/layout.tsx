export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/routes";
import { getModelContext } from "@/lib/model-context-server";
import { LanguageProvider } from "@/lib/language-provider";
import { ModelDashboardContextProvider } from "@/components/model-dashboard-context-provider";
import { ModelQuickActionsFab } from "@/components/model-quick-actions-modal";
import { ModelRouteLoadingSkeleton } from "@/components/model-route-feedback";
import { ModelRoutesPrefetcher } from "@/components/model-routes-prefetcher";
import { Suspense } from "react";

/** Model area: only users with role `model` may access `/model/*` (middleware + this layout). */
export default async function ModelLayout({ children }: { children: React.ReactNode }) {
  const { user, linkedModelId, modelRecord, language } = await getModelContext();
  if (!user) redirect(ROUTES.login);
  if (user.role !== "model") redirect(ROUTES.dashboard);

  return (
    <ModelDashboardContextProvider value={{ user, linkedModelId, modelRecord, language }}>
      <LanguageProvider initialLanguage={language}>
        <ModelRoutesPrefetcher />
        <ModelQuickActionsFab user={user} />
        <Suspense fallback={<ModelRouteLoadingSkeleton blocks={4} />}>{children}</Suspense>
      </LanguageProvider>
    </ModelDashboardContextProvider>
  );
}
