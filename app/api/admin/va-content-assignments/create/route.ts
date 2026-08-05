import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { isAllowedDirectUploadToken } from "@/lib/direct-storage-upload";
import { readAssignmentFilesFromFormData } from "@/lib/va-content-assignment-files";
import {
  appendVAContentAssignmentFileUrls,
  createVaContentAssignmentAdmin,
  uploadVAContentAssignmentAttachments,
} from "@/services/va-content-assignments";
import { getUserByAirtableId } from "@/services/users";
import { getModelById } from "@/services/modelss";
import { notifyByRoleConfig } from "@/services/notification-service";
import { NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";

const formSchema = z.object({
  va_user_record_id: z.string().trim().min(1),
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
  if (!(await hasPermission(session, PERMISSIONS.CONTENT_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let fd: FormData;
  try {
    fd = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const raw = {
    va_user_record_id: String(fd.get("va_user_record_id") ?? ""),
    model_record_id: String(fd.get("model_record_id") ?? ""),
    title: String(fd.get("title") ?? ""),
    description: String(fd.get("description") ?? ""),
    content_type: String(fd.get("content_type") ?? "Other"),
    priority: String(fd.get("priority") ?? "normal"),
    deadline:
      fd.get("deadline") != null && String(fd.get("deadline")).trim() !== ""
        ? String(fd.get("deadline"))
        : null,
    file_url:
      fd.get("file_url") != null && String(fd.get("file_url")).trim() !== ""
        ? String(fd.get("file_url"))
        : null,
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
      va_user_record_id: parsed.data.va_user_record_id,
      model_record_id: parsed.data.model_record_id,
      title: parsed.data.title,
      description: parsed.data.description,
      content_type: parsed.data.content_type,
      priority: parsed.data.priority,
      deadline: parsed.data.deadline ?? null,
      file_url: hasLocalFiles || hasDirectTokens ? null : legacyHttpsFileUrl,
      direct_assign: true,
    });

    if (hasDirectTokens) {
      const append = await appendVAContentAssignmentFileUrls(row.id, uniqueSbTokens);
      if (append.error) {
        return NextResponse.json(
          {
            error: `Assignment created but file link failed: ${append.error}`,
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
            error: `Assignment created but file upload failed: ${upload.error}`,
            id: row.id,
          },
          { status: 502 }
        );
      }
    }

    const displayTitle = parsed.data.title.trim() || "VA content assignment";
    await notifyByRoleConfig(NOTIFICATION_EVENT.VA_CONTENT_ASSIGNED, {
      personal_user_id: parsed.data.va_user_record_id,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      title: "📋 New VA content assignment",
      body: `${displayTitle} — assigned by admin. Open Content assignments or your calendar.`,
      entity_type: "va_content_assignment",
      entity_id: row.id,
    }).catch(() => {});

    const [modelRec, vaProfile] = await Promise.all([
      getModelById(parsed.data.model_record_id).catch(() => null),
      getUserByAirtableId(parsed.data.va_user_record_id).catch(() => null),
    ]);
    void modelRec;
    void vaProfile;

    revalidatePath(ROUTES.admin.vaContentAssignments);
    revalidatePath(ROUTES.va.contentAssignments);
    revalidatePath(ROUTES.model.contentCalendar);
    revalidatePath(ROUTES.model.contentAssignments);

    return NextResponse.json({ success: true, id: row.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg || "Create failed" }, { status: 500 });
  }
}
