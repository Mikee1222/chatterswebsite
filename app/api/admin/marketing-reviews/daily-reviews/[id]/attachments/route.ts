import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { getDailyReviewDetail, uploadDailyReviewAttachments } from "@/services/marketing-reviews";

const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.MARKETING_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const existing = await getDailyReviewDetail(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const fd = await req.formData();
  const files: Array<{ name: string; type: string; bytes: Uint8Array }> = [];
  for (const entry of fd.getAll("attachments")) {
    if (!(entry instanceof File) || entry.size <= 0) continue;
    if (entry.size > MAX_BYTES) {
      return NextResponse.json({ error: "Each file must be under 4 MB" }, { status: 400 });
    }
    files.push({
      name: entry.name || "attachment",
      type: entry.type || "application/octet-stream",
      bytes: new Uint8Array(await entry.arrayBuffer()),
    });
  }
  if (files.length === 0) {
    return NextResponse.json({ error: "No valid files provided" }, { status: 400 });
  }
  await uploadDailyReviewAttachments(id, files);
  const review = await getDailyReviewDetail(id);
  return NextResponse.json({ review });
}
