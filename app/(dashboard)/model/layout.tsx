export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/routes";
import { getModelContext } from "@/lib/model-context-server";
import { StaticEnLanguageProvider } from "@/lib/language-provider";
import { ModelQuickActionsFab } from "@/components/model-quick-actions-modal";
import { ModelRouteLoadingSkeleton } from "@/components/model-route-feedback";
import { Suspense } from "react";

/** Model area: only users with role `model` may access `/model/*` (middleware + this layout). */
export default async function ModelLayout({ children }: { children: React.ReactNode }) {
  const { user } = await getModelContext();
  if (!user) redirect(ROUTES.login);
  if (user.role !== "model") redirect(ROUTES.dashboard);

  return (
    <StaticEnLanguageProvider>
      <ModelQuickActionsFab user={user} />
      <Suspense fallback={<ModelRouteLoadingSkeleton blocks={4} />}>{children}</Suspense>
    </StaticEnLanguageProvider>
  );
}
