import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getAllSopDepartmentsAdmin, getAllSopRolesAdmin } from "@/services/sops";
import { AdminSopLibraryClient } from "@/components/admin-sop-library-client";

export default async function AdminSopLibraryPage() {
  const session = await getSessionFromCookies();
  if (!session || (session.role !== "admin" && session.role !== "manager")) {
    redirect(ROUTES.admin.home);
  }

  const [departments, roles] = await Promise.all([
    getAllSopDepartmentsAdmin().catch(() => []),
    getAllSopRolesAdmin().catch(() => []),
  ]);

  return <AdminSopLibraryClient initialDepartments={departments} initialRoles={roles} />;
}
