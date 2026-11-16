import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { downloadMistakeScreenshotOriginal } from "@/services/chatter-mistakes";

function parseIndex(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string; index: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "mistakes:manage"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, index: indexRaw } = await ctx.params;
  if (!id?.trim()) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const index = parseIndex(indexRaw ?? "");
  if (index == null) return NextResponse.json({ error: "Invalid index" }, { status: 400 });

  try {
    const result = await downloadMistakeScreenshotOriginal(id.trim(), index);
    if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return new NextResponse(result.bytes, {
      headers: {
        "Content-Type": result.contentType,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
