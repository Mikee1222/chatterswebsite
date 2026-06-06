import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { deleteFineBonus, updateFineBonus } from "@/services/fines-bonuses";

function isAdminOnly(session: { role: string } | null): boolean {
  return session != null && session.role === "admin";
}

const patchSchema = z.object({
  type: z.enum(["bonus", "fine"]).optional(),
  amount: z.number().finite().min(0).max(1_000_000).optional(),
  reason: z.string().trim().min(1).max(500).optional(),
  notes: z.string().max(8000).optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!isAdminOnly(session)) {
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
    const entry = await updateFineBonus(id.trim(), parsed.data);
    return NextResponse.json({ success: true, entry });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg || "Update failed" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!isAdminOnly(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  if (!id?.trim()) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    await deleteFineBonus(id.trim());
    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg || "Delete failed" }, { status: 500 });
  }
}
