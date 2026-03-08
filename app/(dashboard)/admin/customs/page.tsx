import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";
import { listAllCustomRequests } from "@/services/custom-requests";
import { AdminCustomsClient } from "@/components/admin-customs-client";
import type { CustomRequest } from "@/types";

export default async function AdminCustomsPage() {
  const user = await getSessionFromCookies();
  if (!user || (user.role !== "admin" && user.role !== "manager")) redirect(ROUTES.dashboard);

  const requests = await listAllCustomRequests().catch(() => []);

  return <AdminCustomsClient requests={requests as CustomRequest[]} />;
}
