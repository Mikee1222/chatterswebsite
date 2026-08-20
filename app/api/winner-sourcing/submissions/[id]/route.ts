import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  deleteWinnerSubmission,
  getWinnerSubmission,
  getWinnerSubmissionDeleteImpact,
} from "@/services/winner-sourcing";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.WINNER_SOURCING_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const wantImpact = new URL(req.url).searchParams.get("delete_impact") === "1";
  if (wantImpact) {
    const impact = await getWinnerSubmissionDeleteImpact(id);
    if (!impact) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ impact });
  }
  const submission = await getWinnerSubmission(id);
  if (!submission) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ submission });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.WINNER_SOURCING_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  try {
    const impact = await deleteWinnerSubmission(id);
    return NextResponse.json({ ok: true, impact });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    const status = message === "Submission not found" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
