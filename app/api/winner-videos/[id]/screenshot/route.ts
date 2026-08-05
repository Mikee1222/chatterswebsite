import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { isAllowedDirectUploadToken } from "@/lib/direct-storage-upload";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  appendWinnerVideoScreenshotUrls,
  getWinnerVideoById,
  uploadWinnerVideoScreenshot,
} from "@/services/winner-videos";

const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.WINNER_VIDEOS_SUBMIT))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const existing = await getWinnerVideoById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.submitted_by_id !== (session.airtableUserId ?? session.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const fd = await req.formData();
  const screenshotUrls = fd
    .getAll("screenshot_url")
    .map((v) => String(v ?? "").trim())
    .filter(Boolean);

  if (screenshotUrls.length > 0) {
    for (const token of screenshotUrls) {
      if (!isAllowedDirectUploadToken(token, "winner-video-screenshot", { itemId: id })) {
        return NextResponse.json({ error: "Invalid screenshot reference" }, { status: 400 });
      }
    }
    await appendWinnerVideoScreenshotUrls(id, screenshotUrls);
  } else {
    const files: Array<{ name: string; type: string; bytes: Uint8Array }> = [];
    for (const entry of fd.getAll("screenshot")) {
      if (!(entry instanceof File) || entry.size <= 0) continue;
      if (entry.size > MAX_BYTES) {
        return NextResponse.json({ error: "Each file must be under 4 MB" }, { status: 400 });
      }
      files.push({
        name: entry.name || "screenshot",
        type: entry.type || "application/octet-stream",
        bytes: new Uint8Array(await entry.arrayBuffer()),
      });
    }
    if (files.length === 0) {
      return NextResponse.json({ error: "No valid files provided" }, { status: 400 });
    }
    await uploadWinnerVideoScreenshot(id, files);
  }

  const video = await getWinnerVideoById(id);
  return NextResponse.json({ video });
}
