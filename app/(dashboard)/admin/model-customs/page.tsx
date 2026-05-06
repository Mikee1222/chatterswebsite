import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";

/** Admin customs hub lives at /admin/customs; keep this URL for nav and bookmarks. */
export default async function AdminModelCustomsRedirectPage() {
  const user = await getSessionFromCookies();
  if (!user || (user.role !== "admin" && user.role !== "manager")) redirect(ROUTES.dashboard);

  redirect(ROUTES.admin.customs);
}
