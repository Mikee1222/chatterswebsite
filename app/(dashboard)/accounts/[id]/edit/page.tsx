import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getUserByAirtableId, listAllUsers } from "@/services/users";
import { redirect, notFound } from "next/navigation";
import { EditAccountForm } from "@/components/edit-account-form";
import { listAllModelss } from "@/services/modelss";
import { getVaReviewHistory } from "@/services/marketing-reviews";
import { getRoles } from "@/services/roles";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import Link from "next/link";

export default async function EditAccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionFromCookies();
  if (!user || !(await hasPermission(user, PERMISSIONS.ACCOUNTS_EDIT))) redirect(ROUTES.dashboard);

  const { id } = await params;
  const record = await getUserByAirtableId(id);
  if (!record) notFound();
  const [allModels, allUsers, roles, canDelete] = await Promise.all([
    listAllModelss(),
    listAllUsers(),
    getRoles(),
    hasPermission(user, PERMISSIONS.ACCOUNTS_DELETE),
  ]);
  const linkedModelIds = new Set(
    allUsers
      .filter((u) => u.role === "model")
      .map((u) => u.linked_model_id)
      .filter((mid): mid is string => Boolean(mid?.trim()))
  );
  const modelOptions = allModels
    .map((m) => ({
      id: m.id,
      model_name: m.model_name,
      alreadyLinked: linkedModelIds.has(m.id),
    }))
    .sort((a, b) => a.model_name.localeCompare(b.model_name));

  const isMarketingVa =
    (record.role === "virtual_assistant" || record.secondary_role === "virtual_assistant") &&
    (record.va_type === "marketing" || record.va_type === "both");

  const reviewHistory = isMarketingVa ? await getVaReviewHistory(record.id).catch(() => null) : null;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={ROUTES.admin.accounts}
          className="text-sm text-white/50 transition hover:text-pink-300"
        >
          ← Back to accounts
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white">Edit user</h1>
        <p className="mt-1 text-sm text-white/55">
          {record.full_name} · {record.email}
        </p>
      </div>
      <EditAccountForm
        user={record}
        roles={roles}
        modelOptions={modelOptions}
        canDelete={canDelete}
        reviewHistory={reviewHistory}
      />
    </div>
  );
}
