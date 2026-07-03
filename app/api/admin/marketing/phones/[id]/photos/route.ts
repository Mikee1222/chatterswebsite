import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { getPhoneDetail, uploadPhonePhotos } from "@/services/marketing";

const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "marketing:manage"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const existing = await getPhoneDetail(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const fd = await req.formData();
  const files: Array<{ name: string; type: string; bytes: Uint8Array }> = [];
  for (const entry of fd.getAll("photos")) {
    if (!(entry instanceof File) || entry.size <= 0) continue;
    if (entry.size > MAX_BYTES) {
      return NextResponse.json({ error: "Each photo must be under 4 MB" }, { status: 400 });
    }
    const mime = entry.type || "image/jpeg";
    if (!mime.startsWith("image/")) continue;
    files.push({
      name: entry.name || "photo.jpg",
      type: mime,
      bytes: new Uint8Array(await entry.arrayBuffer()),
    });
  }
  if (files.length === 0) {
    return NextResponse.json({ error: "No valid photos provided" }, { status: 400 });
  }
  await uploadPhonePhotos(id, files);
  const phone = await getPhoneDetail(id);
  return NextResponse.json({ phone });
}
