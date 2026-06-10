import { getSessionFromCookies } from "@/lib/auth";
import { requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";
import { listAllCustomRequests } from "@/services/custom-requests";
import { AdminCustomsClient } from "@/components/admin-customs-client";
import type { CustomRequest } from "@/types";

export default async function AdminCustomsPage() {
  const user = await requireAdminRoute(await getSessionFromCookies(), PERMISSIONS.CUSTOM_REQUESTS_VIEW);

  const requests = await listAllCustomRequests().catch(() => []);

  return <AdminCustomsClient requests={requests as CustomRequest[]} />;
}
