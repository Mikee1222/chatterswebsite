import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { ROUTES } from "@/lib/routes";
import { vaTypeAccessApiGuardForNavHref } from "@/lib/va-type-access";
import { uploadAirtableAttachment } from "@/lib/airtable-upload-attachment";
import { notifyByRoleConfig } from "@/services/notification-service";
import { NOTIFICATION_ENTITY, NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import {
  createMistakeRow,
  getActiveMistakeReasonByReasonId,
  getMistakesByVA,
} from "@/services/chatter-mistakes";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "mistakes:view"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const blocked = await vaTypeAccessApiGuardForNavHref(session, ROUTES.va.mistakes);
  if (blocked) return blocked;
  const vaId = (session.airtableUserId ?? session.id)?.trim();
  if (!vaId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const mistakes = await getMistakesByVA(vaId);
    return NextResponse.json({ mistakes });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

const postSchema = z.object({
  chatter_id: z.string().trim().min(1),
  chatter_name: z.string().trim().min(1),
  model_id: z.string().trim().min(1),
  model_name: z.string().trim().min(1),
  sub_username: z.string().trim().max(500),
  mistake_date: z.string().trim().min(1),
  reason_id: z.string().trim().min(1),
  explanation: z.string().trim().min(1).max(20000),
});

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "mistakes:view"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const blocked = await vaTypeAccessApiGuardForNavHref(session, ROUTES.va.mistakes);
  if (blocked) return blocked;
  const vaId = (session.airtableUserId ?? session.id)?.trim();
  if (!vaId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let fd: FormData;
  try {
    fd = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const raw = {
    chatter_id: String(fd.get("chatter_id") ?? ""),
    chatter_name: String(fd.get("chatter_name") ?? ""),
    model_id: String(fd.get("model_id") ?? ""),
    model_name: String(fd.get("model_name") ?? ""),
    sub_username: String(fd.get("sub_username") ?? ""),
    mistake_date: String(fd.get("mistake_date") ?? ""),
    reason_id: String(fd.get("reason_id") ?? ""),
    explanation: String(fd.get("explanation") ?? ""),
  };
  const parsed = postSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const reason = await getActiveMistakeReasonByReasonId(parsed.data.reason_id);
  if (!reason) {
    return NextResponse.json({ error: "Invalid or inactive reason_id" }, { status: 400 });
  }

  const mistakeDateMs = new Date(parsed.data.mistake_date).getTime();
  if (!Number.isFinite(mistakeDateMs)) {
    return NextResponse.json({ error: "mistake_date must be a valid ISO datetime" }, { status: 400 });
  }

  const fileEntry = fd.get("screenshot");
  let fileBytes: { name: string; type: string; data: Uint8Array } | null = null;
  if (fileEntry instanceof File && fileEntry.size > 0) {
    fileBytes = {
      name: fileEntry.name || "screenshot",
      type: fileEntry.type || "image/png",
      data: new Uint8Array(await fileEntry.arrayBuffer()),
    };
  }

  const vaName = (session.fullName ?? session.email ?? "VA").trim() || "VA";

  try {
    const { id: recordId, mistake_id } = await createMistakeRow({
      va_id: vaId,
      va_name: vaName,
      chatter_id: parsed.data.chatter_id,
      chatter_name: parsed.data.chatter_name,
      model_id: parsed.data.model_id,
      model_name: parsed.data.model_name,
      sub_username: parsed.data.sub_username,
      mistake_date: new Date(parsed.data.mistake_date).toISOString(),
      reason_id: reason.reason_id,
      reason_label: reason.label,
      reason_category: reason.category,
      explanation: parsed.data.explanation,
    });

    if (fileBytes && fileBytes.data.byteLength > 0) {
      try {
        await uploadAirtableAttachment({
          recordId: recordId,
          fieldName: "screenshot",
          filename: fileBytes.name,
          contentType: fileBytes.type,
          bytes: fileBytes.data,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json(
          {
            error: `Mistake saved but screenshot upload failed: ${msg}`,
            success: true,
            mistake_id,
            id: recordId,
          },
          { status: 502 }
        );
      }
    }

    await notifyByRoleConfig(NOTIFICATION_EVENT.CHATTER_MISTAKE, {
      personal_user_id: vaId,
      priority: NOTIFICATION_PRIORITY.HIGH,
      title: "⚠️ Mistake report submitted",
      body: `⚠️ Your ${reason.category} mistake report for ${parsed.data.chatter_name} was submitted.`,
      entity_type: NOTIFICATION_ENTITY.CHATTER_MISTAKE,
      entity_id: recordId,
      actor_user_id: vaId,
      actor_name: vaName,
      context: {
        chatterName: parsed.data.chatter_name,
        mistakeType: reason.category,
        adminName: vaName,
      },
    }).catch(() => {});

    return NextResponse.json({ success: true, mistake_id, id: recordId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg || "Create failed" }, { status: 500 });
  }
}
