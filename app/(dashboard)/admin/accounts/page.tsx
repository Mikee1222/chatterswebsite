import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { listAllUsers } from "@/services/users";
import { listAllModelss } from "@/services/modelss";
import { redirect } from "next/navigation";
import { AccountsView } from "@/components/accounts-view";

export default async function AdminAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string; section?: string }>;
}) {
  const user = await getSessionFromCookies();
  if (!user || (user.role !== "admin" && user.role !== "manager")) redirect(ROUTES.dashboard);

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
