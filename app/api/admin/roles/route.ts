import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { sanitizePermissions } from "@/lib/permissions";
import { hasPermission } from "@/lib/rbac";
import { getRoles, syncRoleOptionToAirtable, upsertRole } from "@/services/roles";
import { NOTIFICATION_ROLE_DEFAULT_KEYS } from "@/lib/notification-role-defaults";

/** Allowlist is always derived from PERMISSIONS via sanitizePermissions / ALL_PERMISSIONS. */
const permissionsField = z
  .array(z.string())
  .optional()
  .default([])
  .transform((arr) => sanitizePermissions(arr));

const notificationDefaultsSchema = z
  .object(
    Object.fromEntries(NOTIFICATION_ROLE_DEFAULT_KEYS.map((key) => [key, z.boolean()])) as Record<
      (typeof NOTIFICATION_ROLE_DEFAULT_KEYS)[number],
      z.ZodBoolean
    >
  )
  .catchall(z.boolean());

const postSchema = z.object({
  role_id: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/, "Slug must be lowercase letters, numbers, hyphens, and underscores"),
  label: z.string().trim().min(1).max(120),
  description: z.string().max(2000).optional().default(""),
  permissions: permissionsField,
  notification_defaults: notificationDefaultsSchema.optional(),
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
      notification_defaults: parsed.data.notification_defaults,
      is_system_role: false,
      color: parsed.data.color,
    });
    const airtableSync = await syncRoleOptionToAirtable(created.role_id);
    return NextResponse.json({
      success: true,
      role: created,
      ...(airtableSync.warning ? { airtable_sync_warning: airtableSync.warning } : {}),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
