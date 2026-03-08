import { redirect, notFound } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getWhaleById } from "@/services/whales";
import { EditWhaleForm } from "@/components/edit-whale-form";

export default async function EditWhalePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionFromCookies();
  if (!user || user.role !== "chatter") redirect(ROUTES.dashboard);

  const { id } = await params;
  const whale = await getWhaleById(id);
  if (!whale || whale.assigned_chatter_id !== (user.airtableUserId ?? user.id)) notFound();

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-xl font-semibold text-white">Edit whale</h1>
      <div className="glass-card p-6">
        <EditWhaleForm whale={whale} />
      </div>
    </div>
  );
}
