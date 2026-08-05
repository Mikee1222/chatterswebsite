import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { ROUTES } from "@/lib/routes";
import { vaTypeAccessApiGuardForNavHref } from "@/lib/va-type-access";
import { isAllowedDirectUploadToken } from "@/lib/direct-storage-upload";
import { readAssignmentFilesFromFormData } from "@/lib/va-content-assignment-files";
import {
  appendVAContentAssignmentFileUrls,
  createVaContentAssignmentAdmin,
  uploadVAContentAssignmentAttachments,
} from "@/services/va-content-assignments";
import { getUserByAirtableId } from "@/services/users";
import { getModelById } from "@/services/modelss";
import { notifyAdmins } from "@/services/notification-service";
import { NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";

const formSchema = z.object({
  model_record_id: z.string().trim().min(1),
  title: z.string().trim().min(1).max(500),
  description: z.string().trim().max(20000),
  content_type: z.string().trim().max(80),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  deadline: z.string().trim().max(80).optional().nullable(),
  file_url: z.string().trim().max(2000).optional().nullable(),
});

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "content:manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const blocked = await vaTypeAccessApiGuardForNavHref(session, ROUTES.va.contentAssignments);
  if (blocked) return blocked;
  const vaUserRecordId = (session.airtableUserId ?? session.id)?.trim();
  if (!vaUserRecordId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let fd: FormData;
  try {
    fd = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const raw = {
    model_record_id: String(fd.get("model_record_id") ?? ""),
    title: String(fd.get("title") ?? ""),
    description: String(fd.get("description") ?? ""),
    content_type: String(fd.get("content_type") ?? "Other"),
    priority: String(fd.get("priority") ?? "normal"),
    deadline: fd.get("deadline") != null && String(fd.get("deadline")).trim() !== "" ? String(fd.get("deadline")) : null,
    file_url: fd.get("file_url") != null && String(fd.get("file_url")).trim() !== "" ? String(fd.get("file_url")) : null,
  };
  const parsed = formSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((e) => e.message).join(" ") }, { status: 400 });
  }

  const directFileUrls: string[] = [];
  const fileUrlsJson = String(fd.get("file_urls") ?? "").trim();
  if (fileUrlsJson) {
    try {
      const parsedUrls = JSON.parse(fileUrlsJson) as unknown;
      if (Array.isArray(parsedUrls)) {
        for (const u of parsedUrls) {
          const s = String(u ?? "").trim();
          if (s) directFileUrls.push(s);
        }
      }
    } catch {
      return NextResponse.json({ error: "Invalid file_urls JSON" }, { status: 400 });
    }
  }
  for (const entry of fd.getAll("file_url")) {
    const s = String(entry ?? "").trim();
    if (s) directFileUrls.push(s);
  }
  const uniqueSbTokens = [...new Set(directFileUrls.filter((u) => u.startsWith("sb://")))];
  for (const token of uniqueSbTokens) {
    if (!isAllowedDirectUploadToken(token, "va-content-assignment")) {
      return NextResponse.json({ error: "Invalid file reference" }, { status: 400 });
    }
  }
  const legacyHttpsFileUrl =
    uniqueSbTokens.length === 0 && parsed.data.file_url?.startsWith("https://")
      ? parsed.data.file_url
      : null;

  const files = await readAssignmentFilesFromFormData(fd);
  const hasLocalFiles = files.length > 0;
  const hasDirectTokens = uniqueSbTokens.length > 0;

  try {
    const row = await createVaContentAssignmentAdmin({
      va_user_record_id: vaUserRecordId,
      model_record_id: parsed.data.model_record_id,
      title: parsed.data.title,
      description: parsed.data.description,
      content_type: parsed.data.content_type,
      priority: parsed.data.priority,
      deadline: parsed.data.deadline ?? null,
      file_url: hasLocalFiles || hasDirectTokens ? null : legacyHttpsFileUrl,
    });

    if (hasDirectTokens) {
      const append = await appendVAContentAssignmentFileUrls(row.id, uniqueSbTokens);
      if (append.error) {
        return NextResponse.json(
          {
            error: `Assignment saved but file link failed: ${append.error}`,
            id: row.id,
          },
          { status: 502 }
        );
      }
    } else if (hasLocalFiles) {
      const upload = await uploadVAContentAssignmentAttachments(row.id, files);
      if (upload.error) {
        return NextResponse.json(
          {
            error: `Assignment saved but file upload failed: ${upload.error}. Try a public file URL or re-upload in Airtable.`,
            id: row.id,
          },
          { status: 502 }
        );
      }
    }

    const [modelRec, vaProfile] = await Promise.all([
      getModelById(parsed.data.model_record_id).catch(() => null),
      getUserByAirtableId(vaUserRecordId).catch(() => null),
    ]);
    const modelName = (modelRec?.model_name ?? "").trim() || "the model";
    const vaName =
      (vaProfile?.full_name ?? "").trim() ||
      (vaProfile?.email ?? "").trim() ||
      "A VA";

    await notifyAdmins({
      event_type: NOTIFICATION_EVENT.SYSTEM_ALERT,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      title: "📋 New VA assignment needs review",
      body: `${vaName} created an assignment for ${modelName}: "${parsed.data.title.trim()}". Needs your approval.`,
      entity_type: "va_content_assignment",
      entity_id: row.id,
      _triggerSource: "va_content_create_admin_queue",
    }).catch(() => {});

    revalidatePath(ROUTES.va.contentAssignments);
    revalidatePath(ROUTES.admin.vaContentAssignments);
    revalidatePath(ROUTES.model.contentCalendar);
    revalidatePath(ROUTES.model.contentAssignments);

    return NextResponse.json({ success: true, id: row.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg || "Create failed" }, { status: 500 });
  }
}
