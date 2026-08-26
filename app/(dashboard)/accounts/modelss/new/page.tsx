import Link from "next/link";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";

export default async function NewModelPage() {
  const user = await getSessionFromCookies();
  if (!user || !(await hasPermission(user, PERMISSIONS.ACCOUNTS_CREATE))) redirect(ROUTES.dashboard);

  // Prefer the full onboarding wizard
  redirect(ROUTES.accountsModelssOnboarding);
}
