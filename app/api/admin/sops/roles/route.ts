import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { createSopRole, getAllSopRolesAdmin } from "@/services/sops";

function isStaffAdmin(session: { role: string } | null): boolean {
  return session != null && (session.role === "admin" || session.role === "manager");
}

const colorSchema = z.enum(["blue", "pink", "green", "orange", "purple", "gray"]);
const authRoleSchema = z.enum([
  "admin",
  "manager",
  "chatter",
  "virtual_assistant",
  "model",
  "client",
]);

const postSchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(1).max(120),
  description: z.string().max(8000).optional().default(""),
  icon: z.string().max(32).optional().default(""),
  color: colorSchema.optional().default("gray"),
  auth_roles: z.array(authRoleSchema).optional().default([]),
  assigned_user_ids: z.array(z.string().trim().min(1)).optional().default([]),
  is_active: z.boolean().optional().default(true),
  sort_order: z.number().int().min(0).optional(),
});

export async function GET() {
  const session = await getSessionFromCookies();
  if (!isStaffAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const roles = await getAllSopRolesAdmin();
    return NextResponse.json({ roles });
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
    const existing = await getAllSopRolesAdmin();
    const maxSort = existing.reduce((m, r) => Math.max(m, r.sort_order), 0);
    const sort_order = parsed.data.sort_order ?? maxSort + 1;
    const created = await createSopRole({
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description,
      icon: parsed.data.icon,
      color: parsed.data.color,
      auth_roles: parsed.data.auth_roles,
      assigned_user_ids: parsed.data.assigned_user_ids,
      is_active: parsed.data.is_active,
      sort_order,
    });
    return NextResponse.json({ success: true, role: created });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
