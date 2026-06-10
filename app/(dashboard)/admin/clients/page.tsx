import { getSessionFromCookies } from "@/lib/auth";
import { requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";
import { getCachedListAllClients } from "@/services/client-portal";
import { AdminClientsClient } from "@/components/admin-clients-client";

export const revalidate = 30;

export default async function AdminClientsPage() {
  const user = await requireAdminRoute(await getSessionFromCookies(), PERMISSIONS.CLIENTS_VIEW);

  const clients = await getCachedListAllClients(false);

  return <AdminClientsClient clients={clients} />;
}
