import Link from "next/link";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getModelById } from "@/services/modelss";
import { redirect, notFound } from "next/navigation";
import { EditModelForm } from "@/components/edit-model-form";

export default async function EditModelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionFromCookies();
  if (user?.role !== "admin") redirect(ROUTES.dashboard);

  const { id } = await params;
  const model = await getModelById(id);
  if (!model) notFound();

  return (
    <div className="max-w-md space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={ROUTES.accountsModelss}
          className="text-sm text-white/60 hover:text-white"
        >
          ← Accounts
        </Link>
      </div>
      <h1 className="text-xl font-semibold text-white">Edit model</h1>
      <div className="glass-card p-6">
        <EditModelForm model={model} />
      </div>
    </div>
  );
}
