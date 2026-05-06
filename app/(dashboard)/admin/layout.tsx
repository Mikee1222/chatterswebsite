import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { isVaReadableAdminSchedulePath } from "@/lib/va-schedule-overview-access";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);
  if (user.role === "admin" || user.role === "manager") {
    return <>{children}</>;
  }
  if (user.role === "virtual_assistant") {
    const pathname = (await headers()).get("x-pathname") ?? "";
    if (pathname !== "" && !isVaReadableAdminSchedulePath(pathname)) {
      redirect(ROUTES.dashboard);
    }
    return <>{children}</>;
  }
  redirect(ROUTES.dashboard);
}
