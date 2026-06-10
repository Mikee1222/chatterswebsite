import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { getAllSopDepartmentsAdmin, getAllSopRolesAdmin } from "@/services/sops";
import { AdminSopLibraryClient } from "@/components/admin-sop-library-client";

export default async function AdminSopLibraryPage() {
  const session = await requireAdminRoute(await getSessionFromCookies(), PERMISSIONS.SOPS_MANAGE);

  const [departments, roles] = await Promise.all([
    getAllSopDepartmentsAdmin().catch(() => []),
    getAllSopRolesAdmin().catch(() => []),
  ]);

  return <AdminSopLibraryClient initialDepartments={departments} initialRoles={roles} />;
}
