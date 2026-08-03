import { Buffer } from "node:buffer";
import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { createFeedback } from "@/services/feedback";
import { notifyAdmins } from "@/services/notification-service";
import { NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";

const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;

function safeScreenshotBasename(original: string, index: number): string {
  const stripped = original.replace(/^.*[/\\]/, "").replace(/[^a-zA-Z0-9._-]/g, "_");
  const base = stripped.length > 0 ? stripped.slice(0, 120) : `screenshot_${index + 1}`;
  const hasKnownExt = /\.(png|jpe?g|gif|webp|heic|bmp)$/i.test(base);
  const key = hasKnownExt ? base : `${base}.png`;
  return key.slice(0, 180);
}

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "settings:view"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
  const feedbackId = `fb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const useBlobStore = !!process.env.BLOB_READ_WRITE_TOKEN?.trim();

  const attachments: Array<{ url: string; filename?: string }> = [];

  for (let i = 0; i < screenshots.length; i++) {
    const raw = screenshots[i];
    if (!(raw instanceof File)) continue;
    if (raw.size <= 0 || raw.size >= MAX_SCREENSHOT_BYTES) continue;

    const mime = raw.type || "application/octet-stream";
    if (!mime.startsWith("image/")) continue;

    if (useBlobStore) {
      try {
        const name = safeScreenshotBasename(raw.name, i);
        const blob = await put(`feedback/${feedbackId}/${name}`, raw, { access: "public" });
        attachments.push({ url: blob.url, filename: name });
      } catch (err) {
        console.error("[feedback] Blob upload failed:", err);
      }
    } else {
      const bytes = await raw.arrayBuffer();
      const base64 = Buffer.from(bytes).toString("base64");
      attachments.push({ filename: raw.name, url: `data:${mime};base64,${base64}` });
    }
  }

  const role = session.role === "manager" ? "admin" : session.role;
  const reporterName = session.fullName?.trim() || session.email;

  await createFeedback({
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

  await notifyAdmins({
    event_type: NOTIFICATION_EVENT.FEEDBACK_SUBMITTED,
    priority: NOTIFICATION_PRIORITY.NORMAL,
    title: "💬 New feedback submitted",
    body: `${reporterName} (${session.role}) submitted ${allowedType} feedback: "${title}" on ${page || "an unknown page"}.`,
    entity_type: "system",
    entity_id: feedbackId,
    actor_user_id: session.airtableUserId ?? session.id,
    actor_name: reporterName,
  }).catch(() => {});

  return NextResponse.json({ success: true, feedback_id: feedbackId });
}
