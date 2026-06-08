import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { ROUTES } from "@/lib/routes";
import { vaTypeAccessApiGuardForNavHref } from "@/lib/va-type-access";
import {
  deletePendingVAContentAssignmentByVa,
  updatePendingVAContentAssignmentByVa,
} from "@/services/va-content-assignments";

const patchSchema = z
  .object({
    title: z.string().trim().min(1).max(500).optional(),
    description: z.string().trim().max(20000).optional(),
    deadline: z.string().trim().max(80).nullable().optional(),
    priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  })
  .refine((obj) => Object.values(obj).some((v) => v !== undefined), { message: "No changes" });

async function requireVa() {
  const session = await getSessionFromCookies();
  if (!session || getEffectiveStaffRole(session) !== "virtual_assistant") {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  const blocked = await vaTypeAccessApiGuardForNavHref(session, ROUTES.va.contentAssignments);
  if (blocked) return { ok: false as const, response: blocked };
  const vaId = (session.airtableUserId ?? session.id)?.trim();
  if (!vaId) return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { ok: true as const, vaId };
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireVa();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const recordId = id?.trim();
  if (!recordId) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    const msg = parsed.error.errors.map((e) => e.message).join("; ") || "Invalid body";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const updated = await updatePendingVAContentAssignmentByVa(recordId, auth.vaId, parsed.data);
  if (!updated) return NextResponse.json({ error: "Not found or not editable" }, { status: 404 });

  revalidatePath(ROUTES.va.contentAssignments);
  return NextResponse.json({ success: true, assignment: updated });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireVa();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const recordId = id?.trim();
  if (!recordId) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const ok = await deletePendingVAContentAssignmentByVa(recordId, auth.vaId);
  if (!ok) return NextResponse.json({ error: "Not found or not deletable" }, { status: 404 });

  revalidatePath(ROUTES.va.contentAssignments);
  return NextResponse.json({ success: true });
}
