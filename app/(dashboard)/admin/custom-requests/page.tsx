import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { listCustomRequestsPaginated } from "@/services/custom-requests";
import { AdminCustomRequestsClient } from "@/components/admin-custom-requests-client";
import type { CustomRequest } from "@/types";

export default async function AdminCustomRequestsPage() {
  const user = await getSessionFromCookies();
  if (!user || (user.role !== "admin" && user.role !== "manager")) redirect(ROUTES.dashboard);

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
