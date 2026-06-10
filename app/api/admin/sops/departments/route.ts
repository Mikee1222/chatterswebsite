import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import {
  createSopDepartment,
  getAllSopDepartmentsAdmin,
} from "@/services/sops";

const colorSchema = z.enum(["blue", "pink", "green", "orange", "purple", "gray"]);

const postSchema = z.object({
  name: z.string().trim().min(1).max(200),
  color: colorSchema.optional().default("gray"),
  is_active: z.boolean().optional().default(true),
  sort_order: z.number().int().min(0).optional(),
});

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "sops:manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const departments = await getAllSopDepartmentsAdmin();
    return NextResponse.json({ departments });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "sops:manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    const existing = await getAllSopDepartmentsAdmin();
    const maxSort = existing.reduce((m, d) => Math.max(m, d.sort_order), 0);
    const sort_order = parsed.data.sort_order ?? maxSort + 1;
    const created = await createSopDepartment({
      name: parsed.data.name,
      color: parsed.data.color,
      is_active: parsed.data.is_active,
      sort_order,
    });
    return NextResponse.json({ success: true, department: created });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
