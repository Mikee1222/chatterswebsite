import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { sanitizePermissions } from "@/lib/permissions";
import { clearRbacCache, hasPermission } from "@/lib/rbac";
import { deleteRole, getRoleById, upsertRole } from "@/services/roles";
import { NOTIFICATION_ROLE_DEFAULT_KEYS } from "@/lib/notification-role-defaults";

/** Allowlist is always derived from PERMISSIONS via sanitizePermissions / ALL_PERMISSIONS. */
const permissionsField = z
  .array(z.string())
  .optional()
  .transform((arr) => (arr === undefined ? undefined : sanitizePermissions(arr)));

const notificationDefaultsSchema = z
  .object(
    Object.fromEntries(NOTIFICATION_ROLE_DEFAULT_KEYS.map((key) => [key, z.boolean()])) as Record<
      (typeof NOTIFICATION_ROLE_DEFAULT_KEYS)[number],
      z.ZodBoolean
    >
  )
  .catchall(z.boolean());

const patchSchema = z.object({
  label: z.string().trim().min(1).max(120).optional(),
  description: z.string().max(2000).optional(),
  permissions: permissionsField,
  notification_defaults: notificationDefaultsSchema.optional(),
  color: z.string().max(32).optional(),
});

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "roles:manage"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  if (!id?.trim()) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const role = await getRoleById(id);
    if (!role) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ role });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "roles:manage"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  if (!id?.trim()) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "No changes" }, { status: 400 });
  }

  try {
    const existing = await getRoleById(id);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const rawBody = body as Record<string, unknown>;
    if (
      existing.is_system_role &&
      typeof rawBody.role_id === "string" &&
      rawBody.role_id.trim().toLowerCase() !== existing.role_id.trim().toLowerCase()
    ) {
      return NextResponse.json({ error: "System role slug cannot be changed." }, { status: 403 });
    }

    const updated = await upsertRole(
      {
        role_id: existing.role_id,
        label: parsed.data.label ?? existing.label,
        description: parsed.data.description ?? existing.description,
        permissions: parsed.data.permissions ?? existing.permissions,
        notification_defaults: parsed.data.notification_defaults ?? existing.notification_defaults,
        is_system_role: existing.is_system_role,
        color: parsed.data.color ?? existing.color,
      },
      id
    );
    clearRbacCache(updated.role_id);
    try {
      const { revalidatePath } = await import("next/cache");
      revalidatePath("/", "layout");
    } catch {
      /* non-blocking */
    }
    return NextResponse.json({ success: true, role: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "roles:manage"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  if (!id?.trim()) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const existing = await getRoleById(id);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (existing.is_system_role) {
      return NextResponse.json({ error: "System roles cannot be deleted." }, { status: 403 });
    }
    await deleteRole(id);
    clearRbacCache(existing.role_id);
    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg.includes("System roles") ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
