import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasAnyPermission, isAdminAreaUser } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { runContentQualityPreCheck } from "@/services/ai-content-quality";
import { NOTIFICATION_ENTITY, NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";
import { notify } from "@/services/notification-service";
import { listUsersWithPermission } from "@/services/users";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (
    !(await hasAnyPermission(session, [
      PERMISSIONS.CONTENT_VIEW,
      PERMISSIONS.CONTENT_MANAGE,
    ])) &&
    !isAdminAreaUser(session)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    fileUrl?: string;
    assignmentId?: string;
    skipVision?: boolean;
    notifyAdmins?: boolean;
  };

  const fileUrl = (body.fileUrl ?? "").trim();
  if (!fileUrl) {
    return NextResponse.json({ error: "fileUrl required" }, { status: 400 });
  }

  try {
    const result = await runContentQualityPreCheck({
      fileUrl,
      assignmentId: body.assignmentId ?? null,
      skipVision: Boolean(body.skipVision),
    });

    // Flag for admin assist only — never auto-reject
    if (body.notifyAdmins && result.recommendation === "review" && isAdminAreaUser(session)) {
      const managers = await listUsersWithPermission(PERMISSIONS.CONTENT_MANAGE).catch(() => []);
      const entityId = `content-quality:${body.assignmentId ?? fileUrl.slice(0, 80)}`;
      for (const u of managers.slice(0, 20)) {
        if (!u.id) continue;
        await notify({
          user_id: u.id,
          event_type: NOTIFICATION_EVENT.CONTENT_QUALITY_FLAGGED,
          priority: NOTIFICATION_PRIORITY.NORMAL,
          title: "Content quality needs review",
          body: (result.vision.summary ||
            result.programmatic
              .filter((f) => f.severity !== "info")
              .map((f) => f.message)
              .join("; ") ||
            "Pre-check flagged media for admin assist"
          ).slice(0, 400),
          entity_type: NOTIFICATION_ENTITY.CONTENT_QUALITY,
          entity_id: entityId,
          _triggerSource: "ai_content_quality_precheck",
        }).catch(() => {});
      }
    }

    return NextResponse.json({
      ...result,
      auto_reject: false,
      note: "Suggestion only — never auto-rejects content",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Content quality check failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
