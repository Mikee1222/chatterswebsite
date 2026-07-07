import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { ROUTES } from "@/lib/routes";
import { getPaymentSubmissionById } from "@/services/client-portal";
import { updatePaymentSubmission } from "@/services/client-billing";
import { notify } from "@/services/notification-service";

const bodySchema = z.object({
  status: z.enum(["approved", "rejected"]),
  admin_note: z.string().max(4000).optional(),
});

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!(await hasPermission(session, "billing:manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  try {
    const submission = await getPaymentSubmissionById(id);
    return NextResponse.json({ submission });
  } catch {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
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

  try {
    const submission = await updatePaymentSubmission(id, parsed.data);
    const clientId = submission.client[0];
    if (clientId) {
      if (parsed.data.status === "approved") {
        await notify({
          user_id: clientId,
          event_type: "payment_confirmed",
          priority: "normal",
          title: "✅ Payment approved",
          body: "Your payment has been confirmed. Thank you!",
          entity_type: "payment_submission",
          entity_id: id,
          _triggerSource: "adminSubmissionReview",
        }).catch(console.error);
      } else {
        await notify({
          user_id: clientId,
          event_type: "payment_rejected",
          priority: "high",
          title: "❌ Payment rejected",
          body: "Your payment proof was rejected. Please resubmit.",
          entity_type: "payment_submission",
          entity_id: id,
          _triggerSource: "adminSubmissionReview",
        }).catch(console.error);
      }
    }
    revalidatePath(ROUTES.admin.clients);
    revalidatePath(ROUTES.admin.submissions);
    return NextResponse.json({ success: true, submission });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update submission";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
