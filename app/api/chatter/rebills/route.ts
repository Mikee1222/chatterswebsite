import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { createRebill } from "@/services/rebills";
import { chatterScreenshotAttachments } from "@/lib/chatter-screenshot-upload";
import {
  attachmentFromSbToken,
  isAllowedDirectScreenshotToken,
} from "@/lib/direct-storage-upload";
import { notify } from "@/services/notification-service";
import { NOTIFICATION_ENTITY, NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import { readRequestFormData } from "@/lib/request-form-data";
import { awardPoints } from "@/services/points-engine";
import { getPointsConfig } from "@/services/points-config";
import { updateChallengeProgress } from "@/services/challenges";

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
  const chatterId = session.airtableUserId ?? session.id;

  const created = await createRebill({
    rebill_id: rebillId,
    chatter_id: chatterId,
    chatter_name: reporterName,
    model_id,
    model_name: model_name || "",
    sub_username,
    sub_type,
    status: "verified",
    screenshot: attachments.length > 0 ? attachments : undefined,
    created_at: new Date().toISOString(),
  });

  let pointsAwarded = 0;
  try {
    const config = await getPointsConfig();
    const pointsPerRebill = Math.max(0, Math.floor(config.REBILL_VERIFIED));
    if (pointsPerRebill > 0) {
      await awardPoints(chatterId, pointsPerRebill, "Rebill logged", "rebill", created.id);
      pointsAwarded = pointsPerRebill;
    }
    await updateChallengeProgress(chatterId, "rebills_verified", 1);
    const pointsSuffix = pointsPerRebill > 0 ? ` +${pointsPerRebill} pts earned.` : "";
    await notify({
      user_id: chatterId,
      event_type: NOTIFICATION_EVENT.REBILL_VERIFIED,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      title: "✅ Rebill logged",
      body: `Your rebill was recorded.${pointsSuffix}`,
      entity_type: NOTIFICATION_ENTITY.REBILL,
      entity_id: created.id,
      _triggerSource: "chatterRebillCreated",
    }).catch(() => {});
  } catch (err) {
    console.error("[chatter/rebills] points/notify after create failed", err);
  }

  return NextResponse.json({ success: true, rebill_id: rebillId, points_awarded: pointsAwarded });
}
