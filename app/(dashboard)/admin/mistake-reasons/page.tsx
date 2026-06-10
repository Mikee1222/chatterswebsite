import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { getAllMistakeReasons } from "@/services/chatter-mistakes";
import { AdminMistakeReasonsClient } from "@/components/admin-mistake-reasons-client";

export default async function AdminMistakeReasonsPage() {
  await requireAdminRoute(await getSessionFromCookies(), {
    permission: PERMISSIONS.MISTAKES_REASONS_MANAGE,
    adminOnly: true,
  });

  const reasons = await getAllMistakeReasons().catch(() => []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <AdminMistakeReasonsClient initialReasons={reasons} />
    </div>
  );
}
