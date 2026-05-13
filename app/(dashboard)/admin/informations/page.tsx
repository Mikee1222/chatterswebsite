import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getAllMassListsAdmin } from "@/services/mass-lists";
import { AdminInformationsClient } from "@/components/admin-informations-client";

export default async function AdminInformationsPage() {
  const session = await getSessionFromCookies();
  if (!session || (session.role !== "admin" && session.role !== "manager")) {
    redirect(ROUTES.admin.home);
  }

  const lists = await getAllMassListsAdmin().catch(() => []);

  return (
    <div className="relative min-h-full w-full">
      <AdminInformationsClient lists={lists} />
    </div>
  );
}
