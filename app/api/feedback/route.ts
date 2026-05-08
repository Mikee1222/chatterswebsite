import { Buffer } from "node:buffer";
import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { createRecord } from "@/lib/airtable-server";
import { notifyAdmins } from "@/services/notification-service";
import { NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const type = String(formData.get("type") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const page = String(formData.get("page") ?? "").trim();
  const screenshots = formData.getAll("screenshots");

  if (!type || !title || !description) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const allowedType = type === "bug" || type === "suggestion" || type === "other" ? type : "other";
  const attachments: Array<{ filename: string; url: string }> = [];
  for (const raw of screenshots) {
    if (!(raw instanceof File)) continue;
    if (raw.size <= 0) continue;
    const bytes = await raw.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    attachments.push({ filename: raw.name, url: `data:${raw.type};base64,${base64}` });
  }

  const feedbackId = `fb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const role = session.role === "manager" ? "admin" : session.role;
  const reporterName = session.fullName?.trim() || session.email;

  await createRecord("feedback", {
    feedback_id: feedbackId,
    user_id: session.airtableUserId ?? session.id,
    user_name: reporterName,
    user_role: role,
    type: allowedType,
    title,
    description,
    page,
    status: "new",
    screenshots: attachments.length > 0 ? attachments : undefined,
    created_at: new Date().toISOString(),
  });

  const typeEmoji = allowedType === "bug" ? "🐛" : allowedType === "suggestion" ? "💡" : "📝";
  await notifyAdmins({
    event_type: NOTIFICATION_EVENT.SYSTEM_ALERT,
    priority: NOTIFICATION_PRIORITY.NORMAL,
    title: `${typeEmoji} New ${allowedType} report`,
    body: `${reporterName} (${session.role}): "${title}" on ${page || "unknown page"}`,
    entity_type: "system",
    entity_id: feedbackId,
    actor_user_id: session.airtableUserId ?? session.id,
    actor_name: reporterName,
  }).catch(() => {});

  return NextResponse.json({ success: true, feedback_id: feedbackId });
}

