import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { listCustomRequestsPaginated } from "@/services/custom-requests";
import { AdminCustomRequestsClient } from "@/components/admin-custom-requests-client";
import type { CustomRequest } from "@/types";

export default async function AdminCustomRequestsPage() {
  const user = await requireAdminRoute(await getSessionFromCookies(), PERMISSIONS.CUSTOM_REQUESTS_VIEW);

  const first = await listCustomRequestsPaginated({}, 1, 50, null).catch(() => ({
    records: [] as CustomRequest[],
    nextOffset: null as string | null,
    hasMore: false,
    total: 0,
  }));

  return (
    <AdminCustomRequestsClient
      initialRequests={first.records}
      initialNextOffset={first.nextOffset}
      initialHasMore={first.hasMore}
    />
  );
}
