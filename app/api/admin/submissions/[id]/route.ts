import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import {
  getPaymentSubmissionById,
  updateBillingCycleStatus,
  updatePaymentSubmissionReview,
} from "@/services/client-portal";

const bodySchema = z.object({
  status: z.enum(["approved", "rejected"]),
  admin_note: z.string().max(4000).optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session || (session.role !== "admin" && session.role !== "manager")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(" ") }, { status: 400 });
  }

  const existing = await getPaymentSubmissionById(id);
  await updatePaymentSubmissionReview(id, parsed.data);

  if (parsed.data.status === "approved") {
    const cycleId = existing.billing_cycle[0];
    if (cycleId) {
      await updateBillingCycleStatus(cycleId, "confirmed_paid");
    }
  }

  revalidatePath(ROUTES.admin.clients);
  return NextResponse.json({ success: true });
}
