import { getSessionFromCookies } from "@/lib/auth";
import { requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";
import { AdminModelOpsPlaceholder } from "@/components/admin-model-ops-placeholder";

export default async function AdminModelAvailabilityPage() {
  const user = await requireAdminRoute(await getSessionFromCookies(), PERMISSIONS.MODELS_AVAILABILITY);

  return (
    <AdminModelOpsPlaceholder
      title="Model availability"
      description="Free vs taken status and availability tooling live in the admin weekly program (per-model grid). Use Models for roster context."
      links={[
        { href: ROUTES.admin.weeklyProgram, label: "Admin weekly program" },
        { href: ROUTES.admin.models, label: "Models" },
        { href: ROUTES.admin.liveShifts, label: "Live shifts" },
      ]}
    />
  );
}
