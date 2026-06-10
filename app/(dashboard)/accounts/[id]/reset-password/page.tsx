import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getUserByAirtableId } from "@/services/users";
import { redirect, notFound } from "next/navigation";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionFromCookies();
  if (!user || !(await hasPermission(user, PERMISSIONS.ACCOUNTS_RESET_PASSWORD))) redirect(ROUTES.dashboard);

  const { id } = await params;
  const record = await getUserByAirtableId(id);
  if (!record) notFound();

  return (
    <div className="max-w-md space-y-6">
      <h1 className="text-xl font-semibold text-white">Reset password</h1>
      <p className="text-sm text-white/60">
        Set a new password for {record.full_name} ({record.email}).
      </p>
      <div className="glass-card p-6">
        <ResetPasswordForm recordId={record.id} />
      </div>
    </div>
  );
}
