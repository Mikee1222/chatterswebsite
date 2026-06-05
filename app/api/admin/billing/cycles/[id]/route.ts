import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import {
  deleteBillingCycle,
  getBillingCycleById,
  updateBillingCycle,
} from "@/services/client-billing";

function isAdminOrManager(session: Awaited<ReturnType<typeof getSessionFromCookies>>) {
  return session != null && (session.role === "admin" || session.role === "manager");
}

const patchSchema = z.object({
  client: z.array(z.string()).optional(),
  kind: z.enum(["chatting_weekly", "crm_monthly"]).optional(),
  period_start: z.string().optional(),
  period_end: z.string().optional(),
  due_date: z.string().optional(),
  currency: z.string().optional(),
  status: z
    .enum(["draft", "announced", "pending_review", "confirmed_paid", "overdue"])
    .optional(),
  model: z.array(z.string()).optional(),
  model_turnover: z.number().optional(),
  client_percentage_snapshot: z.number().optional(),
  amount_crm: z.number().optional(),
  amount: z.number().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!isAdminOrManager(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const current = await getBillingCycleById(id);
  if (current?.status === "confirmed_paid") {
    return NextResponse.json(
      { error: 'Cannot update billing cycle with status "confirmed_paid".' },
      { status: 400 }
    );
  }

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
    const cycle = await updateBillingCycle(id, parsed.data);
    return NextResponse.json({ data: cycle });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update billing cycle";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!isAdminOrManager(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  try {
    await deleteBillingCycle(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete billing cycle";
    return NextResponse.json({ ok: false, userMessage: message }, { status: 400 });
  }
}
