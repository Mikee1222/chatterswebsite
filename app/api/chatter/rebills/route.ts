import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { createRecord } from "@/lib/airtable-server";
import { chatterScreenshotAttachments } from "@/lib/chatter-screenshot-upload";
import { notifyAdmins } from "@/services/notification-service";
import { NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";

function normalizeSubUsername(raw: string): string {
  let s = raw.trim();
  while (s.startsWith("@")) s = s.slice(1).trim();
  return s;
}

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "shifts:view"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const formData = await req.formData();
  const model_id = String(formData.get("model_id") ?? "").trim();
  const model_name = String(formData.get("model_name") ?? "").trim();
  const sub_username = normalizeSubUsername(String(formData.get("sub_username") ?? ""));
  const screenshot = formData.get("screenshot");

  if (!model_id || !sub_username) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const sub_type = "paid";

  const rebillId = `reb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  let attachments: { url: string; filename?: string }[] = [];
  if (screenshot instanceof File) {
    attachments = await chatterScreenshotAttachments(screenshot, "rebills", rebillId).catch((err) => {
      console.error("[chatter/rebills] screenshot upload failed", err);
      return [];
    });
  }

  const reporterName = session.fullName?.trim() || session.email;

  await createRecord("rebills", {
    rebill_id: rebillId,
    chatter_id: session.airtableUserId ?? session.id,
    chatter_name: reporterName,
    model_id,
    model_name: model_name || "",
    sub_username,
    sub_type,
    status: "pending",
    screenshot: attachments.length > 0 ? attachments : undefined,
    created_at: new Date().toISOString(),
  });

  await notifyAdmins({
    event_type: NOTIFICATION_EVENT.SYSTEM_ALERT,
    priority: NOTIFICATION_PRIORITY.NORMAL,
    title: "🔄 New Rebill Submitted",
    body: `🔄 ${reporterName} submitted a rebill for ${model_name || "a model"}`,
    entity_type: "rebill",
    entity_id: rebillId,
    actor_user_id: session.airtableUserId ?? session.id,
    actor_name: reporterName,
  }).catch(() => {});

  return NextResponse.json({ success: true, rebill_id: rebillId });
}
