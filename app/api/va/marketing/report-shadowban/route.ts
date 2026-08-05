import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getSessionFromCookies } from "@/lib/auth";
import { isSupabaseBackend } from "@/lib/data-backend";
import {
  attachmentFromSbToken,
  isAllowedDirectUploadToken,
} from "@/lib/direct-storage-upload";
import { hasAnyPermission } from "@/lib/rbac";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { ROUTES } from "@/lib/routes";
import { vaTypeAccessApiGuardForNavHref } from "@/lib/va-type-access";
import { createShadowbanReport } from "@/services/marketing";
import { notifyByRoleConfig } from "@/services/notification-service";
import { shadowbanSubmittedPersonal } from "@/lib/notification-copy";
import { getActiveModelUserAirtableIdByLinkedModelRecordId } from "@/services/users";
import { NOTIFICATION_EVENT, NOTIFICATION_ENTITY, NOTIFICATION_PRIORITY } from "@/lib/notification-types";

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasAnyPermission(session, ["marketing:manage", "marketing:shadowban-report"]))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const staff = getEffectiveStaffRole(session);
  const isVa = staff === "virtual_assistant";
  if (isVa) {
    const blocked = await vaTypeAccessApiGuardForNavHref(session, ROUTES.va.marketingAccounts);
    if (blocked) return blocked;
  }

  const formData = await req.formData();
  const account_id = String(formData.get("account_id") ?? "").trim();
  const model_id = String(formData.get("model_id") ?? "").trim();
  const model_name = String(formData.get("model_name") ?? "").trim();
  const platform = String(formData.get("platform") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim();
  const rawNotes = String(formData.get("notes") ?? "").trim();
  const reportTypeRaw = String(formData.get("report_type") ?? "").trim();
  const report_type: "shadowbanned" | "banned" = reportTypeRaw === "banned" ? "banned" : "shadowbanned";
  const notes =
    report_type === "banned"
      ? rawNotes
        ? `[Ban reported] ${rawNotes}`
        : "[Ban reported]"
      : rawNotes
        ? `[Shadowban reported] ${rawNotes}`
        : "[Shadowban reported]";
  const screenshotUrl = String(formData.get("screenshot_url") ?? "").trim();
  const screenshot = formData.get("screenshot");

  if (!account_id || !platform || !username) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  let screenshotAttachment: { url: string }[] = [];

  if (screenshotUrl) {
    if (!isAllowedDirectUploadToken(screenshotUrl, "shadowban-report")) {
      return NextResponse.json({ error: "Invalid screenshot reference" }, { status: 400 });
    }
    screenshotAttachment = [attachmentFromSbToken(screenshotUrl)];
  } else if (screenshot instanceof Blob && screenshot.size > 0) {
    if (isSupabaseBackend()) {
      const { uploadToPrivateStorage } = await import("@/lib/supabase-signed-url");
      const name =
        screenshot instanceof File && screenshot.name
          ? screenshot.name
          : `screenshot-${Date.now()}.png`;
      const token = await uploadToPrivateStorage({
        bucket: "attachments",
        objectPath: `shadowban-reports/${account_id}/${Date.now()}-${name.replace(/[^a-zA-Z0-9._-]/g, "_")}`,
        bytes: new Uint8Array(await screenshot.arrayBuffer()),
        contentType: screenshot.type || "image/png",
      });
      screenshotAttachment = [{ url: token }];
    } else {
      try {
        const name =
          screenshot instanceof File && screenshot.name
            ? screenshot.name
            : `screenshot-${Date.now()}.png`;
        const blob = await put(`shadowban-reports/${account_id}/${Date.now()}-${name}`, screenshot, {
          access: "public",
        });
        screenshotAttachment = [{ url: blob.url }];
      } catch (e) {
        console.error("[shadowban report] screenshot upload failed:", e);
        return NextResponse.json(
          { error: "Screenshot upload failed. Please try again." },
          { status: 502 },
        );
      }
    }
  } else {
    return NextResponse.json(
      { error: "A screenshot is required to submit a shadowban/ban report." },
      { status: 400 },
    );
  }

  const reporterId = session.airtableUserId ?? session.id;
  const reporterName = session.fullName?.trim() || session.email || "User";
  const reporterRole = isVa ? "virtual_assistant" : session.role;

  const report = await createShadowbanReport({
    account_id,
    model_id,
    model_name,
    platform,
    username,
    reported_by_id: reporterId,
    reported_by_name: reporterName,
    reported_by_role: reporterRole,
    notes,
    screenshot: screenshotAttachment,
  });

  const personalIds = [reporterId];
  if (model_id) {
    const modelUserId = await getActiveModelUserAirtableIdByLinkedModelRecordId(model_id).catch(() => null);
    if (modelUserId && !personalIds.includes(modelUserId)) personalIds.push(modelUserId);
  }
  const selfCopy = shadowbanSubmittedPersonal(username, platform);
  await notifyByRoleConfig(NOTIFICATION_EVENT.SHADOWBAN_SUBMITTED, {
    personal_user_id: personalIds,
    priority: NOTIFICATION_PRIORITY.HIGH,
    title: selfCopy.title,
    body: selfCopy.body,
    entity_type: "shadowban_report",
    entity_id: report.report_id,
    actor_user_id: reporterId,
    actor_name: reporterName,
    context: {
      username,
      platform,
      modelName: model_name,
      reporterName,
    },
  }).catch(() => {});

  return NextResponse.json({ success: true, report });
}
