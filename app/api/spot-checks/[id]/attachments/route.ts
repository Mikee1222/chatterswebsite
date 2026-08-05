import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { isAllowedDirectUploadToken } from "@/lib/direct-storage-upload";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { filterSpotChecksByManager, spotCheckManagerName } from "@/lib/marketing-reviews-helpers";
import {
  appendSpotCheckAttachmentUrls,
  getSpotCheckById,
  uploadSpotCheckAttachments,
} from "@/services/marketing-reviews";

const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.SPOTCHECK_SUBMIT))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const existing = await getSpotCheckById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const managerName = spotCheckManagerName(session);
  const owned = filterSpotChecksByManager([existing], managerName);
  if (owned.length === 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const fd = await req.formData();
  const attachmentUrls = fd
    .getAll("attachment_url")
    .map((v) => String(v ?? "").trim())
    .filter(Boolean);

  if (attachmentUrls.length > 0) {
    for (const token of attachmentUrls) {
      if (!isAllowedDirectUploadToken(token, "spot-check", { itemId: id })) {
        return NextResponse.json({ error: "Invalid attachment reference" }, { status: 400 });
      }
    }
    await appendSpotCheckAttachmentUrls(id, attachmentUrls);
  } else {
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
    await uploadSpotCheckAttachments(id, files);
  }

  const spotCheck = await getSpotCheckById(id);
  return NextResponse.json({ spotCheck });
}
