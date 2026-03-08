import { getSessionFromCookies } from "@/lib/auth";
import { listAllUsers } from "@/services/users";
import { listAllModelss } from "@/services/modelss";
import { redirect } from "next/navigation";
import { AccountsView } from "@/components/accounts-view";
import { ROUTES } from "@/lib/routes";

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string; section?: string }>;
}) {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);
  if (user.role === "admin" || user.role === "manager") {
    const params = await searchParams;
    const q = new URLSearchParams();
    if (params.success) q.set("success", params.success);
    if (params.error) q.set("error", params.error);
    if (params.section) q.set("section", params.section);
    redirect(`${ROUTES.admin.accounts}${q.toString() ? `?${q.toString()}` : ""}`);
  }
  redirect(ROUTES.dashboard);

  const [users, modelss, params] = await Promise.all([
    listAllUsers().catch(() => []),
    listAllModelss().catch(() => []),
    searchParams,
  ]);
  const { success, error } = params;

  return (
    <AccountsView
      users={users}
      modelss={modelss}
      success={success}
      error={error}
    />
  );
}
