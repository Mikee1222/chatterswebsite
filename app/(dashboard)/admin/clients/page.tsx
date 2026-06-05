import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";
import { listAllClients } from "@/services/client-portal";
import { AdminClientsClient } from "@/components/admin-clients-client";

export default async function AdminClientsPage() {
  const user = await getSessionFromCookies();
  if (!user || (user.role !== "admin" && user.role !== "manager")) redirect(ROUTES.dashboard);

  const clients = await listAllClients();

  return <AdminClientsClient clients={clients} />;
}
