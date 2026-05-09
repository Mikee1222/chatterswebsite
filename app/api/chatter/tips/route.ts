import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
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
  if (!session || getEffectiveStaffRole(session) !== "chatter") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const model_id = String(formData.get("model_id") ?? "").trim();
  const model_name = String(formData.get("model_name") ?? "").trim();
  const sub_username = normalizeSubUsername(String(formData.get("sub_username") ?? ""));
  const amountRaw = formData.get("amount_usd");
  const screenshot = formData.get("screenshot");

  const amount_usd =
    typeof amountRaw === "string" ? Number.parseFloat(amountRaw) : Number(amountRaw ?? NaN);
  if (!model_id || !sub_username || !Number.isFinite(amount_usd) || amount_usd <= 0) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const tipId = `tip_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  let attachments: { url: string; filename?: string }[] = [];
  if (screenshot instanceof File) {
    attachments = await chatterScreenshotAttachments(screenshot, "tips", tipId).catch((err) => {
      console.error("[chatter/tips] screenshot upload failed", err);
      return [];
    });
  }

  const reporterName = session.fullName?.trim() || session.email;

  await createRecord("tips", {
    tip_id: tipId,
    chatter_id: session.airtableUserId ?? session.id,
    chatter_name: reporterName,
    model_id,
    model_name: model_name || "",
    sub_username,
    amount_usd,
    status: "pending",
    screenshot: attachments.length > 0 ? attachments : undefined,
    created_at: new Date().toISOString(),
  });

  await notifyAdmins({
    event_type: NOTIFICATION_EVENT.SYSTEM_ALERT,
    priority: NOTIFICATION_PRIORITY.NORMAL,
    title: "💰 New tip logged",
    body: `${reporterName} logged $${amount_usd.toFixed(2)} tip for ${model_name || "a model"} — @${sub_username}`,
    entity_type: "tip",
    entity_id: tipId,
    actor_user_id: session.airtableUserId ?? session.id,
    actor_name: reporterName,
  }).catch(() => {});

  return NextResponse.json({ success: true, tip_id: tipId });
}
