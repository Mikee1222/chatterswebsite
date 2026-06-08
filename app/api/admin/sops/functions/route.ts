import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { createFunction, getFunctionsByRoleAdmin } from "@/services/sops";

function isStaffAdmin(session: { role: string } | null): boolean {
  return session != null && (session.role === "admin" || session.role === "manager");
}

const cadenceSchema = z.enum([
  "daily",
  "per_shift",
  "weekly",
  "biweekly",
  "monthly",
  "ad_hoc",
]);

const standardTypeSchema = z.enum(["text", "file"]);

const postSchema = z.object({
  sop_role_id: z.string().trim().min(1),
  name: z.string().trim().min(1).max(200),
  department_id: z.string().trim().min(1).optional().default(""),
  kpi: z.string().max(8000).optional().default(""),
  standard_type: standardTypeSchema.optional().default("text"),
  sop_content: z.string().max(50000).optional().default(""),
  sop_file_url: z.string().max(2000).optional().default(""),
  sop_file_name: z.string().max(500).optional().default(""),
  loom_url: z.string().max(2000).optional().default(""),
  cadence_type: cadenceSchema.optional().default("ad_hoc"),
  cadence_note: z.string().max(500).optional().default(""),
  is_active: z.boolean().optional().default(true),
  sort_order: z.number().int().min(0).optional(),
});

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!isStaffAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const roleId = new URL(req.url).searchParams.get("role_id")?.trim() ?? "";
  if (!roleId) {
    return NextResponse.json({ error: "role_id required" }, { status: 400 });
  }

  try {
    const functions = await getFunctionsByRoleAdmin(roleId);
    return NextResponse.json({ functions });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!isStaffAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
    const existing = await getFunctionsByRoleAdmin(parsed.data.sop_role_id);
    const maxSort = existing.reduce((m, f) => Math.max(m, f.sort_order), 0);
    const sort_order = parsed.data.sort_order ?? maxSort + 1;
    const created = await createFunction({
      sop_role_id: parsed.data.sop_role_id,
      name: parsed.data.name,
      department_id: parsed.data.department_id,
      kpi: parsed.data.kpi,
      standard_type: parsed.data.standard_type,
      sop_content: parsed.data.sop_content,
      sop_file_url: parsed.data.sop_file_url,
      sop_file_name: parsed.data.sop_file_name,
      loom_url: parsed.data.loom_url,
      cadence_type: parsed.data.cadence_type,
      cadence_note: parsed.data.cadence_note,
      is_active: parsed.data.is_active,
      sort_order,
    });
    return NextResponse.json({ success: true, function: created });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
