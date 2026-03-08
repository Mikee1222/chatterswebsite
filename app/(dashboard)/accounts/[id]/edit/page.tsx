import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getUserByAirtableId } from "@/services/users";
import { redirect, notFound } from "next/navigation";
import { EditAccountForm } from "@/components/edit-account-form";

export default async function EditAccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionFromCookies();
  if (user?.role !== "admin") redirect(ROUTES.dashboard);

  const { id } = await params;
  const record = await getUserByAirtableId(id);
  if (!record) notFound();

  return (
    <div className="max-w-md space-y-6">
      <h1 className="text-xl font-semibold text-white">Edit user</h1>
      <div className="glass-card p-6">
        <EditAccountForm user={record} />
      </div>
    </div>
  );
}
