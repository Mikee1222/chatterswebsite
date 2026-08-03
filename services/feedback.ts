/**
 * Dual-backend product feedback (bug/suggestion submissions).
 */
import { isSupabaseBackend } from "@/lib/data-backend";
import { createRecord, listAllRecords, updateRecord, deleteRecord } from "@/lib/airtable-server";
import { publicId, sbDeleteByPublicId, sbInsert, sbSelectAll, sbUpdateByPublicId, type SbRow } from "@/lib/supabase-data";

const TABLE = "feedback";

export type FeedbackRecord = {
  id: string;
  feedback_id: string;
  user_id: string;
  user_name: string;
  user_role: string;
  type: string;
  page: string;
  title: string;
  description: string;
  status: string;
  screenshots: string[];
  admin_notes: string;
  created_at: string | null;
};

type FeedbackWrite = {
  feedback_id: string;
  user_id: string;
  user_name: string;
  user_role: string;
  type: string;
  page: string;
  title: string;
  description: string;
  status?: string;
  screenshots?: Array<{ url: string; filename?: string }> | string[];
  created_at?: string;
};

function shotUrls(
  shot: Array<{ url: string; filename?: string }> | string[] | undefined
): string[] {
  if (!shot?.length) return [];
  if (typeof shot[0] === "string") return (shot as string[]).filter(Boolean);
  return (shot as Array<{ url: string }>).map((a) => a.url).filter(Boolean);
}

export async function createFeedback(fields: FeedbackWrite): Promise<{ id: string }> {
  if (isSupabaseBackend()) {
    const row = await sbInsert<SbRow>(TABLE, {
      feedback_id: fields.feedback_id,
      user_id: fields.user_id,
      user_name: fields.user_name,
      user_role: fields.user_role,
      type: fields.type,
      page: fields.page,
      title: fields.title,
      description: fields.description,
      status: fields.status ?? "new",
      screenshots: shotUrls(fields.screenshots),
      created_at: fields.created_at ?? new Date().toISOString(),
    });
    return { id: publicId(row) };
  }
  const rec = await createRecord(TABLE, {
    ...fields,
    screenshots: fields.screenshots?.length ? fields.screenshots : undefined,
  });
  return { id: rec.id };
}

export async function listAllFeedback(): Promise<FeedbackRecord[]> {
  if (isSupabaseBackend()) {
    const rows = await sbSelectAll<
      SbRow & {
        feedback_id?: string | null;
        user_id?: string | null;
        user_name?: string | null;
        user_role?: string | null;
        type?: string | null;
        page?: string | null;
        title?: string | null;
        description?: string | null;
        status?: string | null;
        screenshots?: string[] | null;
        admin_notes?: string | null;
        created_at?: string | null;
      }
    >(TABLE);
    return rows.map((r) => ({
      id: publicId(r),
      feedback_id: r.feedback_id ?? "",
      user_id: r.user_id ?? "",
      user_name: r.user_name ?? "",
      user_role: r.user_role ?? "",
      type: r.type ?? "",
      page: r.page ?? "",
      title: r.title ?? "",
      description: r.description ?? "",
      status: r.status ?? "new",
      screenshots: r.screenshots ?? [],
      admin_notes: r.admin_notes ?? "",
      created_at: r.created_at ?? null,
    }));
  }
  const records = await listAllRecords<Record<string, unknown>>(TABLE);
  return records.map((r) => ({
    id: r.id,
    feedback_id: String(r.fields.feedback_id ?? ""),
    user_id: String(r.fields.user_id ?? ""),
    user_name: String(r.fields.user_name ?? ""),
    user_role: String(r.fields.user_role ?? ""),
    type: String(r.fields.type ?? ""),
    page: String(r.fields.page ?? ""),
    title: String(r.fields.title ?? ""),
    description: String(r.fields.description ?? ""),
    status: String(r.fields.status ?? "new"),
    screenshots: Array.isArray(r.fields.screenshots)
      ? (r.fields.screenshots as Array<{ url?: string } | string>)
          .map((a) => (typeof a === "string" ? a : String(a?.url ?? "")))
          .filter(Boolean)
      : [],
    admin_notes: String(r.fields.admin_notes ?? ""),
    created_at: typeof r.fields.created_at === "string" ? r.fields.created_at : null,
  }));
}

export async function updateFeedback(
  id: string,
  fields: Partial<{ status: string; admin_notes: string }>
): Promise<void> {
  if (isSupabaseBackend()) {
    await sbUpdateByPublicId(TABLE, id, { ...fields, updated_at: new Date().toISOString() });
    return;
  }
  await updateRecord(TABLE, id, fields);
}

export async function deleteFeedback(id: string): Promise<void> {
  if (isSupabaseBackend()) {
    await sbDeleteByPublicId(TABLE, id);
    return;
  }
  await deleteRecord(TABLE, id);
}
