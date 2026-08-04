import { getSessionFromCookies } from "@/lib/auth";
import { requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { listCustomRequestsPaginated } from "@/services/custom-requests";
import { getCachedModelss } from "@/lib/modelss-cache";
import { listAllUsers } from "@/services/users";
import { AdminCustomRequestsClient } from "@/components/admin-custom-requests-client";
import type { CustomRequest } from "@/types";

export default async function AdminCustomRequestsPage() {
  await requireAdminRoute(await getSessionFromCookies(), PERMISSIONS.CUSTOM_REQUESTS_VIEW);

  const [first, models, users] = await Promise.all([
    listCustomRequestsPaginated({}, 1, 50, null).catch(() => ({
      records: [] as CustomRequest[],
      nextOffset: null as string | null,
      hasMore: false,
      total: 0,
    })),
    getCachedModelss().catch(() => []),
    listAllUsers().catch(() => []),
  ]);

  const modelById: Record<string, string> = Object.fromEntries(
    models.map((m) => [m.id, (m.model_name ?? "").trim() || "Model"])
  );

  const chatterById: Record<string, string> = Object.fromEntries(
    users
      .filter((u) => u.role === "chatter")
      .map((u) => [u.id, (u.full_name ?? "").trim() || u.email || "Chatter"])
  );

  return (
    <AdminCustomRequestsClient
      initialRequests={first.records}
      initialNextOffset={first.nextOffset}
      initialHasMore={first.hasMore}
      modelById={modelById}
      chatterById={chatterById}
    />
  );
}
