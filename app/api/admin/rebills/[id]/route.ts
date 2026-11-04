import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { deleteRebill, getRebillById, updateRebill } from "@/services/rebills";
import { ROUTES } from "@/lib/routes";

const bodySchema = z.object({
  status: z.enum(["pending", "verified", "rejected"]).optional(),
  admin_notes: z.string().max(8000).optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "billing:manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(" ") },
      { status: 400 }
    );
  }

  const { status, admin_notes } = parsed.data;
  if (status === undefined && admin_notes === undefined) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const existing = await getRebillById(id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const fields: { status?: string; admin_notes?: string } = {};
  if (status !== undefined) fields.status = status;
  if (admin_notes !== undefined) fields.admin_notes = admin_notes;

  await updateRebill(id, fields);

  revalidatePath(ROUTES.admin.rebillsTips);
  revalidatePath(ROUTES.chatter.myRebills);

  return NextResponse.json({
    success: true,
    chatter_name: existing.chatter_name || undefined,
  });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "billing:manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const existing = await getRebillById(id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await deleteRebill(id);

  revalidatePath(ROUTES.admin.rebillsTips);
  revalidatePath(ROUTES.chatter.myRebills);

  return NextResponse.json({ success: true });
}
