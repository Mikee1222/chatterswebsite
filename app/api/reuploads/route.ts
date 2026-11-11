import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { resolveReuploadAccess } from "@/lib/reupload-access";
import { listReuploadTasks } from "@/services/reupload-queue";

/** Reupload tasks the signed-in user may see (assigned models for VAs, all for managers). */
export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const access = await resolveReuploadAccess(session);
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const tasks = await listReuploadTasks({ modelIds: access.modelIds });
    return NextResponse.json({ tasks });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
