import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  getDefaultPdfStyle,
  normalizePdfStyle,
  setDefaultPdfStyle,
} from "@/services/pdf-maker";

const styleSchema = z.object({
  accentColor: z.string().max(20).optional(),
  backgroundColor: z.string().max(20).optional(),
  textColor: z.string().max(20).optional(),
  theme: z.enum(["dark", "light"]).optional(),
  fontFamily: z.string().max(50).optional(),
  footerText: z.string().max(500).optional(),
});

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.PDF_MAKER_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const style = await getDefaultPdfStyle();
    return NextResponse.json({ style });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[GET /api/pdf-maker/style]", e);
    return NextResponse.json({ error: msg || "Failed to load style" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.PDF_MAKER_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = styleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const style = normalizePdfStyle(parsed.data);
    await setDefaultPdfStyle(style);
    return NextResponse.json({ style });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[PUT /api/pdf-maker/style]", e);
    return NextResponse.json({ error: msg || "Failed to save style" }, { status: 500 });
  }
}
