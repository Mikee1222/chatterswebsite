import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import {
  filterValidAuthRoleSlugs,
  findInvalidAuthRoleSlugs,
  getKnownAuthRoleIds,
} from "@/lib/sop-auth-roles";
import { hasPermission } from "@/lib/rbac";
import { createSopRole, getAllSopRolesAdmin } from "@/services/sops";

const colorSchema = z.enum(["blue", "pink", "green", "orange", "purple", "gray"]);

const postSchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(1).max(120),
  description: z.string().max(8000).optional().default(""),
  icon: z.string().max(32).optional().default(""),
  color: colorSchema.optional().default("gray"),
  auth_roles: z.array(z.string().trim().min(1)).optional().default([]),
  assigned_user_ids: z.array(z.string().trim().min(1)).optional().default([]),
  academy_mode: z.boolean().optional().default(false),
  department_id: z.string().trim().optional().default(""),
  is_active: z.boolean().optional().default(true),
  sort_order: z.number().int().min(0).optional(),
});

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "sops:manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  const knownAuthRoles = await getKnownAuthRoleIds();
  const invalidAuthRoles = findInvalidAuthRoleSlugs(parsed.data.auth_roles, knownAuthRoles);
  if (invalidAuthRoles.length > 0) {
    return NextResponse.json(
      { error: { auth_roles: [`Unknown role(s): ${invalidAuthRoles.join(", ")}`] } },
      { status: 400 }
    );
  }
  const auth_roles = filterValidAuthRoleSlugs(parsed.data.auth_roles, knownAuthRoles);

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
      auth_roles,
      assigned_user_ids: parsed.data.assigned_user_ids,
      academy_mode: parsed.data.academy_mode,
      department_id: parsed.data.department_id,
      is_active: parsed.data.is_active,
      sort_order,
    });
    return NextResponse.json({ success: true, role: created });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
