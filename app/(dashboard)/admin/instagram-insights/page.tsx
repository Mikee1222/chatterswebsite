import { Suspense } from "react";
import { getSessionFromCookies } from "@/lib/auth";
import { requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { AdminInstagramInsightsClient } from "@/components/admin-instagram-insights-client";

export default async function AdminInstagramInsightsPage() {
  await requireAdminRoute(await getSessionFromCookies(), PERMISSIONS.INSTAGRAM_INSIGHTS_VIEW);

  return (
    <div className="w-full max-w-full px-4 py-6 md:px-6">
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-white/[0.04]" />}>
        <AdminInstagramInsightsClient />
      </Suspense>
    </div>
  );
}
