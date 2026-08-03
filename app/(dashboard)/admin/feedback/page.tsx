import { getSessionFromCookies } from "@/lib/auth";
import { requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { listAllFeedback } from "@/services/feedback";
import { AdminFeedbackClient, type AdminFeedbackRow } from "@/components/admin-feedback-client";

function mapFeedbackRow(r: Awaited<ReturnType<typeof listAllFeedback>>[number]): AdminFeedbackRow {
  return {
    id: r.id,
    feedback_id: r.feedback_id.trim(),
    user_id: r.user_id.trim(),
    user_name: r.user_name.trim() || "Unknown user",
    user_role: r.user_role.trim() || "chatter",
    type: r.type.trim() || "other",
    page: r.page.trim(),
    title: r.title.trim(),
    description: r.description.trim(),
    screenshots: r.screenshots.map((url) => ({ url })),
    status: r.status.trim() || "new",
    admin_notes: r.admin_notes.trim(),
    created_at: r.created_at?.trim() ?? "",
  };
}

export default async function AdminFeedbackPage() {
  await requireAdminRoute(await getSessionFromCookies(), PERMISSIONS.FEEDBACK_VIEW);

  const records = await listAllFeedback().catch(() => []);
  const rows = records
    .map(mapFeedbackRow)
    .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));

  return (
    <div className="w-full max-w-full px-4 py-6 md:px-6">
      <AdminFeedbackClient initialRows={rows} />
    </div>
  );
}
