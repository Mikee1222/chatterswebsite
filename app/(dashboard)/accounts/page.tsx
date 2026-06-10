import { getSessionFromCookies } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/routes";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string; section?: string }>;
}) {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);
  if (!(await hasPermission(user, PERMISSIONS.ACCOUNTS_VIEW))) redirect(ROUTES.dashboard);

  const params = await searchParams;
  const q = new URLSearchParams();
  if (params.success) q.set("success", params.success);
  if (params.error) q.set("error", params.error);
  if (params.section) q.set("section", params.section);
  redirect(`${ROUTES.admin.accounts}${q.toString() ? `?${q.toString()}` : ""}`);
}
