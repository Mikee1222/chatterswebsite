import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { resolveReuploadAccess } from "@/lib/reupload-access";
import { completeReupload } from "@/services/reupload-queue";

/**
 * A VA reuploaded a trial outlier to the main grid: body `{ url }` = the new grid link.
 * Converts the Winners Hub entry to a grid post and notifies the Marketing Manager.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const access = await resolveReuploadAccess(session);
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { url?: string };
  try {
    const result = await completeReupload({
      queue_item_id: id,
      url: String(body.url ?? ""),
      actor_id: session.airtableUserId ?? session.id,
      allowedModelIds: access.modelIds,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}
