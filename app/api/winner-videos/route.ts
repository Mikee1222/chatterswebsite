import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { getWinnerVideosBySubmitter } from "@/services/winner-videos";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Fill Bunches is the researcher submit path; managers may still list via admin APIs.
  const canSubmit =
    (await hasPermission(session, PERMISSIONS.WINNER_SOURCING_SUBMIT)) ||
    (await hasPermission(session, PERMISSIONS.WINNER_VIDEOS_SUBMIT));
  if (!canSubmit) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const videos = await getWinnerVideosBySubmitter(session.airtableUserId ?? session.id);
  return NextResponse.json({ videos });
}

export async function POST() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Non-bunch Research submit UI removed — use Fill Bunches (/winner-recreates).
  return NextResponse.json(
    {
      error:
        "Standalone Research submit is retired. Submit via Fill Bunches so finds are linked to a bunch and reviewed in Research Manage.",
    },
    { status: 410 },
  );
}
