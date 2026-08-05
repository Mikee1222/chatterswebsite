import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { createRebill } from "@/services/rebills";
import { chatterScreenshotAttachments } from "@/lib/chatter-screenshot-upload";
import {
  attachmentFromSbToken,
  isAllowedDirectScreenshotToken,
} from "@/lib/direct-storage-upload";
import { notifyAdmins } from "@/services/notification-service";
import { NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import { readRequestFormData } from "@/lib/request-form-data";

function normalizeSubUsername(raw: string): string {
  let s = raw.trim();
  while (s.startsWith("@")) s = s.slice(1).trim();
  return s;
}

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "shifts:view"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const formDataOrErr = await readRequestFormData(req);
  if (formDataOrErr instanceof NextResponse) return formDataOrErr;
  const formData = formDataOrErr;
  const model_id = String(formData.get("model_id") ?? "").trim();
  const model_name = String(formData.get("model_name") ?? "").trim();
  const sub_username = normalizeSubUsername(String(formData.get("sub_username") ?? ""));
  const screenshotUrl = String(formData.get("screenshot_url") ?? "").trim();
  const screenshot = formData.get("screenshot");

  if (!model_id || !sub_username) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const sub_type = "paid";

  const rebillId = `reb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  let attachments: { url: string; filename?: string }[] = [];
  if (screenshotUrl) {
    if (!isAllowedDirectScreenshotToken(screenshotUrl, "rebills")) {
      return NextResponse.json({ error: "Invalid screenshot reference" }, { status: 400 });
    }
    attachments = [attachmentFromSbToken(screenshotUrl)];
  } else if (screenshot instanceof File && screenshot.size > 0) {
    try {
      attachments = await chatterScreenshotAttachments(screenshot, "rebills", rebillId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Screenshot upload failed";
      console.error("[chatter/rebills] screenshot upload failed", err);
      const clientError =
        msg.includes("under") || msg.includes("image") || msg.includes("Invalid");
      return NextResponse.json(
        { error: clientError ? msg : "Screenshot upload failed" },
        { status: clientError ? 400 : 502 }
      );
    }
  }

  const reporterName = session.fullName?.trim() || session.email;

  await createRebill({
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
    event_type: NOTIFICATION_EVENT.REBILL_SUBMITTED,
    priority: NOTIFICATION_PRIORITY.NORMAL,
    title: "🔄 New rebill submitted",
    body: `${reporterName} submitted a rebill for ${model_name || "a model"} — @${sub_username}. Review it in Rebills & Tips.`,
    entity_type: "rebill",
    entity_id: rebillId,
    actor_user_id: session.airtableUserId ?? session.id,
    actor_name: reporterName,
  }).catch(() => {});

  return NextResponse.json({ success: true, rebill_id: rebillId });
}
