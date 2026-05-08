import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { listAllRecords, type AirtableRecord } from "@/lib/airtable-server";
import { AdminFeedbackClient, type AdminFeedbackRow } from "@/components/admin-feedback-client";

type FeedbackFields = {
  feedback_id?: string;
  user_id?: string;
  user_name?: string;
  user_role?: string;
  type?: string;
  page?: string;
  title?: string;
  description?: string;
  screenshots?: Array<{ id?: string; url?: string; filename?: string }>;
  status?: string;
  admin_notes?: string;
  created_at?: string;
};

function mapFeedbackRow(rec: AirtableRecord<FeedbackFields>): AdminFeedbackRow {
  const f = rec.fields ?? {};
  return {
    id: rec.id,
    feedback_id: String(f.feedback_id ?? "").trim(),
    user_id: String(f.user_id ?? "").trim(),
    user_name: String(f.user_name ?? "").trim() || "Unknown user",
    user_role: String(f.user_role ?? "").trim() || "chatter",
    type: String(f.type ?? "").trim() || "other",
    page: String(f.page ?? "").trim(),
    title: String(f.title ?? "").trim(),
    description: String(f.description ?? "").trim(),
    screenshots: Array.isArray(f.screenshots)
      ? f.screenshots.map((s) => ({ id: s?.id, url: s?.url, filename: s?.filename }))
      : [],
    status: String(f.status ?? "").trim() || "new",
    admin_notes: String(f.admin_notes ?? "").trim(),
    created_at: String(f.created_at ?? "").trim(),
  };
}

export default async function AdminFeedbackPage() {
  const user = await getSessionFromCookies();
  if (!user || (user.role !== "admin" && user.role !== "manager")) {
    redirect(ROUTES.dashboard);
  }

  const records = await listAllRecords<FeedbackFields>("feedback", {
    sort: [{ field: "created_at", direction: "desc" }],
    _caller: "admin.feedback.page",
  }).catch(() => []);

  const rows = records.map((r) => mapFeedbackRow(r as AirtableRecord<FeedbackFields>));

  return (
    <div className="w-full max-w-full px-4 py-6 md:px-6">
      <AdminFeedbackClient initialRows={rows} />
    </div>
  );
}

