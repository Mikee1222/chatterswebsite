import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { ALL_PERMISSIONS, type Permission } from "@/lib/permissions";

const permissionSchema = z
  .string()
  .refine((v): v is Permission => (ALL_PERMISSIONS as readonly string[]).includes(v));
import { hasPermission } from "@/lib/rbac";
import { getRoles, upsertRole } from "@/services/roles";

const postSchema = z.object({
  role_id: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase letters, numbers, and hyphens"),
  label: z.string().trim().min(1).max(120),
  description: z.string().max(2000).optional().default(""),
  permissions: z.array(permissionSchema).optional().default([]),
  color: z.string().max(32).optional().default("gray"),
});

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "roles:manage"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const roles = await getRoles();
    return NextResponse.json({ roles });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "roles:manage"))) {
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
    const created = await upsertRole({
      role_id: parsed.data.role_id,
      label: parsed.data.label,
      description: parsed.data.description,
      permissions: parsed.data.permissions,
      is_system_role: false,
      color: parsed.data.color,
    });
    return NextResponse.json({ success: true, role: created });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
