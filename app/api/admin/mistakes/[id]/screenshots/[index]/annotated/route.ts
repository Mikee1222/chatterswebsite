import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import {
  clearMistakeAnnotatedScreenshot,
  saveMistakeAnnotatedScreenshot,
} from "@/services/chatter-mistakes";

const MAX_BYTES = 8 * 1024 * 1024;

function parseIndex(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
}

function isPngMagic(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  );
}

export async function PUT(
  req: Request,
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

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart body" }, { status: 400 });
  }

  const entry = form.get("file");
  if (!(entry instanceof File) || entry.size <= 0) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (entry.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 8 MB)" }, { status: 400 });
  }
  const type = (entry.type || "").toLowerCase();
  if (type && type !== "image/png") {
    return NextResponse.json({ error: "Only image/png allowed" }, { status: 400 });
  }

  const bytes = new Uint8Array(await entry.arrayBuffer());
  if (!isPngMagic(bytes)) {
    return NextResponse.json({ error: "Invalid PNG file" }, { status: 400 });
  }

  try {
    const result = await saveMistakeAnnotatedScreenshot(id.trim(), index, bytes);
    return NextResponse.json({ success: true, annotated_url: result.annotated_url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/not found/i.test(msg)) return NextResponse.json({ error: msg }, { status: 404 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
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
    await clearMistakeAnnotatedScreenshot(id.trim(), index);
    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/not found/i.test(msg)) return NextResponse.json({ error: msg }, { status: 404 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
