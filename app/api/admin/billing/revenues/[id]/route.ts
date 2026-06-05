import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { deleteBillingCycleRevenue, updateBillingCycleRevenue } from "@/services/client-billing";

function isAdminOrManager(session: Awaited<ReturnType<typeof getSessionFromCookies>>) {
  return session != null && (session.role === "admin" || session.role === "manager");
}

const patchSchema = z.object({
  turnover_usd: z.number().optional(),
  fee_percent: z.number().min(0).max(100).optional(),
  status: z
    .enum(["draft", "announced", "pending_review", "confirmed_paid", "overdue"])
    .optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!isAdminOrManager(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(" ") },
      { status: 400 }
    );
  }

  try {
    const revenue = await updateBillingCycleRevenue(id, parsed.data);
    return NextResponse.json({ ok: true, data: revenue });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update revenue";
    return NextResponse.json(
      { ok: false, userMessage: message, errorCode: "update_revenue_failed" },
      { status: 400 }
    );
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!isAdminOrManager(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  try {
    await deleteBillingCycleRevenue(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete revenue";
    return NextResponse.json(
      { ok: false, userMessage: message, errorCode: "delete_revenue_failed" },
      { status: 400 }
    );
  }
}
