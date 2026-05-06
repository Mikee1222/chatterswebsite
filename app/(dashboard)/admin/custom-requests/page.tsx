import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { listAllCustomRequests } from "@/services/custom-requests";
import { AdminCustomRequestsClient } from "@/components/admin-custom-requests-client";
import type { CustomRequest } from "@/types";

export default async function AdminCustomRequestsPage() {
  const user = await getSessionFromCookies();
  if (!user || (user.role !== "admin" && user.role !== "manager")) redirect(ROUTES.dashboard);

  const requests = await listAllCustomRequests().catch(() => [] as CustomRequest[]);

  return <AdminCustomRequestsClient requests={requests} />;
}
