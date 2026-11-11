import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  addSubmissionToRecreationQueue,
  addSubmissionToReuploadQueue,
  listRecreationQueue,
} from "@/services/winner-sourcing";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.WINNER_SOURCING_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const items = await listRecreationQueue();
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.WINNER_SOURCING_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = (await req.json()) as { winner_submission_id?: string; queue?: string };
  const id = String(body.winner_submission_id ?? "").trim();
  if (!id) return NextResponse.json({ error: "winner_submission_id required" }, { status: 400 });
  try {
    // queue: "reupload" → trial-grid outlier, same file to the main grid.
    const item =
      body.queue === "reupload"
        ? await addSubmissionToReuploadQueue(id, session.airtableUserId ?? session.id)
        : await addSubmissionToRecreationQueue(id);
    return NextResponse.json({ item });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 400 },
    );
  }
}
