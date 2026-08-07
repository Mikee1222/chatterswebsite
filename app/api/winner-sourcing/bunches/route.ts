import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { createVideoBunch, listVideoBunches } from "@/services/winner-sourcing";
import { coerceBunchStatus } from "@/lib/winner-sourcing-helpers";

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const canManage = await hasPermission(session, PERMISSIONS.WINNER_SOURCING_MANAGE);
  const canReview = await hasPermission(session, PERMISSIONS.WINNER_VIDEOS_MANAGE);
  const canSubmit = await hasPermission(session, PERMISSIONS.WINNER_SOURCING_SUBMIT);
  if (!canManage && !canReview && !canSubmit) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const status = coerceBunchStatus(url.searchParams.get("status") || "open");
  // Researchers get all open bunches (overview + submit); managers/reviewers get filtered or all.
  const canSeeAll = canManage || canReview;
  const bunches = await listVideoBunches(
    url.searchParams.has("status") ? { status } : canSeeAll ? undefined : { status: "open" },
  );
  const filtered = canSeeAll
    ? bunches
    : bunches.filter((b) => b.status === "open");

  return NextResponse.json({ bunches: filtered });
}

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.WINNER_SOURCING_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as Record<string, unknown>;
  try {
    const bunch = await createVideoBunch({
      name: String(body.name ?? ""),
      model_id: String(body.model_id ?? ""),
      model_name: String(body.model_name ?? ""),
      target_video_count: Number(body.target_video_count) || 30,
      created_by_id: session.airtableUserId ?? session.id,
      created_by_name: (session.fullName || session.email || "").trim(),
    });
    return NextResponse.json({ bunch });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 400 },
    );
  }
}
