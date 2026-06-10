import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";

export default async function AdminAccountShortcutPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);
  if (!(await hasPermission(user, PERMISSIONS.ACCOUNTS_VIEW))) redirect(ROUTES.dashboard);
  const { id } = await params;
  if (!id?.trim()) redirect(ROUTES.admin.accounts);
  redirect(ROUTES.accountEdit(id.trim()));
}
