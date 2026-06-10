import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getUserByAirtableId } from "@/services/users";
import { redirect, notFound } from "next/navigation";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import Link from "next/link";

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
    <div className="space-y-6">
      <div className="text-center">
        <Link
          href={ROUTES.admin.accounts}
          className="text-sm text-white/50 transition hover:text-pink-300"
        >
          ← Back to accounts
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white">Reset password</h1>
        <p className="mt-1 text-sm text-white/55">Set a new password for this account.</p>
      </div>
      <ResetPasswordForm recordId={record.id} fullName={record.full_name} email={record.email} />
    </div>
  );
}
