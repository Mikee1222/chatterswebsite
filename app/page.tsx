import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";

/** Logged-in: chatter → home, VA → va-home, admin/manager → admin, others → dashboard. Unauthenticated → login. */
export default async function Home() {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);
  if (user.role === "chatter") redirect(ROUTES.chatter.home);
  if (user.role === "virtual_assistant") redirect(ROUTES.va.home);
  if (user.role === "admin" || user.role === "manager") redirect(ROUTES.admin.home);
  redirect(ROUTES.dashboard);
}
