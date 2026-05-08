import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";

export default async function AdminAccountShortcutPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);
  if (user.role !== "admin" && user.role !== "manager") redirect(ROUTES.dashboard);
  const { id } = await params;
  if (!id?.trim()) redirect(ROUTES.admin.accounts);
  redirect(ROUTES.accountEdit(id.trim()));
}
