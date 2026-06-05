import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getNavRoleForSession } from "@/lib/staff-session-role";

/** Logged-in: chatter → home, VA → va-home, admin/manager → admin, others → dashboard. Unauthenticated → login. */
export default async function Home() {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);
  const navRole = getNavRoleForSession(user);
  if (navRole === "chatter") redirect(ROUTES.chatter.home);
  if (navRole === "virtual_assistant") redirect(ROUTES.va.home);
  if (user.role === "admin" || user.role === "manager") redirect(ROUTES.admin.home);
  if (user.role === "client") redirect(ROUTES.client.home);
  redirect(ROUTES.dashboard);
}
