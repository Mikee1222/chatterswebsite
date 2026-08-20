import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { createWinnerSubmission, listWinnerSubmissions } from "@/services/winner-sourcing";
import { coerceWinnerTier, type WinnerSubmissionStatus } from "@/lib/winner-sourcing-helpers";

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const canManage = await hasPermission(session, PERMISSIONS.WINNER_SOURCING_MANAGE);
  const canSubmit = await hasPermission(session, PERMISSIONS.WINNER_SOURCING_SUBMIT);
  if (!canManage && !canSubmit) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const tier = coerceWinnerTier(url.searchParams.get("tier"));
  const statusRaw = url.searchParams.get("status")?.trim() as WinnerSubmissionStatus | undefined;

  const submissions = await listWinnerSubmissions({
    tier: tier ?? undefined,
    status: statusRaw || undefined,
  });

  // Submitters without manage only see their own.
  const uid = session.airtableUserId ?? session.id;
  const filtered = canManage
    ? submissions
    : submissions.filter((s) => s.submitted_by_id === uid);

  return NextResponse.json({ submissions: filtered });
}

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.WINNER_SOURCING_SUBMIT))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as Record<string, unknown>;
  const model_id = String(body.model_id ?? "").trim();
  const model_name = String(body.model_name ?? "").trim();
  const video_link = String(body.video_link ?? "").trim();
  const view_count = Number(body.view_count);

  if (!model_id) return NextResponse.json({ error: "Model is required" }, { status: 400 });
  if (!video_link) return NextResponse.json({ error: "Video link is required" }, { status: 400 });
  if (!Number.isFinite(view_count) || view_count < 0) {
    return NextResponse.json({ error: "View count is required" }, { status: 400 });
  }
  try {
    const { getModelWinnerThresholds } = await import("@/services/model-winner-thresholds");
    const thresholds = await getModelWinnerThresholds(model_id);
    if (view_count < thresholds.winner_threshold_views) {
      return NextResponse.json(
        {
          error: `View count must be at least ${thresholds.winner_threshold_views.toLocaleString()} to qualify as Winner or Super Winner`,
        },
        { status: 400 },
      );
    }

    const submission = await createWinnerSubmission({
      model_id,
      model_name: model_name || "Creator",
      video_link,
      view_count,
      submitted_by_id: session.airtableUserId ?? session.id,
      submitted_by_name: (session.fullName || session.email || "").trim(),
      source: "va_submitted",
      thresholds,
    });
    return NextResponse.json({ submission });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to submit";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
