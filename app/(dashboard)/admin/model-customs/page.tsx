import { getSessionFromCookies } from "@/lib/auth";
import { requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";

/** Admin customs hub lives at /admin/customs; keep this URL for nav and bookmarks. */
export default async function AdminModelCustomsRedirectPage() {
  const user = await requireAdminRoute(await getSessionFromCookies(), PERMISSIONS.CUSTOM_REQUESTS_VIEW);

  redirect(ROUTES.admin.customs);
}
