import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { softDeleteMistakeReason, updateMistakeReasonRow } from "@/services/chatter-mistakes";
import type { MistakeReasonCategory } from "@/services/chatter-mistakes";

const patchSchema = z.object({
  label: z.string().trim().min(1).max(500).optional(),
  category: z.enum(["Low", "Medium", "High"]).optional(),
  points_deduction: z.number().int().min(0).max(1000).optional(),
  active: z.boolean().optional(),
  sort_order: z.number().int().min(0).optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!(await hasPermission(session, "mistakes:reasons-manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
    const updated = await updateMistakeReasonRow(id, {
      ...(parsed.data.label !== undefined ? { label: parsed.data.label } : {}),
      ...(parsed.data.category !== undefined
        ? { category: parsed.data.category as MistakeReasonCategory }
        : {}),
      ...(parsed.data.points_deduction !== undefined ? { points_deduction: parsed.data.points_deduction } : {}),
      ...(parsed.data.active !== undefined ? { active: parsed.data.active } : {}),
      ...(parsed.data.sort_order !== undefined ? { sort_order: parsed.data.sort_order } : {}),
    });
    return NextResponse.json({ success: true, reason: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!(await hasPermission(session, "mistakes:reasons-manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  if (!id?.trim()) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const updated = await softDeleteMistakeReason(id);
    return NextResponse.json({ success: true, reason: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
